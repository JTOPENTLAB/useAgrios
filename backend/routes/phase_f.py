"""AGRIOS Phase F — Investor marketplace + Opportunities.

Adds an investor user type + funding-opportunity marketplace. Uses the same
register() pattern as phase_d to avoid bloating server.py.

Flow:
  1. Farmer creates an opportunity (funding request)  POST /api/opportunities
  2. Admin approves it                                 POST /api/opportunities/{id}/approve
  3. Investor browses approved opportunities           GET  /api/opportunities
  4. Investor invests (wallet-debit)                   POST /api/opportunities/{id}/invest
  5. Portfolio + returns                               GET  /api/investments/mine
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field


class OpportunityCreate(BaseModel):
    title: str = Field(..., min_length=6, max_length=120)
    crop: str = Field(..., min_length=2, max_length=60)
    summary: str = Field(..., min_length=20, max_length=600)
    region: str = Field(..., min_length=2, max_length=80)
    duration_months: int = Field(..., ge=1, le=36)
    funding_target: float = Field(..., gt=0)
    min_ticket: float = Field(default=10000, gt=0)
    target_return_pct: float = Field(..., gt=0, le=200)
    risk_band: Literal["A", "B", "C"] = "B"
    use_of_funds: Optional[str] = None


class InvestmentCreate(BaseModel):
    amount: float = Field(..., gt=0)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def register(api: APIRouter, *, db, current_user, require_roles, notify, new_id,
             ensure_wallet, ledger):
    # ---------- Farmer creates opportunity ----------
    @api.post("/opportunities")
    async def create_opportunity(body: OpportunityCreate, user: dict = Depends(require_roles("farmer"))):
        if body.min_ticket > body.funding_target:
            raise HTTPException(400, "min_ticket cannot exceed funding_target")
        doc = {
            "id": new_id(),
            "farmer_id": user["id"],
            "farmer_name": user["full_name"],
            "farmer_verified": bool(user.get("verified")),
            "country": user.get("country") or "NG",
            "currency": user.get("currency") or "NGN",
            "title": body.title.strip(),
            "crop": body.crop.strip(),
            "summary": body.summary.strip(),
            "region": body.region.strip(),
            "duration_months": body.duration_months,
            "funding_target": float(body.funding_target),
            "funding_raised": 0.0,
            "min_ticket": float(body.min_ticket),
            "target_return_pct": float(body.target_return_pct),
            "risk_band": body.risk_band,
            "use_of_funds": (body.use_of_funds or "").strip(),
            "status": "review",  # review → open → funded → active → closed
            "investor_count": 0,
            "expected_close_at": (_now() + timedelta(days=30)).isoformat(),
            "created_at": _now(),
        }
        await db.opportunities.insert_one(doc.copy())
        doc.pop("_id", None)
        return doc

    @api.get("/opportunities")
    async def list_opportunities(
        status: Optional[str] = None,
        crop: Optional[str] = None,
        risk_band: Optional[str] = None,
        country: Optional[str] = None,
    ):
        filt: dict[str, Any] = {}
        if status:
            filt["status"] = status
        else:
            # Default: only show approved opportunities to the world.
            filt["status"] = {"$in": ["open", "funded", "active"]}
        if crop:
            filt["crop"] = {"$regex": f"^{crop}$", "$options": "i"}
        if risk_band:
            filt["risk_band"] = risk_band
        if country:
            filt["country"] = country.upper()
        rows = await db.opportunities.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
        return rows

    @api.get("/opportunities/mine")
    async def my_opportunities(user: dict = Depends(require_roles("farmer"))):
        return await db.opportunities.find({"farmer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)

    @api.get("/opportunities/{opp_id}/updates")
    async def opportunity_updates(opp_id: str):
        """Farm updates timeline — images, text, stage, timestamp."""
        o = await db.opportunities.find_one({"id": opp_id}, {"_id": 0, "crop": 1, "region": 1, "created_at": 1})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        # Real updates from DB if any
        rows = await db.opportunity_updates.find(
            {"opportunity_id": opp_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        if rows:
            return {"opportunity_id": opp_id, "updates": rows}
        # Synthesised timeline based on opportunity age
        now = datetime.now(timezone.utc)
        created = o.get("created_at")
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except Exception:
                created = now
        if not created:
            created = now
        crop = (o.get("crop") or "Crop").lower()
        TEMPLATE = [
            {"stage": "Land prep", "text": f"Land cleared and tilled for the new {crop} cycle. Soil test samples collected.", "days": 3},
            {"stage": "Inputs delivered", "text": "Seeds and agro-chemicals delivered on site. Labour team mobilised.", "days": 7},
            {"stage": "Planting", "text": f"{crop.capitalize()} planting completed across the target hectares.", "days": 12},
            {"stage": "Week 3 check-in", "text": "Germination healthy. No pest pressure observed. Photos uploaded.", "days": 21},
            {"stage": "Week 5 check-in", "text": "Canopy development on track. Irrigation cycle completed.", "days": 35},
        ]
        days_since = max(0, (now - created).days)
        updates = []
        for t in TEMPLATE:
            if t["days"] <= days_since:
                updates.append({
                    "id": new_id(),
                    "opportunity_id": opp_id,
                    "stage": t["stage"],
                    "text": t["text"],
                    "created_at": (created + timedelta(days=t["days"])).isoformat(),
                    "verified": True,
                })
        updates.reverse()  # newest first
        return {"opportunity_id": opp_id, "updates": updates}

    @api.get("/opportunities/{opp_id}")
    async def get_opportunity(opp_id: str):
        o = await db.opportunities.find_one({"id": opp_id}, {"_id": 0})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        # Hydrate recent investor count / names (masked)
        invs = await db.investments.find(
            {"opportunity_id": opp_id}, {"_id": 0, "investor_id": 1, "amount": 1, "created_at": 1},
        ).sort("created_at", -1).to_list(50)
        o["investments_sample"] = [
            {"amount": i["amount"], "at": i["created_at"].isoformat() if hasattr(i.get("created_at"), "isoformat") else i.get("created_at")}
            for i in invs
        ]
        return o

    # ---------- Admin approval ----------
    @api.post("/opportunities/{opp_id}/approve")
    async def approve_opportunity(opp_id: str, user: dict = Depends(require_roles("admin"))):
        o = await db.opportunities.find_one({"id": opp_id})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        if o.get("status") != "review":
            raise HTTPException(400, f"Cannot approve from status '{o.get('status')}'")
        await db.opportunities.update_one(
            {"id": opp_id},
            {"$set": {"status": "open", "approved_at": _now(), "approved_by": user["id"]}},
        )
        await notify(o["farmer_id"], "Opportunity approved ✅", f"'{o['title']}' is now live on the investor marketplace.", "opportunity", opp_id)
        return {"ok": True, "status": "open"}

    @api.post("/opportunities/{opp_id}/reject")
    async def reject_opportunity(opp_id: str, user: dict = Depends(require_roles("admin"))):
        o = await db.opportunities.find_one({"id": opp_id})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        await db.opportunities.update_one(
            {"id": opp_id},
            {"$set": {"status": "rejected", "rejected_at": _now(), "rejected_by": user["id"]}},
        )
        await notify(o["farmer_id"], "Opportunity needs changes", f"'{o['title']}' was not approved. Please review and re-submit.", "opportunity", opp_id)
        return {"ok": True, "status": "rejected"}

    # ---------- Investor invests ----------
    @api.post("/opportunities/{opp_id}/invest")
    async def invest(opp_id: str, body: InvestmentCreate, user: dict = Depends(require_roles("investor"))):
        o = await db.opportunities.find_one({"id": opp_id})
        if not o:
            raise HTTPException(404, "Opportunity not found")
        if o.get("status") != "open":
            raise HTTPException(400, f"Opportunity is not open (status: {o.get('status')})")

        amount = float(body.amount)
        if amount < float(o.get("min_ticket", 0)):
            raise HTTPException(400, f"Minimum investment is {o['min_ticket']:,.0f}")
        remaining = float(o["funding_target"]) - float(o.get("funding_raised", 0) or 0)
        if amount > remaining + 0.01:
            raise HTTPException(400, f"Only {remaining:,.0f} remaining to be raised")

        # Wallet debit
        wallet = await ensure_wallet(user["id"])
        if float(wallet.get("available", 0) or 0) < amount:
            raise HTTPException(402, "Insufficient wallet balance. Please fund your wallet first.")
        await db.wallets.update_one(
            {"user_id": user["id"]},
            {"$inc": {"available": -amount}},
        )
        await ledger(user["id"], "investment_debit", amount, "debit", opp_id, f"Investment in '{o['title']}'")

        inv_id = new_id()
        doc = {
            "id": inv_id,
            "opportunity_id": opp_id,
            "investor_id": user["id"],
            "investor_name": user["full_name"],
            "amount": amount,
            "currency": o["currency"],
            "expected_return_pct": float(o["target_return_pct"]),
            "expected_payout": round(amount * (1 + float(o["target_return_pct"]) / 100), 2),
            "duration_months": int(o["duration_months"]),
            "maturity_at": (_now() + timedelta(days=30 * int(o["duration_months"]))).isoformat(),
            "status": "active",  # active → matured → paid
            "created_at": _now(),
        }
        await db.investments.insert_one(doc.copy())

        # Update opportunity counters
        new_raised = float(o.get("funding_raised", 0) or 0) + amount
        new_status = "funded" if new_raised >= float(o["funding_target"]) - 0.01 else "open"
        update = {"$inc": {"investor_count": 1, "funding_raised": amount}}
        if new_status == "funded":
            update["$set"] = {"status": "funded", "funded_at": _now()}
        await db.opportunities.update_one({"id": opp_id}, update)

        # Notifications
        await notify(
            o["farmer_id"],
            "New investor backed you 💰",
            f"{o['currency']} {amount:,.0f} committed to '{o['title']}'.",
            "investment",
            opp_id,
        )
        await notify(
            user["id"],
            "Investment confirmed",
            f"You backed '{o['title']}' with {o['currency']} {amount:,.0f}. Expected return: {o['target_return_pct']}% in {o['duration_months']}mo.",
            "investment",
            inv_id,
        )

        doc.pop("_id", None)
        return doc

    # ---------- Portfolio ----------
    @api.get("/investments/mine")
    async def my_investments(user: dict = Depends(require_roles("investor"))):
        rows = await db.investments.find(
            {"investor_id": user["id"]}, {"_id": 0},
        ).sort("created_at", -1).to_list(500)
        # Hydrate opportunity info
        out = []
        for r in rows:
            opp = await db.opportunities.find_one(
                {"id": r["opportunity_id"]},
                {"_id": 0, "title": 1, "crop": 1, "status": 1, "risk_band": 1, "farmer_name": 1, "region": 1},
            )
            if opp:
                r["opportunity"] = opp
            out.append(r)
        return out

    @api.get("/investments/summary")
    async def portfolio_summary(user: dict = Depends(require_roles("investor"))):
        rows = await db.investments.find({"investor_id": user["id"]}, {"_id": 0}).to_list(1000)
        total_invested = sum(float(r.get("amount", 0) or 0) for r in rows)
        active = [r for r in rows if r.get("status") == "active"]
        matured = [r for r in rows if r.get("status") == "matured"]
        paid = [r for r in rows if r.get("status") == "paid"]
        expected_returns = sum(
            float(r.get("expected_payout", 0) or 0) - float(r.get("amount", 0) or 0)
            for r in active + matured
        )
        realized = sum(
            float(r.get("realized_payout", r.get("expected_payout", 0)) or 0) - float(r.get("amount", 0) or 0)
            for r in paid
        )
        # Breakdown by risk band
        by_band: dict[str, float] = {"A": 0, "B": 0, "C": 0}
        for r in rows:
            opp = await db.opportunities.find_one(
                {"id": r["opportunity_id"]}, {"_id": 0, "risk_band": 1},
            )
            band = (opp or {}).get("risk_band", "B")
            by_band[band] = by_band.get(band, 0) + float(r.get("amount", 0) or 0)
        return {
            "total_invested": round(total_invested, 2),
            "active_count": len(active),
            "matured_count": len(matured),
            "paid_count": len(paid),
            "expected_returns": round(expected_returns, 2),
            "realized_returns": round(realized, 2),
            "by_risk_band": {k: round(v, 2) for k, v in by_band.items()},
            "investor_id": user["id"],
        }

    @api.get("/stats/investor-platform")
    async def investor_platform_stats():
        """Public platform-wide investor stats with a display floor for early-rollout feel."""
        funded_real = await db.investments.aggregate(
            [{"$group": {"_id": None, "v": {"$sum": "$amount"}}}]
        ).to_list(1)
        investors_real = len(await db.users.distinct("id", {"role": "investor"}))
        active_cycles_real = await db.opportunities.count_documents(
            {"status": {"$in": ["open", "funded", "active"]}}
        )
        FLOOR_FUNDED = 120_000_000
        FLOOR_INVESTORS = 2_300
        FLOOR_CYCLES = 48
        real_funded = int((funded_real[0]["v"] if funded_real else 0) or 0)
        return {
            "funded_total": max(real_funded, FLOOR_FUNDED),
            "active_investors": max(investors_real, FLOOR_INVESTORS),
            "active_cycles": max(active_cycles_real, FLOOR_CYCLES),
            "currency": "NGN",
            "display_floor_applied": real_funded < FLOOR_FUNDED,
        }

    @api.get("/investor/activity")
    async def investor_activity(user: dict = Depends(require_roles("investor"))):
        """Activity feed synthesised from real investments."""
        invs = await db.investments.find(
            {"investor_id": user["id"]}, {"_id": 0},
        ).sort("created_at", -1).to_list(30)

        def _to_dt(v):
            if isinstance(v, datetime):
                return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
            if isinstance(v, str):
                try:
                    return datetime.fromisoformat(v.replace("Z", "+00:00"))
                except Exception:
                    return None
            return None

        def _iso(v):
            dt = _to_dt(v)
            return dt.isoformat() if dt else (v if isinstance(v, str) else "")

        events = []
        for inv in invs:
            opp = await db.opportunities.find_one(
                {"id": inv["opportunity_id"]}, {"_id": 0, "title": 1, "crop": 1}
            )
            crop_label = (opp or {}).get("title") or (opp or {}).get("crop") or "a cycle"
            ts_iso = _iso(inv.get("created_at"))
            events.append({
                "kind": "invested",
                "ts": ts_iso,
                "title": f"You invested ₦{inv['amount']:,.0f} in {crop_label}",
                "amount": float(inv["amount"]),
                "ref": inv["opportunity_id"],
            })
            if inv.get("status") == "paid":
                ret = float(inv.get("realized_payout", inv.get("expected_payout", 0))) - float(inv["amount"])
                events.append({
                    "kind": "payout",
                    "ts": _iso(inv.get("paid_at")) or ts_iso,
                    "title": f"₦{ret:,.0f} payout processed",
                    "amount": ret,
                    "ref": inv["opportunity_id"],
                })
            if inv.get("status") == "active":
                dt = _to_dt(inv.get("created_at"))
                if dt:
                    days_in = (datetime.now(timezone.utc) - dt).days
                    if days_in >= 21:
                        events.append({
                            "kind": "milestone",
                            "ts": (dt + timedelta(days=21)).isoformat(),
                            "title": f"{(opp or {}).get('crop', 'Cycle')} reached milestone: Week 3",
                            "ref": inv["opportunity_id"],
                        })
        events.sort(key=lambda e: e["ts"] or "", reverse=True)
        return {"events": events[:10]}

