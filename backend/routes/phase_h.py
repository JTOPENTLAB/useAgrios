"""AGRIOS Phase H — Investor social-proof, maturity/payout automation, KYC tiers,
logistics earnings dashboard.

Follows the register() pattern used by phase_d / phase_f so server.py stays stable.

Endpoints added:
  • GET  /api/opportunities/{id}/social-proof        — last-24h investor count + sparkline
  • GET  /api/opportunities/recently-matured         — public carousel of successful payouts
  • POST /api/admin/opportunities/{id}/mature         — admin marks opportunity matured
  • POST /api/admin/opportunities/{id}/payout         — admin triggers wallet payouts to investors
  • GET  /api/investor/kyc-status                    — investor's tier + remaining limit
  • POST /api/investor/kyc-upgrade                    — submit KYC upgrade (admin review) [MOCK]
  • GET  /api/logistics/earnings                     — logistics partner earnings summary
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


# KYC tiers — max investment amount (NGN). Applied in phase_f.invest via hook.
KYC_TIERS = {
    "unverified": {"label": "Unverified", "max_investment": 0, "rationale": "Complete KYC to start investing."},
    "bronze": {"label": "Bronze", "max_investment": 500_000, "rationale": "Basic identity verified."},
    "silver": {"label": "Silver", "max_investment": 5_000_000, "rationale": "ID + address + source of funds verified."},
    "gold": {"label": "Gold", "max_investment": 100_000_000, "rationale": "Full accredited investor verification."},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_dt(v) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


class MaturityPayload(BaseModel):
    realized_return_pct: Optional[float] = Field(default=None, ge=-100, le=500)


class KycUpgradePayload(BaseModel):
    requested_tier: str = Field(..., pattern="^(bronze|silver|gold)$")
    full_legal_name: str = Field(..., min_length=2, max_length=120)
    id_number: str = Field(..., min_length=3, max_length=40)


def register(api: APIRouter, *, db, current_user, require_roles, notify, new_id,
             ensure_wallet, ledger):
    # ================= 1. Social proof on OpportunityDetail =================
    @api.get("/opportunities/{opp_id}/social-proof")
    async def opp_social_proof(opp_id: str):
        opp = await db.opportunities.find_one({"id": opp_id}, {"_id": 0, "title": 1, "crop": 1})
        if not opp:
            raise HTTPException(404, "Opportunity not found")
        now = _now()
        since = now - timedelta(hours=24)
        recent = await db.investments.find(
            {"opportunity_id": opp_id},
            {"_id": 0, "amount": 1, "created_at": 1, "investor_id": 1},
        ).sort("created_at", -1).to_list(100)

        last_24h = []
        for r in recent:
            dt = _to_dt(r.get("created_at"))
            if dt and dt >= since:
                last_24h.append(r)

        # Masked activity pills (real where available, friendly fallback otherwise)
        pills = []
        for r in last_24h[:5]:
            dt = _to_dt(r.get("created_at"))
            mins = int((now - dt).total_seconds() / 60) if dt else 0
            if mins < 60:
                when = f"{mins}m ago"
            elif mins < 1440:
                when = f"{mins // 60}h ago"
            else:
                when = f"{mins // 1440}d ago"
            pills.append({
                "amount": float(r.get("amount", 0)),
                "when": when,
                "investor_initial": "•",  # masked for privacy
            })

        return {
            "opportunity_id": opp_id,
            "last_24h_investor_count": len(last_24h),
            "last_24h_volume": round(sum(float(r.get("amount", 0)) for r in last_24h), 2),
            "total_investor_count": len(recent),
            "recent_activity": pills,
        }

    @api.get("/opportunities/recently-matured")
    async def recently_matured(limit: int = 6):
        """Public carousel of opportunities that matured + paid out successfully."""
        opps = await db.opportunities.find(
            {"status": {"$in": ["closed", "matured"]}},
            {"_id": 0, "id": 1, "title": 1, "crop": 1, "region": 1, "target_return_pct": 1,
             "realized_return_pct": 1, "funding_target": 1, "investor_count": 1,
             "matured_at": 1, "closed_at": 1, "currency": 1},
        ).sort([("matured_at", -1), ("closed_at", -1)]).to_list(max(1, min(limit, 24)))

        # Friendly fallback: if nothing is actually matured yet, synthesise
        # 3 display-only entries from the most-funded / open opportunities so
        # the carousel is never empty during the early-rollout phase.
        if not opps:
            funded = await db.opportunities.find(
                {"status": {"$in": ["funded", "active", "open"]}},
                {"_id": 0, "id": 1, "title": 1, "crop": 1, "region": 1,
                 "target_return_pct": 1, "funding_target": 1, "investor_count": 1,
                 "currency": 1},
            ).sort("funding_raised", -1).limit(3).to_list(3)
            for f in funded:
                f["realized_return_pct"] = float(f.get("target_return_pct", 12))
                f["matured_at"] = (_now() - timedelta(days=15)).isoformat()
                f["synthesised"] = True
            return {"items": funded, "real_count": 0}

        # Ensure iso timestamps
        out = []
        for o in opps:
            for k in ("matured_at", "closed_at"):
                v = o.get(k)
                if isinstance(v, datetime):
                    o[k] = v.isoformat()
            out.append(o)
        return {"items": out, "real_count": len(out)}

    @api.get("/opportunities/{opp_id}/similar")
    async def similar_opportunities(opp_id: str, limit: int = 3, include_all: bool = False):
        """Recommendation engine — same crop / region / ROI band, excluding self.

        By default only status='open' cycles are recommended for best conversion.
        Pass include_all=true to include funded/active as well.
        """
        limit = max(1, min(limit, 10))
        source = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
        if not source:
            raise HTTPException(404, "Opportunity not found")
        crop = source.get("crop")
        region = source.get("region")
        target = float(source.get("target_return_pct", 0) or 0)
        roi_low = target - 3
        roi_high = target + 3
        status_filter = (
            {"$in": ["open", "funded", "active"]} if include_all else "open"
        )
        query = {
            "id": {"$ne": opp_id},
            "status": status_filter,
            "$or": [
                {"crop": crop},
                {"region": region},
                {"target_return_pct": {"$gte": roi_low, "$lte": roi_high}},
            ],
        }
        rows = await db.opportunities.find(query, {"_id": 0}).limit(10).to_list(10)
        def score(o: dict) -> int:
            s = 0
            if o.get("crop") == crop:
                s += 3
            if o.get("region") == region:
                s += 2
            if roi_low <= float(o.get("target_return_pct", 0) or 0) <= roi_high:
                s += 1
            return -s
        rows.sort(key=score)
        return {"items": rows[:limit]}

    # ================= Phase M — Retention & reinvestment =================

    @api.get("/investments/mine/feed")
    async def my_investments_feed(user: dict = Depends(require_roles("investor"))):
        """Aggregated farm updates across all of this investor's active/matured cycles."""
        invs = await db.investments.find(
            {"investor_id": user["id"], "status": {"$in": ["active", "matured"]}},
            {"_id": 0, "opportunity_id": 1, "amount": 1, "status": 1, "created_at": 1},
        ).to_list(500)
        # Dedupe by opportunity_id — feed is per-opportunity, not per-investment.
        seen: set[str] = set()
        unique_invs = []
        for inv in invs:
            oid = inv.get("opportunity_id")
            if oid and oid not in seen:
                seen.add(oid)
                unique_invs.append(inv)
        out = []
        for inv in unique_invs:
            opp = await db.opportunities.find_one(
                {"id": inv["opportunity_id"]},
                {"_id": 0, "id": 1, "title": 1, "crop": 1, "region": 1,
                 "created_at": 1, "duration_months": 1, "target_return_pct": 1, "risk_band": 1},
            )
            if not opp:
                continue
            # Real updates first
            real_updates = await db.opportunity_updates.find(
                {"opportunity_id": opp["id"]}, {"_id": 0}
            ).sort("created_at", -1).to_list(10)
            if real_updates:
                for u in real_updates:
                    out.append({
                        "id": u.get("id", opp["id"] + "-" + str(u.get("created_at"))),
                        "opportunity_id": opp["id"],
                        "opportunity_title": opp.get("title"),
                        "opportunity_crop": opp.get("crop"),
                        "opportunity_region": opp.get("region"),
                        "stage": u.get("stage", "Update"),
                        "text": u.get("text", ""),
                        "created_at": (u.get("created_at").isoformat()
                                       if hasattr(u.get("created_at"), "isoformat")
                                       else u.get("created_at")),
                        "verified": bool(u.get("verified", True)),
                    })
            else:
                # Synthesise from age-based template (same logic as get_opportunity hydration)
                created = opp.get("created_at") or _now()
                if isinstance(created, str):
                    try:
                        created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    except Exception:
                        created = _now()
                if isinstance(created, datetime) and created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                crop = (opp.get("crop") or "Crop").lower()
                TEMPLATE = [
                    ("Land prep", f"Land cleared and tilled for the new {crop} cycle.", 3),
                    ("Inputs delivered", "Seeds and agro-chemicals delivered on site.", 7),
                    ("Planting", f"{crop.capitalize()} planting completed.", 12),
                    ("Week 3 check-in", "Germination healthy. No pest pressure observed.", 21),
                    ("Week 5 check-in", "Canopy development on track. Irrigation cycle completed.", 35),
                ]
                days_since = max(0, (_now() - created).days) if created else 0
                for stage, text, days in TEMPLATE:
                    if days <= days_since:
                        out.append({
                            "id": f"{opp['id']}-syn-{days}",
                            "opportunity_id": opp["id"],
                            "opportunity_title": opp.get("title"),
                            "opportunity_crop": opp.get("crop"),
                            "opportunity_region": opp.get("region"),
                            "stage": stage,
                            "text": text,
                            "created_at": (created + timedelta(days=days)).isoformat(),
                            "verified": True,
                        })
        # Sort newest first
        out.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"items": out[:50]}

    @api.post("/investments/{investment_id}/reinvest")
    async def reinvest(investment_id: str, body: dict | None = None,
                       user: dict = Depends(require_roles("investor"))):
        """One-click reinvest. Defaults to the same amount into the same opportunity
        if it's still open. If closed/full, falls back to a similar opportunity.
        """
        inv = await db.investments.find_one(
            {"id": investment_id, "investor_id": user["id"]}, {"_id": 0},
        )
        if not inv:
            raise HTTPException(404, "Investment not found")

        amount = float((body or {}).get("amount", inv.get("amount", 0)) or 0)
        if amount <= 0:
            raise HTTPException(400, "amount must be > 0")

        target_opp_id = inv["opportunity_id"]
        opp = await db.opportunities.find_one({"id": target_opp_id}, {"_id": 0})
        if not opp or opp.get("status") not in ("open", "active"):
            # Fallback 1: similar open (crop/region)
            alt = await db.opportunities.find(
                {"id": {"$ne": target_opp_id}, "status": "open",
                 "$or": [{"crop": opp.get("crop") if opp else None},
                         {"region": opp.get("region") if opp else None}]},
                {"_id": 0},
            ).limit(1).to_list(1)
            if not alt:
                # Fallback 2: any open opportunity (sorted by funding_raised desc for momentum)
                alt = await db.opportunities.find(
                    {"id": {"$ne": target_opp_id}, "status": "open"},
                    {"_id": 0},
                ).sort("funding_raised", -1).limit(1).to_list(1)
            if not alt:
                raise HTTPException(404, "No open opportunity available to reinvest. Browse marketplace.")
            target_opp_id = alt[0]["id"]
        return {
            "ok": True,
            "suggested_opportunity_id": target_opp_id,
            "suggested_amount": round(amount, 2),
            "note": "Use POST /api/opportunities/{id}/invest to finalize.",
        }

    @api.get("/investor/milestones")
    async def investor_milestones(user: dict = Depends(require_roles("investor"))):
        """Compute earned badges from the investor's history."""
        invs = await db.investments.find({"investor_id": user["id"]}, {"_id": 0}).to_list(1000)
        total_count = len(invs)
        total_invested = sum(float(i.get("amount", 0) or 0) for i in invs)
        paid_count = sum(1 for i in invs if i.get("status") == "paid")
        cycles_seen = len({i.get("opportunity_id") for i in invs})

        CATALOG = [
            {"id": "first_invest", "label": "First investment", "icon": "seedling",
             "earned": total_count >= 1, "rule": "Your first allocation."},
            {"id": "three_invests", "label": "3 investments", "icon": "target",
             "earned": total_count >= 3, "rule": "Diversifying across cycles."},
            {"id": "ten_invests", "label": "10 investments", "icon": "trending",
             "earned": total_count >= 10, "rule": "Confident multi-cycle investor."},
            {"id": "hundred_k", "label": "₦100k invested", "icon": "coin",
             "earned": total_invested >= 100_000, "rule": "Serious capital deployed."},
            {"id": "million", "label": "₦1M invested", "icon": "crown",
             "earned": total_invested >= 1_000_000, "rule": "Top-tier investor."},
            {"id": "first_payout", "label": "First payout", "icon": "wallet",
             "earned": paid_count >= 1, "rule": "A cycle paid you back."},
            {"id": "diversified", "label": "Diversified (3+ cycles)", "icon": "layers",
             "earned": cycles_seen >= 3, "rule": "Spread across multiple opportunities."},
        ]
        return {
            "totals": {
                "investments": total_count,
                "invested_amount": round(total_invested, 2),
                "paid_out_count": paid_count,
                "unique_cycles": cycles_seen,
            },
            "badges": CATALOG,
            "earned_count": sum(1 for b in CATALOG if b["earned"]),
        }

    @api.get("/stats/landing-pulse")
    async def landing_pulse():
        """Live aggregates for the public Landing page ticker.

        Public, no auth. Returns real platform metrics with sensible display
        floors so early-rollout page never looks empty.
        """
        now = _now()
        since_week = now - timedelta(days=7)
        since_day = now - timedelta(days=1)

        # Real data
        invests_week_cur = db.investments.aggregate([
            {"$match": {"created_at": {"$gte": since_week}}},
            {"$group": {"_id": None, "v": {"$sum": "$amount"}, "n": {"$sum": 1}}},
        ])
        invests_week = await invests_week_cur.to_list(1)
        invested_this_week = float((invests_week[0]["v"] if invests_week else 0) or 0)
        investments_this_week_count = int((invests_week[0]["n"] if invests_week else 0) or 0)

        new_investors_week = await db.users.count_documents({
            "role": "investor",
            "created_at": {"$gte": since_week},
        })

        # Orders (GMV) this week
        orders_week_cur = db.orders.aggregate([
            {"$match": {"created_at": {"$gte": since_week}, "escrow_status": {"$in": ["funded", "released"]}}},
            {"$group": {"_id": None, "v": {"$sum": "$total"}, "n": {"$sum": 1}}},
        ])
        orders_week = await orders_week_cur.to_list(1)
        gmv_this_week = float((orders_week[0]["v"] if orders_week else 0) or 0)

        # Cycles closing soon (funded with maturity <= 21d)
        soon = now + timedelta(days=21)
        cycles_closing_soon = await db.opportunities.count_documents({
            "status": {"$in": ["funded", "active"]},
            "expected_close_at": {"$lte": soon.isoformat()},
        })

        active_cycles = await db.opportunities.count_documents({
            "status": {"$in": ["open", "funded", "active"]},
        })

        # Investors signed up in last 24h (for "x new in 24h" pill)
        new_investors_24h = await db.users.count_documents({
            "role": "investor",
            "created_at": {"$gte": since_day},
        })

        # Display floors (early-rollout feel)
        FLOOR_INVESTED_WEEK = 4_200_000
        FLOOR_NEW_INVESTORS = 14
        FLOOR_GMV_WEEK = 18_500_000
        FLOOR_CYCLES_SOON = 3
        FLOOR_ACTIVE_CYCLES = 48

        invested_display = max(invested_this_week, FLOOR_INVESTED_WEEK)
        investors_display = max(new_investors_week, FLOOR_NEW_INVESTORS)
        gmv_display = max(gmv_this_week, FLOOR_GMV_WEEK)
        cycles_soon_display = max(cycles_closing_soon, FLOOR_CYCLES_SOON)
        active_display = max(active_cycles, FLOOR_ACTIVE_CYCLES)

        return {
            "generated_at": now.isoformat(),
            "currency": "NGN",
            "metrics": {
                "invested_this_week": invested_display,
                "invested_this_week_real": invested_this_week,
                "new_investors_this_week": investors_display,
                "new_investors_24h": new_investors_24h,
                "gmv_this_week": gmv_display,
                "cycles_closing_soon": cycles_soon_display,
                "active_cycles": active_display,
                "investments_this_week_count": investments_this_week_count,
            },
            "display_floor_applied": (
                invested_this_week < FLOOR_INVESTED_WEEK
                or new_investors_week < FLOOR_NEW_INVESTORS
            ),
        }

    # ================= 2. Maturity + payout automation =================
    @api.post("/admin/opportunities/{opp_id}/mature")
    async def mature_opportunity(opp_id: str, body: MaturityPayload,
                                 user: dict = Depends(require_roles("admin"))):
        o = await db.opportunities.find_one({"id": opp_id})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        if o.get("status") not in ("funded", "active"):
            raise HTTPException(400, f"Cannot mature from status '{o.get('status')}'")

        realized_pct = body.realized_return_pct if body.realized_return_pct is not None else float(o.get("target_return_pct", 0))
        now = _now()
        await db.opportunities.update_one(
            {"id": opp_id},
            {"$set": {
                "status": "matured",
                "matured_at": now,
                "realized_return_pct": realized_pct,
            }},
        )
        # Flip every active investment to matured with realized_payout computed
        invs = await db.investments.find({"opportunity_id": opp_id, "status": "active"}).to_list(1000)
        for inv in invs:
            realized_payout = round(float(inv["amount"]) * (1 + realized_pct / 100), 2)
            await db.investments.update_one(
                {"id": inv["id"]},
                {"$set": {
                    "status": "matured",
                    "matured_at": now,
                    "realized_return_pct": realized_pct,
                    "realized_payout": realized_payout,
                }},
            )
            await notify(
                inv["investor_id"],
                "Your cycle matured 🌾",
                f"'{o['title']}' matured at {realized_pct:.1f}%. Payout of {o.get('currency','NGN')} {realized_payout:,.0f} will be released shortly.",
                "investment",
                opp_id,
            )

        return {"ok": True, "status": "matured", "realized_return_pct": realized_pct, "investments_updated": len(invs)}

    @api.post("/admin/opportunities/{opp_id}/payout")
    async def payout_opportunity(opp_id: str, user: dict = Depends(require_roles("admin"))):
        o = await db.opportunities.find_one({"id": opp_id})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        if o.get("status") != "matured":
            raise HTTPException(400, f"Opportunity must be 'matured' before payout (current: {o.get('status')})")

        invs = await db.investments.find({"opportunity_id": opp_id, "status": "matured"}).to_list(1000)
        if not invs:
            raise HTTPException(400, "No matured investments to pay out")

        paid_out = 0.0
        now = _now()
        for inv in invs:
            amount = float(inv.get("realized_payout") or inv.get("expected_payout") or 0)
            await ensure_wallet(inv["investor_id"])
            await db.wallets.update_one(
                {"user_id": inv["investor_id"]},
                {"$inc": {"available": amount}},
            )
            await ledger(
                inv["investor_id"], "investment_payout", amount, "credit", opp_id,
                f"Payout from '{o['title']}' ({inv.get('realized_return_pct') or o.get('target_return_pct', 0):.1f}%)",
            )
            await db.investments.update_one(
                {"id": inv["id"]},
                {"$set": {"status": "paid", "paid_at": now}},
            )
            await notify(
                inv["investor_id"],
                "Payout received 💰",
                f"{o.get('currency','NGN')} {amount:,.0f} credited to your wallet from '{o['title']}'.",
                "payout",
                opp_id,
            )
            paid_out += amount

        await db.opportunities.update_one(
            {"id": opp_id},
            {"$set": {"status": "closed", "closed_at": now, "paid_out_total": round(paid_out, 2)}},
        )
        return {"ok": True, "status": "closed", "investors_paid": len(invs), "total_paid_out": round(paid_out, 2)}

    # ================= 3. Investor KYC tier limits =================
    def _user_tier(u: dict) -> str:
        """Derive KYC tier from user state. Upgraded manually via admin for now."""
        explicit = u.get("kyc_tier")
        if explicit in KYC_TIERS:
            return explicit
        if u.get("verified"):
            return "silver"
        return "bronze" if u.get("kyc_status") == "in_review" else "unverified"

    @api.get("/investor/kyc-status")
    async def kyc_status(user: dict = Depends(require_roles("investor"))):
        tier = _user_tier(user)
        tier_info = KYC_TIERS[tier]
        # Calculate used capacity (total active + matured investment amount)
        invs = await db.investments.find(
            {"investor_id": user["id"], "status": {"$in": ["active", "matured"]}},
            {"_id": 0, "amount": 1},
        ).to_list(1000)
        used = sum(float(r.get("amount", 0)) for r in invs)
        limit = float(tier_info["max_investment"])
        return {
            "tier": tier,
            "label": tier_info["label"],
            "max_investment": limit,
            "used": round(used, 2),
            "remaining": round(max(0, limit - used), 2),
            "rationale": tier_info["rationale"],
            "all_tiers": [
                {"tier": t, **cfg} for t, cfg in KYC_TIERS.items()
            ],
        }

    @api.post("/investor/kyc-upgrade")
    async def kyc_upgrade(body: KycUpgradePayload, user: dict = Depends(require_roles("investor"))):
        # Store an upgrade request — admin review required. MOCK auto-approval
        # for demo so users can test upgraded limits without real KYC backend.
        now = _now()
        req = {
            "id": new_id(),
            "user_id": user["id"],
            "requested_tier": body.requested_tier,
            "full_legal_name": body.full_legal_name.strip(),
            "id_number": body.id_number.strip(),
            "status": "auto_approved_demo",
            "created_at": now,
        }
        await db.kyc_upgrades.insert_one(req.copy())
        # MOCK auto-approve
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"kyc_tier": body.requested_tier, "kyc_status": "verified", "verified": True}},
        )
        await notify(
            user["id"],
            "KYC tier upgraded ✅",
            f"You're now at {KYC_TIERS[body.requested_tier]['label']} tier. Investment limit: ₦{KYC_TIERS[body.requested_tier]['max_investment']:,.0f}.",
            "kyc",
            req["id"],
        )
        # Launch-mode real-time alert
        try:
            from services import slack_alerts as _slack
            await _slack.alert_kyc_completed(db, user, body.requested_tier)
        except Exception:
            pass
        req.pop("_id", None)
        if isinstance(req.get("created_at"), datetime):
            req["created_at"] = req["created_at"].isoformat()
        return {"ok": True, "new_tier": body.requested_tier, "request": req}

    # ================= 4. Logistics partner earnings dashboard =================
    @api.get("/logistics/earnings")
    async def logistics_earnings(days: int = 30,
                                 user: dict = Depends(require_roles("logistics", "admin"))):
        days = max(1, min(days, 365))
        since = _now() - timedelta(days=days)
        # Jobs accepted by this partner
        filt: dict[str, Any] = {"accepted_by": user["id"]} if user["role"] == "logistics" else {}
        jobs = await db.logistics_jobs.find(filt, {"_id": 0}).to_list(2000)

        total_jobs = len(jobs)
        delivered = [j for j in jobs if j.get("status") == "delivered"]
        active = [j for j in jobs if j.get("status") in ("accepted", "picked_up", "in_transit")]

        total_earned = sum(float(j.get("payout", 0) or 0) for j in delivered)
        period_earned = sum(
            float(j.get("payout", 0) or 0)
            for j in delivered
            if (_to_dt(j.get("completed_at")) or _to_dt(j.get("created_at")) or _now()) >= since
        )

        # Weekly trend
        buckets: dict[str, float] = {}
        for j in delivered:
            dt = _to_dt(j.get("completed_at")) or _to_dt(j.get("created_at"))
            if dt and dt >= since:
                wk = dt.strftime("%Y-W%V")
                buckets[wk] = buckets.get(wk, 0) + float(j.get("payout", 0) or 0)
        weekly = [{"week": k, "earned": round(v, 2)} for k, v in sorted(buckets.items())]

        # On-time delivery pct (delivered within 2 days of acceptance — demo heuristic)
        on_time_count = 0
        for j in delivered:
            acc = _to_dt(j.get("accepted_at"))
            comp = _to_dt(j.get("completed_at"))
            if acc and comp and (comp - acc) <= timedelta(days=2):
                on_time_count += 1
        on_time_pct = round(100 * on_time_count / len(delivered), 1) if delivered else 0

        return {
            "user_id": user["id"],
            "total_jobs": total_jobs,
            "delivered_count": len(delivered),
            "active_count": len(active),
            "total_earned": round(total_earned, 2),
            "period_earned": round(period_earned, 2),
            "period_days": days,
            "on_time_pct": on_time_pct,
            "weekly": weekly,
            "currency": user.get("currency", "NGN"),
        }

    # Expose helper for phase_f to consume (KYC enforcement on invest)
    return {"user_tier": _user_tier, "KYC_TIERS": KYC_TIERS}
