"""AGRIOS Phase D — Scale + Moat endpoints.

Registered via `register(api, db, ...)` from server.py to avoid circular imports
and keep the monolithic server.py from growing further. All routes are prefixed
with /api by the parent router.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field


# ---------------- Models ----------------

class PriceAlertCreate(BaseModel):
    crop: str = Field(..., min_length=2, max_length=80)
    country: Optional[str] = None  # defaults to user's country
    max_price_per_kg: float = Field(..., gt=0)
    min_quantity_kg: float = Field(default=0, ge=0)
    notify_channel: str = Field(default="in_app")  # in_app | email | whatsapp


def _now() -> datetime:
    return datetime.now(timezone.utc)


def register(api: APIRouter, *, db, current_user, require_roles, notify, new_id):
    """Attach Phase D routes onto the parent APIRouter."""

    # =====================================================================
    # 1. LIQUIDITY SIGNALS — "make AGRIOS feel alive"
    # =====================================================================
    @api.get("/liquidity/listing/{listing_id}")
    async def listing_liquidity(listing_id: str):
        listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
        if not listing:
            raise HTTPException(404, "Listing not found")

        crop = listing.get("crop", "")
        country = listing.get("country") or listing.get("country_code") or "NG"
        since_week = _now() - timedelta(days=7)

        # Orders completed this week for same crop (escrow_funded or later)
        orders_week = await db.orders.count_documents({
            "crop": crop,
            "created_at": {"$gte": since_week},
            "escrow_status": {"$in": ["funded", "released"]},
        })
        # Active suppliers (distinct farmers with active listings for this crop)
        suppliers_pipeline = [
            {"$match": {"crop": crop, "status": "active"}},
            {"$group": {"_id": "$farmer_id"}},
            {"$count": "n"},
        ]
        sup = await db.listings.aggregate(suppliers_pipeline).to_list(1)
        active_suppliers = sup[0]["n"] if sup else 0

        # Viewers last 24h (approximate via recent view delta — we track total views only,
        # so derive from listing "views" and age. Simple proxy: min(views, 9) for recent)
        views_total = int(listing.get("views", 0) or 0)
        # Use saves as engagement signal too
        saves_total = int(listing.get("saves", 0) or 0)
        # Simulated live viewers count based on recency + views (deterministic per-listing)
        # For a real "live" feel without socket infra.
        recent_viewers = min(max(views_total // 8, 1), 12)

        # Regional context
        same_country_count = await db.listings.count_documents({
            "crop": crop, "status": "active", "country": country,
        })

        return {
            "listing_id": listing_id,
            "crop": crop,
            "country": country,
            "recent_viewers": recent_viewers,
            "views_total": views_total,
            "saves_total": saves_total,
            "orders_completed_this_week": orders_week,
            "active_suppliers": active_suppliers,
            "suppliers_in_country": same_country_count,
            "generated_at": _now().isoformat(),
        }

    # =====================================================================
    # 2. SUPPLIER PERFORMANCE SCORE — lock-in intelligence
    # =====================================================================
    @api.get("/suppliers/{supplier_id}/performance")
    async def supplier_performance(supplier_id: str):
        user = await db.users.find_one({"id": supplier_id, "role": "farmer"}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(404, "Supplier not found")

        # Aggregate stats
        completed_cursor = db.orders.find(
            {"farmer_id": supplier_id, "escrow_status": "released"},
            {"_id": 0, "total": 1, "crop": 1, "buyer_id": 1, "created_at": 1},
        )
        completed = await completed_cursor.to_list(1000)
        completed_orders = len(completed)
        gmv = sum(float(o.get("total", 0) or 0) for o in completed)
        unique_buyers = len({o.get("buyer_id") for o in completed if o.get("buyer_id")})
        repeat_buyer_count = 0
        buyer_counts: dict[str, int] = defaultdict(int)
        for o in completed:
            if o.get("buyer_id"):
                buyer_counts[o["buyer_id"]] += 1
        repeat_buyer_count = sum(1 for c in buyer_counts.values() if c > 1)

        # Active listings
        active_listings = await db.listings.count_documents(
            {"farmer_id": supplier_id, "status": "active"},
        )

        # Reviews
        reviews = await db.reviews.find({"target_user_id": supplier_id}, {"_id": 0, "rating": 1}).to_list(500)
        avg_rating = round(sum(r.get("rating", 0) for r in reviews) / len(reviews), 2) if reviews else None
        review_count = len(reviews)

        # Disputes
        disputes_against = await db.disputes.count_documents({"against_user_id": supplier_id})

        # On-time delivery proxy: ratio of released to (funded+released) within 7d
        funded_total = await db.orders.count_documents({
            "farmer_id": supplier_id,
            "escrow_status": {"$in": ["funded", "released"]},
        })
        on_time_pct = round((completed_orders / funded_total) * 100, 1) if funded_total else None

        # Composite score 0-100
        score = 0
        score += min(completed_orders * 3, 30)       # up to 30 from volume
        score += min(int((avg_rating or 0) * 5), 25)  # up to 25 from rating (5*5)
        score += min(repeat_buyer_count * 4, 20)      # up to 20 from loyalty
        score += 15 if user.get("verified") else 0    # 15 for KYC verified
        score += 10 if active_listings >= 3 else (5 if active_listings >= 1 else 0)
        score -= min(disputes_against * 5, 25)        # up to -25
        score = max(0, min(100, score))

        # Badges
        badges: list[str] = []
        if user.get("verified"):
            badges.append("verified_pro")
        if score >= 80 and completed_orders >= 5:
            badges.append("top_supplier")
        if completed_orders >= 1 and completed_orders < 5 and score >= 60:
            badges.append("rising_star")
        if repeat_buyer_count >= 3:
            badges.append("trusted_by_buyers")

        # Best crops (by count of completed orders)
        crop_counts: dict[str, int] = defaultdict(int)
        crop_gmv: dict[str, float] = defaultdict(float)
        for o in completed:
            c = o.get("crop") or "—"
            crop_counts[c] += 1
            crop_gmv[c] += float(o.get("total", 0) or 0)
        best_crops = [
            {"crop": c, "orders": n, "gmv": round(crop_gmv[c], 2)}
            for c, n in sorted(crop_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        return {
            "supplier_id": supplier_id,
            "full_name": user.get("full_name"),
            "verified": bool(user.get("verified")),
            "country": user.get("country") or "NG",
            "score": score,
            "band": "A" if score >= 80 else ("B" if score >= 60 else ("C" if score >= 40 else "D")),
            "badges": badges,
            "metrics": {
                "completed_orders": completed_orders,
                "gmv": round(gmv, 2),
                "unique_buyers": unique_buyers,
                "repeat_buyer_count": repeat_buyer_count,
                "active_listings": active_listings,
                "avg_rating": avg_rating,
                "review_count": review_count,
                "disputes_against": disputes_against,
                "on_time_pct": on_time_pct,
            },
            "best_crops": best_crops,
        }

    # =====================================================================
    # 3. FARMER EARNINGS INTELLIGENCE
    # =====================================================================
    @api.get("/farmer/earnings")
    async def farmer_earnings(
        days: int = Query(default=90, ge=7, le=365),
        user: dict = Depends(require_roles("farmer")),
    ):
        since = _now() - timedelta(days=days)
        orders = await db.orders.find(
            {
                "farmer_id": user["id"],
                "escrow_status": "released",
                "$or": [
                    {"released_at": {"$gte": since}},
                    {"released_at": {"$exists": False}, "created_at": {"$gte": since}},
                ],
            },
            {"_id": 0, "total": 1, "farmer_amount": 1, "crop": 1, "buyer_id": 1,
             "released_at": 1, "created_at": 1, "delivery_address": 1, "quantity_kg": 1, "currency": 1},
        ).to_list(5000)

        # Fallback: if released_at missing, use created_at
        for o in orders:
            if not o.get("released_at"):
                o["released_at"] = o.get("created_at")

        # Weekly GMV time series (last N weeks)
        weekly: dict[str, dict[str, float]] = defaultdict(lambda: {"gmv": 0.0, "orders": 0, "qty": 0.0})
        for o in orders:
            dt = o.get("released_at") or _now()
            if isinstance(dt, str):
                try:
                    dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                except Exception:
                    dt = _now()
            wk = dt - timedelta(days=dt.weekday())
            wk_key = wk.date().isoformat()
            weekly[wk_key]["gmv"] += float(o.get("farmer_amount", o.get("total", 0)) or 0)
            weekly[wk_key]["orders"] += 1
            weekly[wk_key]["qty"] += float(o.get("quantity_kg", 0) or 0)

        weekly_series = sorted(
            [{"week": k, **v, "gmv": round(v["gmv"], 2)} for k, v in weekly.items()],
            key=lambda x: x["week"],
        )

        # Best crops
        crop_stats: dict[str, dict[str, float]] = defaultdict(lambda: {"gmv": 0.0, "orders": 0, "qty": 0.0})
        for o in orders:
            c = o.get("crop") or "—"
            crop_stats[c]["gmv"] += float(o.get("farmer_amount", o.get("total", 0)) or 0)
            crop_stats[c]["orders"] += 1
            crop_stats[c]["qty"] += float(o.get("quantity_kg", 0) or 0)
        best_crops = sorted(
            [{"crop": c, **s, "gmv": round(s["gmv"], 2)} for c, s in crop_stats.items()],
            key=lambda x: x["gmv"], reverse=True,
        )[:5]

        # Best regions (derived from delivery_address first token)
        region_stats: dict[str, dict[str, float]] = defaultdict(lambda: {"gmv": 0.0, "orders": 0})
        for o in orders:
            addr = (o.get("delivery_address") or "").split(",")[0].strip() or "Unknown"
            region_stats[addr]["gmv"] += float(o.get("farmer_amount", o.get("total", 0)) or 0)
            region_stats[addr]["orders"] += 1
        best_regions = sorted(
            [{"region": r, **s, "gmv": round(s["gmv"], 2)} for r, s in region_stats.items()],
            key=lambda x: x["gmv"], reverse=True,
        )[:5]

        # Repeat buyers
        buyer_counts: dict[str, int] = defaultdict(int)
        for o in orders:
            bid = o.get("buyer_id")
            if bid:
                buyer_counts[bid] += 1
        repeat_buyers: list[dict[str, Any]] = []
        for bid, n in sorted(buyer_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            if n < 2:
                continue
            buyer = await db.users.find_one({"id": bid}, {"_id": 0, "full_name": 1, "business_name": 1})
            if buyer:
                repeat_buyers.append({
                    "buyer_id": bid,
                    "name": buyer.get("business_name") or buyer.get("full_name"),
                    "orders": n,
                })

        total_gmv = round(sum(float(o.get("farmer_amount", o.get("total", 0)) or 0) for o in orders), 2)
        currency = user.get("currency") or (orders[0].get("currency") if orders else "NGN")

        return {
            "farmer_id": user["id"],
            "currency": currency,
            "period_days": days,
            "total_orders": len(orders),
            "total_gmv": total_gmv,
            "weekly_series": weekly_series,
            "best_crops": best_crops,
            "best_regions": best_regions,
            "repeat_buyers": repeat_buyers,
        }

    # =====================================================================
    # 4. PRICE ALERTS
    # =====================================================================
    @api.post("/alerts/price")
    async def create_price_alert(
        body: PriceAlertCreate, user: dict = Depends(require_roles("buyer"))
    ):
        country = (body.country or user.get("country") or "NG").upper()
        doc = {
            "id": new_id(),
            "user_id": user["id"],
            "crop": body.crop.strip(),
            "country": country,
            "max_price_per_kg": float(body.max_price_per_kg),
            "min_quantity_kg": float(body.min_quantity_kg),
            "notify_channel": body.notify_channel,
            "active": True,
            "triggered_count": 0,
            "created_at": _now(),
        }
        await db.price_alerts.insert_one(doc.copy())
        doc.pop("_id", None)
        return doc

    @api.get("/alerts/price")
    async def list_price_alerts(user: dict = Depends(require_roles("buyer"))):
        rows = await db.price_alerts.find(
            {"user_id": user["id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)
        return rows

    @api.delete("/alerts/price/{alert_id}")
    async def delete_price_alert(alert_id: str, user: dict = Depends(require_roles("buyer"))):
        res = await db.price_alerts.delete_one({"id": alert_id, "user_id": user["id"]})
        if res.deleted_count == 0:
            raise HTTPException(404, "Alert not found")
        return {"ok": True}

    async def check_alerts_for_listing(listing: dict) -> int:
        """Called from server.py after listing creation. Returns matched alerts count."""
        crop = listing.get("crop", "")
        country = (listing.get("country") or listing.get("country_code") or "NG").upper()
        price = float(listing.get("price_per_kg", 0) or 0)
        qty = float(listing.get("qty_available_kg", listing.get("quantity_kg", 0)) or 0)

        alerts = await db.price_alerts.find({
            "active": True,
            "crop": {"$regex": f"^{re.escape(crop)}$", "$options": "i"},
            "country": country,
            "max_price_per_kg": {"$gte": price},
        }, {"_id": 0}).to_list(500)

        matched = 0
        for a in alerts:
            if qty < float(a.get("min_quantity_kg", 0) or 0):
                continue
            matched += 1
            await db.price_alerts.update_one(
                {"id": a["id"]},
                {"$inc": {"triggered_count": 1}, "$set": {"last_triggered_at": _now()}},
            )
            await notify(
                a["user_id"],
                f"Price alert 🔔 {crop}",
                f"New listing matched: {crop} @ {price:,.0f}/kg · {qty:,.0f}kg available.",
                "price_alert",
                listing.get("id"),
            )
        return matched

    # Expose this to the outside so server.py can trigger it.
    register.check_alerts_for_listing = check_alerts_for_listing  # type: ignore[attr-defined]

    # =====================================================================
    # 5. MARKET INTELLIGENCE v2 — price trend + demand heatmap
    # =====================================================================
    @api.get("/market/price-trend")
    async def price_trend(
        crop: str = Query(..., min_length=2),
        country: Optional[str] = None,
        days: int = Query(default=60, ge=7, le=365),
    ):
        since = _now() - timedelta(days=days)
        filt: dict[str, Any] = {
            "crop": {"$regex": f"^{re.escape(crop)}$", "$options": "i"},
            "created_at": {"$gte": since},
            "escrow_status": {"$in": ["funded", "released"]},
        }
        if country:
            filt["country"] = country.upper()
        orders = await db.orders.find(
            filt, {"_id": 0, "price_per_kg": 1, "created_at": 1, "quantity_kg": 1, "currency": 1},
        ).to_list(5000)

        # Daily median price
        daily: dict[str, list[float]] = defaultdict(list)
        daily_vol: dict[str, float] = defaultdict(float)
        for o in orders:
            dt = o.get("created_at")
            if isinstance(dt, str):
                try:
                    dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                except Exception:
                    continue
            if not dt:
                continue
            d = dt.date().isoformat()
            p = float(o.get("price_per_kg", 0) or 0)
            if p > 0:
                daily[d].append(p)
            daily_vol[d] += float(o.get("quantity_kg", 0) or 0)

        def _median(xs: list[float]) -> float:
            if not xs:
                return 0
            s = sorted(xs)
            mid = len(s) // 2
            return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2

        series = [
            {"date": d, "median_price": round(_median(p), 2), "volume_kg": round(daily_vol[d], 2), "n_orders": len(p)}
            for d, p in sorted(daily.items())
        ]

        # Listing snapshot for forward-looking price range
        listings = await db.listings.find(
            {"crop": {"$regex": f"^{re.escape(crop)}$", "$options": "i"}, "status": "active",
             **({"country": country.upper()} if country else {})},
            {"_id": 0, "price_per_kg": 1, "country": 1, "location": 1},
        ).to_list(500)

        prices = [float(x.get("price_per_kg", 0) or 0) for x in listings if x.get("price_per_kg")]
        snapshot = {
            "active_listings": len(listings),
            "min_price": round(min(prices), 2) if prices else None,
            "median_price": round(_median(prices), 2) if prices else None,
            "max_price": round(max(prices), 2) if prices else None,
        }

        # Week-over-week delta
        now_ts = _now()
        week_ago = now_ts - timedelta(days=7)
        two_week = now_ts - timedelta(days=14)
        this_wk = [p for d, ps in daily.items()
                   if datetime.fromisoformat(d).replace(tzinfo=timezone.utc) >= week_ago
                   for p in ps]
        prev_wk = [p for d, ps in daily.items()
                   if two_week <= datetime.fromisoformat(d).replace(tzinfo=timezone.utc) < week_ago
                   for p in ps]
        wow_pct = None
        if this_wk and prev_wk:
            a, b = _median(this_wk), _median(prev_wk)
            if b:
                wow_pct = round(((a - b) / b) * 100, 1)

        return {
            "crop": crop,
            "country": country,
            "days": days,
            "series": series,
            "snapshot": snapshot,
            "wow_pct": wow_pct,
        }

    @api.get("/market/demand-heatmap")
    async def demand_heatmap(days: int = Query(default=30, ge=7, le=180)):
        since = _now() - timedelta(days=days)
        orders = await db.orders.find(
            {
                "created_at": {"$gte": since},
                "escrow_status": {"$in": ["funded", "released"]},
            },
            {"_id": 0, "crop": 1, "country": 1, "delivery_address": 1, "total": 1, "quantity_kg": 1},
        ).to_list(10000)

        # Matrix: region -> crop -> {gmv, qty, orders}
        matrix: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"gmv": 0.0, "qty": 0.0, "orders": 0}))
        region_totals: dict[str, float] = defaultdict(float)
        crop_totals: dict[str, float] = defaultdict(float)

        for o in orders:
            crop = (o.get("crop") or "—").title()
            region = (o.get("delivery_address") or "").split(",")[0].strip() or "Unknown"
            # Filter TEST data
            if crop.lower().startswith("test_"):
                continue
            gmv = float(o.get("total", 0) or 0)
            qty = float(o.get("quantity_kg", 0) or 0)
            matrix[region][crop]["gmv"] += gmv
            matrix[region][crop]["qty"] += qty
            matrix[region][crop]["orders"] += 1
            region_totals[region] += gmv
            crop_totals[crop] += gmv

        # Top N
        top_regions = sorted(region_totals.items(), key=lambda x: x[1], reverse=True)[:8]
        top_crops = sorted(crop_totals.items(), key=lambda x: x[1], reverse=True)[:8]

        rows = []
        for region, _rt in top_regions:
            cells = []
            for crop, _ct in top_crops:
                v = matrix.get(region, {}).get(crop, {"gmv": 0.0, "qty": 0.0, "orders": 0})
                cells.append({
                    "crop": crop,
                    "gmv": round(v["gmv"], 2),
                    "qty": round(v["qty"], 2),
                    "orders": int(v["orders"]),
                })
            rows.append({
                "region": region,
                "total_gmv": round(region_totals[region], 2),
                "cells": cells,
            })

        max_gmv = max((c["gmv"] for r in rows for c in r["cells"]), default=0)

        return {
            "days": days,
            "crops": [c for c, _ in top_crops],
            "regions": [r for r, _ in top_regions],
            "rows": rows,
            "max_gmv": round(max_gmv, 2),
            "generated_at": _now().isoformat(),
        }

    # =====================================================================
    # 6. GROWTH — invite link + KPI dashboard (admin)
    # =====================================================================
    @api.get("/growth/invite")
    async def my_invite(user: dict = Depends(require_roles("buyer", "farmer"))):
        code = user.get("referral_code") or ""
        from os import environ
        base = environ.get("PUBLIC_SITE_URL") or ""
        link = f"{base.rstrip('/')}/signup?ref={code}" if base else f"/signup?ref={code}"
        referred = await db.users.count_documents({"referred_by": user["id"]})
        return {
            "code": code,
            "link": link,
            "referred_count": referred,
            "whatsapp_text": f"Join me on AGRIOS — Africa's agricultural trade OS. Buyers get a signup bonus. Use my link: {link}",
        }

    @api.get("/admin/kpis")
    async def admin_kpis(user: dict = Depends(require_roles("admin"))):
        now = _now()
        wk = now - timedelta(days=7)
        mo = now - timedelta(days=30)

        async def _count(coll, filt):
            return await coll.count_documents(filt)

        gmv_pipeline_week = [
            {"$match": {"escrow_status": {"$in": ["funded", "released"]}, "created_at": {"$gte": wk}}},
            {"$group": {"_id": None, "gmv": {"$sum": "$total"}}},
        ]
        gmv_pipeline_month = [
            {"$match": {"escrow_status": {"$in": ["funded", "released"]}, "created_at": {"$gte": mo}}},
            {"$group": {"_id": None, "gmv": {"$sum": "$total"}}},
        ]
        gmv_week_r = await db.orders.aggregate(gmv_pipeline_week).to_list(1)
        gmv_month_r = await db.orders.aggregate(gmv_pipeline_month).to_list(1)

        active_farmers_7d = len(await db.listings.distinct("farmer_id", {"created_at": {"$gte": wk}}))
        active_buyers_7d = len(await db.orders.distinct("buyer_id", {"created_at": {"$gte": wk}}))

        escrow_held_agg = await db.wallets.aggregate([
            {"$group": {"_id": None, "held": {"$sum": "$escrow_held"}}}
        ]).to_list(1)

        repeat_orders = 0
        repeat_pipeline = [
            {"$match": {"escrow_status": "released"}},
            {"$group": {"_id": "$buyer_id", "n": {"$sum": 1}}},
            {"$match": {"n": {"$gt": 1}}},
            {"$count": "n"},
        ]
        repeat_r = await db.orders.aggregate(repeat_pipeline).to_list(1)
        if repeat_r:
            repeat_orders = repeat_r[0]["n"]

        loan_volume_agg = await db.loans.aggregate([
            {"$match": {"status": {"$in": ["disbursed", "repaying", "closed"]}}},
            {"$group": {"_id": None, "v": {"$sum": "$amount"}}},
        ]).to_list(1)

        return {
            "gmv_7d": round((gmv_week_r[0]["gmv"] if gmv_week_r else 0) or 0, 2),
            "gmv_30d": round((gmv_month_r[0]["gmv"] if gmv_month_r else 0) or 0, 2),
            "active_farmers_7d": active_farmers_7d,
            "active_buyers_7d": active_buyers_7d,
            "orders_7d": await _count(db.orders, {"created_at": {"$gte": wk}}),
            "orders_30d": await _count(db.orders, {"created_at": {"$gte": mo}}),
            "escrow_locked": round((escrow_held_agg[0]["held"] if escrow_held_agg else 0) or 0, 2),
            "total_users": await _count(db.users, {}),
            "total_listings": await _count(db.listings, {"status": "active"}),
            "repeat_buyers": repeat_orders,
            "loan_volume": round((loan_volume_agg[0]["v"] if loan_volume_agg else 0) or 0, 2),
            "price_alerts_active": await _count(db.price_alerts, {"active": True}),
            "generated_at": now.isoformat(),
        }

    # Return helpers for server.py to wire in.
    return {"check_alerts_for_listing": check_alerts_for_listing}
