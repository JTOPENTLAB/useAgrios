"""AGRIOS Phase N — Growth engine.

Endpoints:
  • GET  /api/referrals/stats          — referrer view: code, link, counts, earnings, recent invites
  • GET  /api/referrals/admin           — platform-wide stats for /app/admin
  • POST /api/events/track              — lightweight UTM/CTA capture (public)
  • GET  /api/stats/platform-metrics    — admin growth dashboard aggregates

Referral bonus on FIRST investment:
  Helper `maybe_award_invest_referral(investor_id, opportunity_id)` is returned
  from register() so phase_f.invest can call it idempotently.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field


INVEST_REFERRAL_BONUS = 2000.0  # ₦2,000 to referrer + referee on referee's first investment


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TrackEventPayload(BaseModel):
    event: str = Field(..., min_length=1, max_length=64)
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_medium: Optional[str] = None
    referrer: Optional[str] = None
    path: Optional[str] = None
    meta: Optional[dict] = None


def register(api: APIRouter, *, db, current_user, require_roles, notify, new_id,
             ensure_wallet, ledger):

    # ================= Referral awarding helper =================
    async def maybe_award_invest_referral(investor_id: str, opportunity_id: str) -> None:
        """Idempotent: credit ₦2,000 to both referrer + referee if this is the
        referee's first investment and a referral link brought them in."""
        investor = await db.users.find_one({"id": investor_id}, {"_id": 0})
        if not investor:
            return
        if not investor.get("referred_by"):
            return
        if investor.get("invest_referral_bonus_given"):
            return
        # Count this investor's investments
        n = await db.investments.count_documents({"investor_id": investor_id})
        if n != 1:
            return
        referrer_id = investor["referred_by"]
        await ensure_wallet(referrer_id)
        await ensure_wallet(investor_id)
        await db.wallets.update_one({"user_id": referrer_id}, {"$inc": {"available": INVEST_REFERRAL_BONUS}})
        await db.wallets.update_one({"user_id": investor_id}, {"$inc": {"available": INVEST_REFERRAL_BONUS}})
        await ledger(
            investor_id, "referral_bonus", INVEST_REFERRAL_BONUS, "credit",
            opportunity_id, "First-investment referral bonus",
        )
        await ledger(
            referrer_id, "referral_bonus", INVEST_REFERRAL_BONUS, "credit",
            opportunity_id, "Referral bonus — invitee's first investment",
        )
        await db.users.update_one(
            {"id": investor_id}, {"$set": {"invest_referral_bonus_given": True}},
        )
        await notify(
            investor_id, "Referral bonus credited 🎁",
            f"₦{INVEST_REFERRAL_BONUS:,.0f} added to your wallet for using a referral link.",
            "referral", opportunity_id,
        )
        await notify(
            referrer_id, "Referral paid 🎉",
            f"₦{INVEST_REFERRAL_BONUS:,.0f} credited — someone you referred just made their first investment.",
            "referral", opportunity_id,
        )

    # ================= Referral stats (per-user) =================
    @api.get("/referrals/stats")
    async def referrals_stats(request: Request, user: dict = Depends(current_user)):
        code = user.get("referral_code") or ""
        # Prefer the forwarded origin (public preview/prod URL) over backend base URL
        proto = request.headers.get("x-forwarded-proto", "https")
        host = (request.headers.get("x-forwarded-host")
                or request.headers.get("origin", "").replace("https://", "").replace("http://", "")
                or request.headers.get("host", ""))
        host = host.split(",")[0].strip().rstrip("/")
        if host:
            origin = f"{proto}://{host}"
        else:
            origin = str(request.base_url).rstrip("/")
            if origin.endswith("/api"):
                origin = origin[:-4]
        # Public signup link with role=investor pre-selected
        link = f"{origin}/signup?role=investor&ref={code}"

        invited = await db.users.find(
            {"referred_by": user["id"]},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1, "created_at": 1, "invest_referral_bonus_given": 1},
        ).sort("created_at", -1).to_list(50)
        invited_count = len(invited)

        # Activated = those whose first-investment bonus fired (they invested)
        activated_count = sum(1 for u in invited if u.get("invest_referral_bonus_given"))

        # Earnings: sum referral_bonus credits for this user
        ledger_cur = db.ledger.aggregate([
            {"$match": {"user_id": user["id"], "kind": "referral_bonus", "direction": "credit"}},
            {"$group": {"_id": None, "v": {"$sum": "$amount"}}},
        ])
        rows = await ledger_cur.to_list(1)
        total_earned = float((rows[0]["v"] if rows else 0) or 0)

        # Mask invitee PII — show initial + domain
        recent = []
        for u in invited[:10]:
            name = u.get("full_name") or u.get("email") or "Friend"
            initial = (name[:1] if name else "?").upper()
            created_at = u.get("created_at")
            if hasattr(created_at, "isoformat"):
                created_at = created_at.isoformat()
            recent.append({
                "initial": initial,
                "name_masked": (name.split()[0] if " " in name else name[:3]) + " ••",
                "joined_at": created_at,
                "activated": bool(u.get("invest_referral_bonus_given")),
            })

        return {
            "code": code,
            "link": link,
            "invited_count": invited_count,
            "activated_count": activated_count,
            "total_earned": round(total_earned, 2),
            "bonus_per_referral": INVEST_REFERRAL_BONUS,
            "recent": recent,
        }

    # ================= Lightweight event tracking =================
    @api.post("/events/track")
    async def track_event(body: TrackEventPayload, request: Request):
        """Public endpoint used by the landing/signup for UTM capture."""
        ua = request.headers.get("user-agent", "")[:200]
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "") or ""
        doc = {
            "id": new_id(),
            "event": body.event,
            "utm_source": body.utm_source,
            "utm_campaign": body.utm_campaign,
            "utm_medium": body.utm_medium,
            "referrer": body.referrer,
            "path": body.path,
            "meta": body.meta or {},
            "ua": ua,
            "ip": ip.split(",")[0].strip() if ip else "",
            "created_at": _now(),
        }
        await db.growth_events.insert_one(doc)
        return {"ok": True}

    # ================= Admin — platform metrics =================
    @api.get("/stats/platform-metrics")
    async def platform_metrics(days: int = 30, user: dict = Depends(require_roles("admin"))):
        days = max(1, min(days, 365))
        since = _now() - timedelta(days=days)

        # Signups
        total_users = await db.users.count_documents({})
        signups_period = await db.users.count_documents({"created_at": {"$gte": since}})
        signups_by_role = {}
        for role in ("investor", "farmer", "buyer", "logistics", "admin"):
            signups_by_role[role] = await db.users.count_documents({
                "role": role, "created_at": {"$gte": since},
            })

        # Investment funnel
        depositors = await db.ledger.distinct("user_id", {"kind": "fund", "created_at": {"$gte": since}})
        investors_active = await db.investments.distinct("investor_id", {"created_at": {"$gte": since}})
        first_investors = await db.users.count_documents({
            "invest_referral_bonus_given": True,
            "created_at": {"$gte": since},
        })

        invests_cur = db.investments.aggregate([
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {"_id": None, "v": {"$sum": "$amount"}, "n": {"$sum": 1}}},
        ])
        invs_agg = await invests_cur.to_list(1)
        total_invested_period = float((invs_agg[0]["v"] if invs_agg else 0) or 0)
        invest_count_period = int((invs_agg[0]["n"] if invs_agg else 0) or 0)

        # UTM breakdown
        utm_cur = db.growth_events.aggregate([
            {"$match": {"created_at": {"$gte": since}, "utm_source": {"$ne": None}}},
            {"$group": {"_id": "$utm_source", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
            {"$limit": 10},
        ])
        utm_rows = await utm_cur.to_list(10)
        utm_sources = [{"source": r["_id"] or "direct", "count": r["n"]} for r in utm_rows]

        # Conversion rates (with safe denominators)
        signup_count = max(1, signups_period)
        return {
            "period_days": days,
            "totals": {
                "users": total_users,
                "active_cycles": await db.opportunities.count_documents({"status": {"$in": ["open", "active", "funded"]}}),
            },
            "period": {
                "signups": signups_period,
                "signups_by_role": signups_by_role,
                "depositor_count": len(depositors),
                "investor_count": len(investors_active),
                "first_investors": first_investors,
                "total_invested": round(total_invested_period, 2),
                "invest_count": invest_count_period,
            },
            "funnel": {
                "signup_to_deposit_pct": round(min(100.0, 100 * len(depositors) / signup_count), 1),
                "deposit_to_invest_pct": round(
                    min(100.0, 100 * len(investors_active) / max(1, len(depositors))), 1
                ),
                "signup_to_invest_pct": round(min(100.0, 100 * len(investors_active) / signup_count), 1),
            },
            "utm_sources": utm_sources,
        }

    # ================= Cohort retention =================
    @api.get("/admin/cohorts/retention")
    async def cohort_retention(weeks: int = 8, user: dict = Depends(require_roles("admin"))):
        """Weekly signup-cohort retention.

        For each of the last `weeks` signup weeks (Monday-anchored, UTC), report how
        many investor-role users invested by W+1, W+2, W+4, W+8 after their signup.
        Response shape is designed so the frontend can render a triangular heatmap
        without further processing.
        """
        weeks = max(2, min(weeks, 26))
        now = _now()
        # Anchor cohort to the Monday of the current week (UTC, start of day)
        today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        current_monday = today_midnight - timedelta(days=today_midnight.weekday())
        # Window starts `weeks` mondays before current
        window_start = current_monday - timedelta(weeks=weeks - 1)

        # Pull all investor signups in the window + an aggregated first-invest map
        cur = db.users.find(
            {
                "role": "investor",
                "created_at": {"$gte": window_start},
            },
            {"_id": 0, "id": 1, "created_at": 1},
        )
        users = await cur.to_list(length=5000)

        # First-investment timestamp per investor
        agg = db.investments.aggregate([
            {"$match": {"created_at": {"$gte": window_start}}},
            {"$group": {"_id": "$investor_id", "first_at": {"$min": "$created_at"}}},
        ])
        first_by_user = {r["_id"]: r["first_at"] for r in await agg.to_list(length=10000)}

        milestones = [1, 2, 4, 8]
        # Initialize cohorts list (oldest → newest) so the triangular matrix reads top-down
        cohorts = []
        for i in range(weeks):
            week_start = window_start + timedelta(weeks=i)
            week_end = week_start + timedelta(weeks=1)
            label = week_start.strftime("%b %d")
            cohorts.append({
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "label": label,
                "size": 0,
                "retention": {f"W+{m}": {"count": 0, "pct": 0.0, "eligible": True} for m in milestones},
            })

        def _week_index(dt) -> int:
            # Normalize tz-aware/naive
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            delta = dt - window_start
            return int(delta.days // 7)

        # Fill cohort sizes + milestone counts
        for u in users:
            created = u.get("created_at")
            if not created:
                continue
            idx = _week_index(created)
            if idx < 0 or idx >= weeks:
                continue
            cohorts[idx]["size"] += 1
            first_at = first_by_user.get(u["id"])
            if not first_at:
                continue
            if first_at.tzinfo is None:
                first_at = first_at.replace(tzinfo=timezone.utc)
            cohort_start = window_start + timedelta(weeks=idx)
            days_elapsed = (first_at - cohort_start).days
            weeks_elapsed = max(0, days_elapsed // 7)
            for m in milestones:
                if weeks_elapsed <= m:
                    cohorts[idx]["retention"][f"W+{m}"]["count"] += 1

        # Compute pcts + mark eligibility (milestone must fit in the window up to now)
        for i, c in enumerate(cohorts):
            cohort_start_dt = window_start + timedelta(weeks=i)
            weeks_since_cohort = (now - cohort_start_dt).days / 7.0
            for m in milestones:
                cell = c["retention"][f"W+{m}"]
                cell["eligible"] = weeks_since_cohort >= m
                cell["pct"] = (
                    round(100.0 * cell["count"] / c["size"], 1) if c["size"] > 0 else 0.0
                )

        # Totals roll-up (ignoring ineligible cells)
        total_signups = sum(c["size"] for c in cohorts)
        totals = {f"W+{m}": 0 for m in milestones}
        eligible_size = {f"W+{m}": 0 for m in milestones}
        for c in cohorts:
            for m in milestones:
                if c["retention"][f"W+{m}"]["eligible"]:
                    totals[f"W+{m}"] += c["retention"][f"W+{m}"]["count"]
                    eligible_size[f"W+{m}"] += c["size"]
        overall = {
            m: {
                "count": totals[m],
                "pct": round(100.0 * totals[m] / eligible_size[m], 1)
                if eligible_size[m] > 0
                else 0.0,
                "eligible_size": eligible_size[m],
            }
            for m in totals
        }

        return {
            "weeks": weeks,
            "window_start": window_start.isoformat(),
            "milestones": [f"W+{m}" for m in milestones],
            "total_signups": total_signups,
            "overall": overall,
            "cohorts": cohorts,
        }

    # Expose the awarder hook for phase_f to consume.
    return {"maybe_award_invest_referral": maybe_award_invest_referral}
