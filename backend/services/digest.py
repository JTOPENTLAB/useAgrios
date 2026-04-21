"""AGRIOS Market Pulse — weekly digest composer + pluggable sender.

- Rich HTML + plain-text email matching AGRIOS brand spec
- WhatsApp variants: buyer / farmer / dormant — auto-selected
- Pluggable sender: mock | resend | sendgrid via EMAIL_PROVIDER env
"""
from __future__ import annotations

import hashlib
import html as _html
import logging
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from . import config as cfg

logger = logging.getLogger("agrios.digest")

_CURRENCY_SYMBOL = {"NGN": "₦", "GHS": "₵", "KES": "KSh ", "XOF": "CFA "}
_COUNTRY_NAME = {"NG": "Nigeria", "GH": "Ghana", "KE": "Kenya", "CI": "Côte d'Ivoire"}


def _fmt_money(amount: Optional[float], currency: str = "NGN") -> str:
    if amount is None:
        return "—"
    sym = _CURRENCY_SYMBOL.get(currency, f"{currency} ")
    return f"{sym}{int(round(amount)):,}"


def _fmt_range(lo: Optional[int], hi: Optional[int], currency: str) -> str:
    if not lo or not hi:
        return "—"
    sym = _CURRENCY_SYMBOL.get(currency, f"{currency} ")
    if lo == hi:
        return f"{sym}{lo:,}/kg"
    return f"{sym}{lo:,}–{sym}{hi:,}/kg"


def _week_bounds(ref: Optional[datetime] = None) -> Dict[str, str]:
    ref = ref or datetime.now(timezone.utc)
    start = (ref - timedelta(days=7)).date().isoformat()
    end = ref.date().isoformat()
    return {"start": start, "end": end, "label": f"Week of {start}"}


# --------------------------- composer ---------------------------


async def _hot_crops(db, country: str, reference: datetime, limit: int = 5) -> List[Dict[str, Any]]:
    active = ["escrow_funded", "in_logistics", "in_transit", "delivered", "completed"]
    win_30 = (reference - timedelta(days=30)).isoformat()
    win_60 = (reference - timedelta(days=60)).isoformat()

    curr = await db.orders.aggregate([
        {"$match": {
            "created_at": {"$gte": win_30},
            "status": {"$in": active},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {"_id": {"$toLower": "$crop"}, "crop": {"$first": "$crop"}, "orders": {"$sum": 1}}},
        {"$sort": {"orders": -1}},
        {"$limit": limit},
    ]).to_list(limit)

    prev = {r["_id"]: r for r in await db.orders.aggregate([
        {"$match": {
            "created_at": {"$gte": win_60, "$lt": win_30},
            "status": {"$in": active},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {"_id": {"$toLower": "$crop"}, "orders": {"$sum": 1}}},
    ]).to_list(100)}

    out: List[Dict[str, Any]] = []
    for c in curr:
        prev_n = (prev.get(c["_id"]) or {}).get("orders", 0)
        pct = (int(round((c["orders"] - prev_n) / prev_n * 100)) if prev_n else (100 if c["orders"] else None))
        lx = await db.listings.find(
            {"status": "active", "crop": {"$regex": f"^{c['crop']}$", "$options": "i"}, "country_code": country},
            {"_id": 0, "price_per_kg": 1, "currency": 1, "location": 1},
        ).to_list(200)
        prices = [x["price_per_kg"] for x in lx if x.get("price_per_kg")]
        currency = (lx[0].get("currency") if lx else cfg.PAYMENT_CURRENCY_DEFAULT)
        level = "High" if pct and pct >= 15 else ("Rising" if pct and pct >= 5 else "Steady")
        out.append({
            "crop": c["crop"],
            "orders": c["orders"],
            "pct_change": pct,
            "price_min": int(min(prices)) if prices else None,
            "price_max": int(max(prices)) if prices else None,
            "currency": currency,
            "available_listings": len(lx),
            "level": level,
        })

    if not out:
        # Fallback: top-viewed active listings
        fb = await db.listings.find(
            {"status": "active", "country_code": country, "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}}},
            {"_id": 0, "crop": 1, "price_per_kg": 1, "currency": 1},
        ).sort("views", -1).limit(limit).to_list(limit)
        for l in fb:
            out.append({
                "crop": l["crop"],
                "orders": 0,
                "pct_change": None,
                "price_min": int(l.get("price_per_kg") or 0),
                "price_max": int(l.get("price_per_kg") or 0),
                "currency": l.get("currency", cfg.PAYMENT_CURRENCY_DEFAULT),
                "available_listings": 1,
                "level": "Steady",
            })
    return out


async def _regional_snapshot(db, country: str, hot_crops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """For each hot crop, compute min-max price range per region (listing.location)."""
    snapshot: List[Dict[str, Any]] = []
    for h in hot_crops[:5]:
        rows = await db.listings.aggregate([
            {"$match": {
                "status": "active",
                "country_code": country,
                "crop": {"$regex": f"^{h['crop']}$", "$options": "i"},
            }},
            {"$group": {"_id": "$location", "lo": {"$min": "$price_per_kg"}, "hi": {"$max": "$price_per_kg"}, "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
            {"$limit": 1},
        ]).to_list(1)
        if not rows:
            continue
        r = rows[0]
        snapshot.append({
            "region": r["_id"] or "—",
            "crop": h["crop"],
            "price_min": int(r["lo"]),
            "price_max": int(r["hi"]),
            "currency": h["currency"],
            "listings": r["n"],
        })
    return snapshot


async def _new_verified_suppliers(db, country: str, reference: datetime) -> List[Dict[str, Any]]:
    """Verified farmers with at least one listing published in the last 7 days."""
    week = (reference - timedelta(days=7)).isoformat()
    fresh = await db.listings.aggregate([
        {"$match": {
            "status": "active",
            "country_code": country,
            "created_at": {"$gte": week},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {
            "_id": "$farmer_id",
            "farmer_name": {"$first": "$farmer_name"},
            "location": {"$first": "$location"},
            "count": {"$sum": 1},
            "crops": {"$addToSet": "$crop"},
        }},
    ]).to_list(200)

    farmer_ids = [r["_id"] for r in fresh if r.get("_id")]
    verified_map = {
        u["id"]: True
        for u in await db.users.find(
            {"id": {"$in": farmer_ids}, "verified": True}, {"_id": 0, "id": 1}
        ).to_list(500)
    }

    out = []
    for r in fresh:
        if not verified_map.get(r["_id"]):
            continue
        out.append({
            "id": r["_id"],
            "name": r.get("farmer_name") or "Verified Farmer",
            "location": r.get("location") or "",
            "listings": r["count"],
            "crops": sorted(r.get("crops") or [])[:3],
            "headline_crop": (sorted(r.get("crops") or []) or [""])[0],
        })
    out.sort(key=lambda x: x["listings"], reverse=True)
    return out[:5]


async def _price_guidance_delta(db, country: str, reference: datetime, hot_crops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Week-over-week change in median asking price per hot crop within the country."""
    this_week = (reference - timedelta(days=7)).isoformat()
    last_week_lo = (reference - timedelta(days=14)).isoformat()

    out: List[Dict[str, Any]] = []
    for h in hot_crops:
        curr = await db.listings.find(
            {"status": "active", "country_code": country, "crop": {"$regex": f"^{h['crop']}$", "$options": "i"}, "created_at": {"$gte": this_week}},
            {"_id": 0, "price_per_kg": 1},
        ).to_list(500)
        prev = await db.listings.find(
            {"status": "active", "country_code": country, "crop": {"$regex": f"^{h['crop']}$", "$options": "i"}, "created_at": {"$gte": last_week_lo, "$lt": this_week}},
            {"_id": 0, "price_per_kg": 1},
        ).to_list(500)
        cur_prices = [x["price_per_kg"] for x in curr if x.get("price_per_kg")]
        prev_prices = [x["price_per_kg"] for x in prev if x.get("price_per_kg")]
        if not cur_prices or not prev_prices:
            continue
        cur_med = statistics.median(cur_prices)
        prev_med = statistics.median(prev_prices)
        if prev_med <= 0:
            continue
        delta_pct = int(round((cur_med - prev_med) / prev_med * 100))
        out.append({"crop": h["crop"], "wow_pct": delta_pct, "median": int(cur_med), "currency": h["currency"]})
    return out


async def _active_buyers_count(db, reference: datetime) -> int:
    week = (reference - timedelta(days=7)).isoformat()
    rows = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": week}}},
        {"$group": {"_id": "$buyer_id"}},
        {"$count": "n"},
    ]).to_list(1)
    return (rows[0]["n"] if rows else 0)


def _dormant(user: Dict[str, Any], reference: datetime) -> bool:
    last = user.get("last_login_at") or user.get("created_at")
    if not last:
        return False
    try:
        dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
    except Exception:
        return False
    return (reference - dt) > timedelta(days=cfg.MARKET_PULSE_DORMANT_DAYS)


def _subject_line(payload: Dict[str, Any]) -> str:
    """Rotate between 3 subject variants — stable per user so A/B data stays clean."""
    seed = int(hashlib.md5(payload["user_id"].encode()).hexdigest(), 16) % 3
    role = payload["role"]
    hc = payload.get("hot_crops") or []
    top = hc[0]["crop"] if hc else None
    pct = hc[0].get("pct_change") if hc else None

    if role == "farmer":
        variants = [
            (f"AGRIOS Market Pulse: List {top} Now — Demand Up {pct}%" if top and pct else f"AGRIOS Market Pulse — {payload['period']['label']}"),
            "This Week's AGRIOS Market Pulse: What Farmers Should List Now",
            "Your Market Pulse: Hot Crops, Prices, Buyer Demand",
        ]
    else:
        variants = [
            (f"AGRIOS Market Pulse: {top} Demand Up {pct}% This Week" if top and pct else "AGRIOS Market Pulse — Weekly Briefing"),
            "This Week's AGRIOS Market Pulse: Hot Crops, New Suppliers, Price Signals",
            (f"Top Demand This Week: {', '.join(h['crop'] for h in hc[:3])}" if hc else "AGRIOS Market Pulse"),
        ]
    return variants[seed]


async def build_digest(db, user: Dict[str, Any], reference_date: Optional[datetime] = None) -> Dict[str, Any]:
    now = reference_date or datetime.now(timezone.utc)
    role = user.get("role") or "buyer"
    country = user.get("country") or cfg.DEFAULT_COUNTRY
    currency = user.get("currency") or cfg.PAYMENT_CURRENCY_DEFAULT
    name = (user.get("full_name") or "").split(" ")[0] or "there"
    week = _week_bounds(now)

    hot_crops = await _hot_crops(db, country, now, limit=5)
    regional_snapshot = await _regional_snapshot(db, country, hot_crops)
    new_suppliers = await _new_verified_suppliers(db, country, now)
    guidance_delta = await _price_guidance_delta(db, country, now, hot_crops)
    active_buyers = await _active_buyers_count(db, now)

    # Farmer-specific
    price_guidance: List[Dict[str, Any]] = []
    suggest_crops: List[Dict[str, Any]] = []
    if role == "farmer":
        mine = await db.listings.find(
            {"farmer_id": user["id"], "status": "active"},
            {"_id": 0, "crop": 1, "price_per_kg": 1, "currency": 1, "id": 1},
        ).to_list(20)
        for m in mine[:5]:
            peers = await db.listings.find(
                {
                    "status": "active",
                    "country_code": country,
                    "crop": {"$regex": f"^{m['crop']}$", "$options": "i"},
                    "id": {"$ne": m["id"]},
                },
                {"_id": 0, "price_per_kg": 1},
            ).to_list(300)
            prices = sorted([p["price_per_kg"] for p in peers if p.get("price_per_kg")])
            if not prices:
                continue
            median = prices[len(prices) // 2]
            p75 = prices[int(len(prices) * 0.75)] if len(prices) > 1 else prices[0]
            yp = m.get("price_per_kg") or 0
            verdict = "lower" if yp > p75 * 1.1 else ("raise" if yp < median * 0.9 else "fair")
            price_guidance.append({
                "crop": m["crop"], "your_price": yp, "market_median": int(median),
                "market_p75": int(p75), "suggestion": verdict, "currency": m.get("currency", currency),
            })
        my_crops = {m["crop"].lower() for m in mine}
        suggest_crops = [h for h in hot_crops if h["crop"].lower() not in my_crops][:3]

    # Headline + CTA
    if role == "farmer":
        top_suggest = suggest_crops[0] if suggest_crops else None
        if top_suggest and top_suggest.get("pct_change") and top_suggest["pct_change"] > 0:
            headline = f"List {top_suggest['crop']} now — buyer demand is up {top_suggest['pct_change']}%"
            cta_text = f"List {top_suggest['crop']}"
            cta_url = f"{cfg.PUBLIC_SITE_URL}/app/farmer/listings/new"
        elif any(pg["suggestion"] == "raise" for pg in price_guidance):
            r = next(pg for pg in price_guidance if pg["suggestion"] == "raise")
            headline = f"You're priced below the market on {r['crop']} — room to raise"
            cta_text = "Open your listings"
            cta_url = f"{cfg.PUBLIC_SITE_URL}/app/farmer/listings"
        else:
            headline = f"Your Market Pulse — {len(hot_crops)} hot crops this week"
            cta_text = "Open dashboard"
            cta_url = f"{cfg.PUBLIC_SITE_URL}/app/farmer"
    else:
        top = hot_crops[0] if hot_crops else None
        if top and top.get("pct_change") and top["pct_change"] > 0:
            headline = f"{top['crop']} demand is up {top['pct_change']}% — lock in supply now"
            cta_text = f"View {top['crop']} suppliers"
            cta_url = f"{cfg.PUBLIC_SITE_URL}/app/marketplace?q={quote(top['crop'])}"
        else:
            headline = "Your weekly market pulse is in"
            cta_text = "Browse marketplace"
            cta_url = f"{cfg.PUBLIC_SITE_URL}/app/marketplace"

    # Dormant-user reactivation override
    is_dormant = _dormant(user, now)
    if is_dormant:
        headline = f"You've been missed, {name} — demand is rising in your region"
        cta_text = "See this week's market pulse"
        cta_url = f"{cfg.PUBLIC_SITE_URL}/app/digest"

    preferences_url = f"{cfg.PUBLIC_SITE_URL}/app/digest"

    payload = {
        "user_id": user["id"],
        "role": role,
        "country": country,
        "currency": currency,
        "name": name,
        "period": week,
        "generated_at": now.isoformat(),
        "headline": headline,
        "cta_text": cta_text,
        "cta_url": cta_url,
        "preferences_url": preferences_url,
        "hot_crops": hot_crops,
        "regional_snapshot": regional_snapshot,
        "new_suppliers": new_suppliers,
        "price_guidance_delta": guidance_delta,
        "active_buyers": active_buyers,
        "price_guidance": price_guidance,
        "suggest_crops": suggest_crops,
        "is_dormant": is_dormant,
        "suppliers": new_suppliers,  # backward-compat for older tests
        "new_listings": [],  # backward-compat
    }
    payload["subject"] = _subject_line(payload)
    payload["whatsapp_text"] = render_whatsapp(payload)
    payload["html"] = render_email_html(payload)
    payload["text"] = render_email_text(payload)
    return payload


# --------------------------- WhatsApp ---------------------------


def render_whatsapp(p: Dict[str, Any]) -> str:
    hc = p.get("hot_crops") or []
    top = hc[0] if hc else None
    new_sup = len(p.get("new_suppliers") or [])

    if p.get("is_dormant"):
        lines = [
            f"*AGRIOS Market Pulse* — {p['period']['label']}",
            "",
            "• Demand is rising for crops in your region",
            "• New verified buyers and suppliers were active this week",
            "• Fresh price guidance is now available",
            "",
            f"Action: See this week's market pulse {p['cta_url']}",
        ]
    elif p["role"] == "farmer":
        lines = [f"*AGRIOS Market Pulse* — {p['period']['label']}", ""]
        bullets: list[str] = []
        if top and top.get("pct_change") and top["pct_change"] > 0:
            bullets.append(f"• List {top['crop']} now — buyer demand is up {top['pct_change']}%")
        delta_map = {d["crop"].lower(): d for d in (p.get("price_guidance_delta") or [])}
        for h in hc[:2]:
            d = delta_map.get(h["crop"].lower())
            if d and d["wow_pct"]:
                bullets.append(f"• {h['crop']} guidance is up {d['wow_pct']}% this week")
        bullets.append(f"• {p.get('active_buyers', 0)} verified buyers were active in your categories")
        # Ensure at least 2 bullets so farmer messages never feel thin
        if len(bullets) < 2 and hc:
            for h in hc[:3]:
                if any(h["crop"] in b for b in bullets):
                    continue
                bullets.append(f"• Consider listing {h['crop']} — active demand across AGRIOS")
                if len(bullets) >= 3:
                    break
        lines.extend(bullets)
        lines.append("")
        lines.append(f"Action: {p['cta_text']} {p['cta_url']}")
    else:  # buyer
        lines = [f"*AGRIOS Market Pulse* — {p['period']['label']}", ""]
        if top and top.get("pct_change") and top["pct_change"] > 0:
            lines.append(f"• {top['crop']} demand is up {top['pct_change']}% this week")
        if new_sup:
            lines.append(f"• {new_sup} new verified suppliers posted fresh listings")
        if p.get("regional_snapshot"):
            r = p["regional_snapshot"][0]
            lines.append(
                f"• {r['crop']} prices in {r['region']} are trending at "
                f"{_fmt_range(r['price_min'], r['price_max'], r['currency'])}"
            )
        lines.append("")
        lines.append(f"Action: {p['cta_text']} {p['cta_url']}")
    lines.append("")
    lines.append("— AGRIOS, Operating System for Agricultural Trade")
    return "\n".join(lines)


def wa_share_url(text: str) -> str:
    return f"{cfg.WHATSAPP_SHARE_BASE_URL}?text={quote(text)}"


# --------------------------- Email HTML + text ---------------------------

_EMAIL_CSS = """
<style>
  body,table,td { font-family: -apple-system, BlinkMacSystemFont, 'Inter', Segoe UI, Arial, sans-serif; }
  .wrap { max-width: 640px; margin: 0 auto; background:#ffffff; }
  .brand { background: linear-gradient(135deg, #0F5132 0%, #0B3D24 100%); color:#fff; padding:28px 32px; }
  .brand h1 { font-size:22px; margin:0; font-weight:800; letter-spacing:-0.01em; }
  .brand .tag { font-size:11px; text-transform:uppercase; letter-spacing:0.1em; opacity:0.75; }
  .section { padding: 22px 32px; border-bottom:1px solid #F4F4F5; }
  .section h2 { font-size:17px; margin:0 0 6px; color:#18181B; font-weight:700; }
  .section p { font-size:14px; color:#52525B; margin:0 0 12px; line-height:1.55; }
  .headline { font-size:26px; font-weight:800; color:#18181B; letter-spacing:-0.02em; line-height:1.22; margin:4px 0 14px; }
  .pill { display:inline-block; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
  .pill-hot { background:#FEF2F2; color:#B91C1C; }
  .pill-good { background:#ECFDF5; color:#0F5132; }
  .pill-warn { background:#FEF3C7; color:#92400E; }
  .cta { display:inline-block; background:#0F5132; color:#fff !important; text-decoration:none; font-weight:700; padding:14px 28px; border-radius:999px; }
  .foot { padding:22px 32px; background:#FAFAFA; color:#71717A; font-size:11px; text-align:center; }
  .row { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #F4F4F5; }
  .row:last-child { border-bottom:none; }
  .muted { color:#71717A; font-size:12px; }
  ul.clean { list-style:none; padding:0; margin:0; }
  ul.clean li { padding:6px 0; border-bottom:1px solid #F4F4F5; font-size:14px; color:#18181B; }
  ul.clean li:last-child { border-bottom:none; }
  a { color:#0F5132; }
</style>
"""


def _level_pill(level: str, pct: Optional[int]) -> str:
    cls = "pill-hot" if level == "High" else ("pill-warn" if level == "Rising" else "pill-good")
    txt = level + (f" ({'+' if pct and pct > 0 else ''}{pct}%)" if pct is not None else "")
    return f'<span class="pill {cls}">{txt}</span>'


def render_email_html(p: Dict[str, Any]) -> str:
    e = _html.escape

    # Top 5 hot crops
    hot_li = "".join(
        f'<li><strong>{e(h["crop"])}</strong> — {e(h.get("level","Steady"))} demand '
        + (f'({("+" if (h.get("pct_change") or 0) > 0 else "")}{h["pct_change"]}%)' if h.get("pct_change") is not None else "")
        + "</li>"
        for h in (p.get("hot_crops") or [])[:5]
    )

    # Regional price snapshot
    snapshot_li = "".join(
        f'<li>{e(r["region"])} {e(r["crop"])}: {_fmt_range(r["price_min"], r["price_max"], r["currency"])}</li>'
        for r in (p.get("regional_snapshot") or [])[:5]
    )

    # New verified suppliers
    suppliers_li = "".join(
        f'<li>{e(s["name"])} — {s["listings"]} new {e(s["headline_crop"]).lower()} listing(s) — {e(s["location"])}</li>'
        for s in (p.get("new_suppliers") or [])[:5]
    )

    # Price guidance delta
    delta_items = p.get("price_guidance_delta") or []
    if delta_items:
        delta_summary = "".join(
            f"<li>{e(d['crop'])} guidance moved <strong>{'+' if d['wow_pct']>=0 else ''}{d['wow_pct']}%</strong> week-on-week</li>"
            for d in delta_items[:5]
        )
        delta_block = f'<div class="section"><h2>Price Guidance Delta</h2><ul class="clean">{delta_summary}</ul></div>'
    else:
        delta_block = ""

    # Farmer price-guidance (their own listings vs market)
    pg_block = ""
    if p.get("price_guidance"):
        pg_items = "".join(
            f'<li><strong>{e(g["crop"])}</strong> — '
            f'you: {_fmt_money(g["your_price"], g["currency"])}, median {_fmt_money(g["market_median"], g["currency"])} '
            f'<span class="pill {"pill-good" if g["suggestion"]=="raise" else "pill-hot" if g["suggestion"]=="lower" else "pill-warn"}">'
            f'{"Room to raise" if g["suggestion"]=="raise" else "Above market" if g["suggestion"]=="lower" else "Priced fairly"}</span></li>'
            for g in p["price_guidance"]
        )
        pg_block = f'<div class="section"><h2>Your price vs the market</h2><ul class="clean">{pg_items}</ul></div>'

    # Role-specific "Verified buyer activity" (farmer) or suppliers summary (buyer)
    activity_block = ""
    if p["role"] == "farmer":
        activity_block = (
            f'<div class="section"><h2>Verified Buyer Activity</h2>'
            f'<p>{p.get("active_buyers", 0)} verified buyers were active in your crop categories this week.</p></div>'
        )

    # Top-signal headline block
    top = (p.get("hot_crops") or [None])[0]
    top_signal = ""
    if top and top.get("pct_change") and top["pct_change"] > 0:
        verb = "List" if p["role"] == "farmer" else "Lock in supply of"
        top_signal = (
            f'<div class="section"><h2>Top Signal This Week</h2>'
            f'<p><strong>{verb} {e(top["crop"])}</strong> — demand is up <strong>{top["pct_change"]}%</strong> across high-activity zones this week.</p></div>'
        )

    # Suggest-crops chips
    suggest_block = ""
    if p.get("suggest_crops"):
        chips = "".join(
            f'<span class="pill pill-hot" style="margin-right:6px;">🔥 {e(s["crop"])}'
            + (f' +{s["pct_change"]}%' if s.get("pct_change") else "")
            + "</span>"
            for s in p["suggest_crops"]
        )
        suggest_block = f'<div class="section"><h2>Hot crops you\'re not listing yet</h2><p>Close the gap — buyers are sourcing now.</p>{chips}</div>'

    greeting = f"Good morning {e(p['name'])}, here's your weekly market edge." if p["role"] == "buyer" else f"Hello {e(p['name'])}, here's what the market is telling you this week."

    return f"""<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>{_EMAIL_CSS}</head>
<body style="background:#F4F4F5;margin:0;padding:24px;">
  <div class="wrap">
    <div class="brand">
      <div class="tag">AGRIOS · Market Pulse</div>
      <h1>{e(p['period']['label'])}</h1>
    </div>

    <div class="section">
      <div class="muted">{greeting}</div>
      <div class="headline">{e(p['headline'])}</div>
      <a class="cta" href="{e(p['cta_url'])}">{e(p['cta_text'])} →</a>
    </div>

    {top_signal}

    <div class="section">
      <h2>{"Top 5 Crops in Demand" if p["role"]=="farmer" else "Top 5 Hot-Demand Crops"}</h2>
      <ul class="clean">{hot_li or '<li class="muted">No strong signals yet — still a quiet week.</li>'}</ul>
    </div>

    {f'<div class="section"><h2>Regional Price Snapshot</h2><ul class="clean">{snapshot_li}</ul></div>' if snapshot_li else ""}

    {pg_block}

    {f'<div class="section"><h2>New Verified Suppliers</h2><ul class="clean">{suppliers_li}</ul></div>' if suppliers_li else ""}

    {delta_block}

    {activity_block}

    {suggest_block}

    <div class="section" style="text-align:center;border-bottom:none;">
      <a class="cta" href="{e(p['cta_url'])}">{e(p['cta_text'])} →</a>
    </div>

    <div class="foot">
      You're receiving this because Market Pulse is enabled in your AGRIOS preferences.<br/>
      <a href="{e(p['preferences_url'])}">Manage preferences</a> · <a href="mailto:{e(cfg.SUPPORT_EMAIL)}">{e(cfg.SUPPORT_EMAIL)}</a>
    </div>
  </div>
</body></html>
"""


def render_email_text(p: Dict[str, Any]) -> str:
    """Plain-text email alternate (RFC 8058 best practice — boosts deliverability)."""
    lines: List[str] = []
    lines.append(f"AGRIOS Market Pulse — {p['period']['label']}")
    lines.append("")
    greet = (f"Good morning {p['name']}, here's your weekly market edge." if p["role"] == "buyer"
             else f"Hello {p['name']}, here's what the market is telling you this week.")
    lines.append(greet)
    lines.append("")
    lines.append(p["headline"])
    lines.append("")
    if p.get("hot_crops"):
        lines.append("Top 5 hot-demand crops:")
        for i, h in enumerate(p["hot_crops"][:5], 1):
            pct = f" ({'+' if (h.get('pct_change') or 0) > 0 else ''}{h['pct_change']}%)" if h.get("pct_change") is not None else ""
            lines.append(f"{i}. {h['crop']} — {h.get('level','Steady')} demand{pct}")
        lines.append("")
    if p.get("regional_snapshot"):
        lines.append("Regional price snapshot:")
        for r in p["regional_snapshot"][:5]:
            lines.append(f"- {r['region']} {r['crop']}: {_fmt_range(r['price_min'], r['price_max'], r['currency'])}")
        lines.append("")
    if p.get("new_suppliers"):
        lines.append("New verified suppliers:")
        for s in p["new_suppliers"][:5]:
            lines.append(f"- {s['name']} — {s['listings']} new {s['headline_crop'].lower()} listing(s) — {s['location']}")
        lines.append("")
    if p.get("price_guidance_delta"):
        lines.append("Price guidance delta:")
        for d in p["price_guidance_delta"][:5]:
            lines.append(f"- {d['crop']}: {'+' if d['wow_pct']>=0 else ''}{d['wow_pct']}% WoW")
        lines.append("")
    if p["role"] == "farmer":
        lines.append(f"Verified buyer activity: {p.get('active_buyers', 0)} verified buyers active this week.")
        lines.append("")
    lines.append(f"Action — {p['cta_text']}: {p['cta_url']}")
    lines.append("")
    lines.append(f"Manage preferences: {p['preferences_url']}")
    return "\n".join(lines)


# --------------------------- Sender (pluggable) ---------------------------


async def send_email(
    db,
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Dispatch email via configured EMAIL_PROVIDER. Always logs to digest_log."""
    entry = {
        "to": to,
        "subject": subject,
        "html_bytes": len(html or ""),
        "text_bytes": len(text or ""),
        "meta": meta or {},
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "provider": cfg.EMAIL_PROVIDER,
        "status": "logged",
        "error": None,
    }

    provider = cfg.EMAIL_PROVIDER
    try:
        if provider == "resend":
            if not cfg.RESEND_API_KEY:
                entry["provider"] = "mock"
                entry["error"] = "RESEND_API_KEY not set — fell back to mock"
            else:
                import httpx

                async with httpx.AsyncClient(timeout=10) as client:
                    body = {"from": cfg.RESEND_FROM, "to": [to], "subject": subject, "html": html}
                    if text:
                        body["text"] = text
                    if cfg.EMAIL_REPLY_TO:
                        body["reply_to"] = cfg.EMAIL_REPLY_TO
                    r = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {cfg.RESEND_API_KEY}", "Content-Type": "application/json"},
                        json=body,
                    )
                    if r.status_code >= 300:
                        entry["status"] = "failed"
                        entry["error"] = r.text[:500]
                    else:
                        entry["status"] = "sent"
                        entry["message_id"] = r.json().get("id")
        elif provider == "sendgrid":
            if not cfg.SENDGRID_API_KEY:
                entry["provider"] = "mock"
                entry["error"] = "SENDGRID_API_KEY not set — fell back to mock"
            else:
                import httpx

                async with httpx.AsyncClient(timeout=10) as client:
                    body = {
                        "personalizations": [{"to": [{"email": to}]}],
                        "from": {"email": cfg.EMAIL_FROM_ADDRESS, "name": cfg.EMAIL_FROM_NAME},
                        "subject": subject,
                        "content": [{"type": "text/plain", "value": text or ""}, {"type": "text/html", "value": html}],
                    }
                    r = await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers={"Authorization": f"Bearer {cfg.SENDGRID_API_KEY}", "Content-Type": "application/json"},
                        json=body,
                    )
                    if r.status_code >= 300:
                        entry["status"] = "failed"
                        entry["error"] = r.text[:500]
                    else:
                        entry["status"] = "sent"
                        entry["message_id"] = r.headers.get("X-Message-Id")
        else:
            # mock
            logger.info("[digest-mock] to=%s subject=%s bytes=%d", to, subject, len(html or ""))
    except Exception as exc:  # noqa: BLE001
        entry["status"] = "failed"
        entry["error"] = str(exc)[:500]

    await db.digest_log.insert_one(entry.copy())
    entry.pop("_id", None)
    return entry
