"""AGRIOS Market Pulse — weekly digest composer + pluggable sender.

Build digest payload from existing insights endpoints, render email HTML +
WhatsApp share text, and dispatch via a pluggable sender. The default sender
is a MOCK that writes to the `digest_log` collection and console. When
`RESEND_API_KEY` is set in the environment, the real sender kicks in
(implemented but inert until the key lands).
"""
from __future__ import annotations

import html as _html
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote

logger = logging.getLogger("agrios.digest")

# ----------------------------- helpers -----------------------------

_CURRENCY_SYMBOL = {"NGN": "₦", "GHS": "₵", "KES": "KSh ", "XOF": "CFA "}
_COUNTRY_NAME = {"NG": "Nigeria", "GH": "Ghana", "KE": "Kenya", "CI": "Côte d'Ivoire"}


def _fmt_money(amount: Optional[float], currency: str = "NGN") -> str:
    if amount is None:
        return "—"
    sym = _CURRENCY_SYMBOL.get(currency, f"{currency} ")
    return f"{sym}{int(round(amount)):,}"


def _week_bounds(ref: Optional[datetime] = None) -> Dict[str, str]:
    ref = ref or datetime.now(timezone.utc)
    start = (ref - timedelta(days=7)).date().isoformat()
    end = ref.date().isoformat()
    return {"start": start, "end": end, "label": f"Week of {start}"}


def _public_site_url() -> str:
    return os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")


# ----------------------------- composer -----------------------------


async def build_digest(db, user: Dict[str, Any], reference_date: Optional[datetime] = None) -> Dict[str, Any]:
    """Assemble a personalised digest payload for a single user."""
    role = user.get("role") or "buyer"
    country = user.get("country") or "NG"
    currency = user.get("currency") or "NGN"
    name = (user.get("full_name") or "").split(" ")[0] or "there"
    week = _week_bounds(reference_date)

    # ---- Hot crops (last 30d order velocity) ----
    now = reference_date or datetime.now(timezone.utc)
    win_30d = (now - timedelta(days=30)).isoformat()
    win_60d = (now - timedelta(days=60)).isoformat()
    cut_30d = win_30d

    active_statuses = [
        "escrow_funded",
        "in_logistics",
        "in_transit",
        "delivered",
        "completed",
    ]
    curr = await db.orders.aggregate([
        {"$match": {
            "created_at": {"$gte": win_30d},
            "status": {"$in": active_statuses},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {"_id": {"$toLower": "$crop"}, "crop": {"$first": "$crop"}, "orders": {"$sum": 1}}},
        {"$sort": {"orders": -1}},
        {"$limit": 5},
    ]).to_list(5)

    prev = {r["_id"]: r for r in await db.orders.aggregate([
        {"$match": {
            "created_at": {"$gte": win_60d, "$lt": cut_30d},
            "status": {"$in": active_statuses},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {"_id": {"$toLower": "$crop"}, "orders": {"$sum": 1}}},
    ]).to_list(100)}

    hot_crops: List[Dict[str, Any]] = []
    for c in curr:
        prev_orders = (prev.get(c["_id"]) or {}).get("orders", 0)
        pct = (
            int(round(((c["orders"] - prev_orders) / prev_orders) * 100))
            if prev_orders
            else (100 if c["orders"] > 0 else None)
        )
        # Price range from active listings for this crop (same country)
        listings = await db.listings.find(
            {
                "status": "active",
                "crop": {"$regex": f"^{c['crop']}$", "$options": "i"},
                "country_code": country,
            },
            {"_id": 0, "price_per_kg": 1, "currency": 1},
        ).to_list(100)
        prices = [l["price_per_kg"] for l in listings if l.get("price_per_kg")]
        listing_currency = (listings[0].get("currency") if listings else currency) or currency
        hot_crops.append({
            "crop": c["crop"],
            "orders": c["orders"],
            "pct_change": pct,
            "price_min": int(min(prices)) if prices else None,
            "price_max": int(max(prices)) if prices else None,
            "currency": listing_currency,
            "available_listings": len(listings),
        })

    # Fallback if no order history — surface top-viewed listings grouped by crop
    if not hot_crops:
        fallback = await db.listings.find(
            {"status": "active", "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}}, "country_code": country},
            {"_id": 0, "crop": 1, "price_per_kg": 1, "currency": 1, "views": 1},
        ).sort("views", -1).limit(5).to_list(5)
        for l in fallback:
            hot_crops.append({
                "crop": l["crop"],
                "orders": 0,
                "pct_change": None,
                "price_min": int(l.get("price_per_kg") or 0),
                "price_max": int(l.get("price_per_kg") or 0),
                "currency": l.get("currency", currency),
                "available_listings": 1,
            })

    # ---- Featured verified suppliers (buyer-facing) ----
    suppliers: List[Dict[str, Any]] = []
    if role in ("buyer", "admin"):
        farmers = await db.users.find(
            {"role": "farmer", "verified": True},
            {"_id": 0, "id": 1, "full_name": 1, "location": 1, "country": 1},
        ).to_list(50)
        for f in farmers:
            last = await db.listings.find_one(
                {
                    "farmer_id": f["id"],
                    "status": "active",
                    "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
                },
                {"_id": 0, "crop": 1, "created_at": 1, "id": 1, "price_per_kg": 1, "currency": 1},
                sort=[("created_at", -1)],
            )
            if not last:
                continue
            completed = await db.orders.count_documents(
                {"farmer_id": f["id"], "status": {"$in": ["delivered", "completed"]}}
            )
            suppliers.append({
                "id": f["id"],
                "name": f.get("full_name") or "Verified Farmer",
                "location": f.get("location") or "",
                "completed_orders": completed,
                "latest_crop": last["crop"],
                "latest_price": last.get("price_per_kg"),
                "latest_currency": last.get("currency", currency),
                "listing_id": last["id"],
            })
        suppliers.sort(key=lambda x: x["completed_orders"], reverse=True)
        suppliers = suppliers[:3]

    # ---- Price guidance (farmer-facing) ----
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
                    "crop": {"$regex": f"^{m['crop']}$", "$options": "i"},
                    "id": {"$ne": m["id"]},
                },
                {"_id": 0, "price_per_kg": 1},
            ).to_list(200)
            prices = sorted([p["price_per_kg"] for p in peers if p.get("price_per_kg")])
            if not prices:
                continue
            median = prices[len(prices) // 2]
            p75 = prices[int(len(prices) * 0.75)] if len(prices) > 1 else prices[0]
            your_price = m.get("price_per_kg") or 0
            if your_price > p75 * 1.1:
                verdict = "lower"
            elif your_price < median * 0.9:
                verdict = "raise"
            else:
                verdict = "fair"
            price_guidance.append({
                "crop": m["crop"],
                "your_price": your_price,
                "market_median": int(median),
                "market_p75": int(p75),
                "suggestion": verdict,
                "currency": m.get("currency", currency),
            })
        my_crops = {m["crop"].lower() for m in mine}
        for h in hot_crops:
            if h["crop"].lower() not in my_crops:
                suggest_crops.append(h)
        suggest_crops = suggest_crops[:3]

    # ---- New listings this week in user's country ----
    week_cut = (now - timedelta(days=7)).isoformat()
    new_listings = await db.listings.find(
        {
            "status": "active",
            "created_at": {"$gte": week_cut},
            "country_code": country,
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        },
        {"_id": 0, "id": 1, "crop": 1, "price_per_kg": 1, "currency": 1, "location": 1, "farmer_name": 1, "image_url": 1},
    ).sort("created_at", -1).limit(4).to_list(4)

    # ---- Headline + CTA ----
    if role == "farmer":
        top_suggest = suggest_crops[0] if suggest_crops else None
        if top_suggest and top_suggest.get("pct_change") and top_suggest["pct_change"] > 0:
            headline = f"{_COUNTRY_NAME.get(country, 'Your region')} is hungry for {top_suggest['crop']} — demand up {top_suggest['pct_change']}%"
            cta_text = f"List {top_suggest['crop']} now"
            cta_url = f"{_public_site_url()}/app/farmer/listings/new"
        elif any(pg["suggestion"] == "raise" for pg in price_guidance):
            raise_pg = next(pg for pg in price_guidance if pg["suggestion"] == "raise")
            headline = f"You're priced below the market on {raise_pg['crop']} — room to raise"
            cta_text = "Open your listings"
            cta_url = f"{_public_site_url()}/app/farmer/listings"
        else:
            headline = f"Weekly pulse — {len(hot_crops)} hot crops this week"
            cta_text = "Open dashboard"
            cta_url = f"{_public_site_url()}/app/farmer"
    else:
        top_hot = hot_crops[0] if hot_crops else None
        if top_hot and top_hot.get("pct_change") and top_hot["pct_change"] > 0:
            headline = f"Lock in {top_hot['crop']} before prices rise — demand up {top_hot['pct_change']}%"
            cta_text = f"Source {top_hot['crop']} now"
            cta_url = f"{_public_site_url()}/app/marketplace?q={quote(top_hot['crop'])}"
        else:
            headline = "Your weekly market pulse is in"
            cta_text = "Browse marketplace"
            cta_url = f"{_public_site_url()}/app/marketplace"

    # ---- WhatsApp text ----
    wa_parts = [f"🌾 *AGRIOS Market Pulse* — {week['label']}", ""]
    if hot_crops:
        wa_parts.append("🔥 *Hot this week:*")
        for h in hot_crops[:5]:
            line = f"• {h['crop']}"
            if h.get("pct_change") is not None:
                line += f" ({'+' if h['pct_change'] >= 0 else ''}{h['pct_change']}%)"
            if h.get("price_min") and h.get("price_max"):
                sym = _CURRENCY_SYMBOL.get(h["currency"], h["currency"] + " ")
                line += f" — {sym}{h['price_min']:,}–{sym}{h['price_max']:,}/kg"
            wa_parts.append(line)
        wa_parts.append("")
    if role == "farmer" and suggest_crops:
        wa_parts.append(f"💡 Farmers: consider listing {', '.join(s['crop'] for s in suggest_crops)}.")
        wa_parts.append("")
    wa_parts.append(f"👉 {cta_text}: {cta_url}")
    wa_parts.append("")
    wa_parts.append("— AGRIOS, Operating System for Agricultural Trade")
    whatsapp_text = "\n".join(wa_parts)

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
        "hot_crops": hot_crops,
        "suppliers": suppliers,
        "price_guidance": price_guidance,
        "suggest_crops": suggest_crops,
        "new_listings": new_listings,
        "whatsapp_text": whatsapp_text,
    }
    payload["html"] = render_email_html(payload)
    return payload


# ----------------------------- template -----------------------------

_EMAIL_CSS = """
<style>
  body,table,td { font-family: -apple-system, BlinkMacSystemFont, 'Inter', Segoe UI, Arial, sans-serif; }
  .wrap { max-width: 640px; margin: 0 auto; background:#ffffff; }
  .brand { background: linear-gradient(135deg, #0F5132 0%, #0B3D24 100%); color:#fff; padding:28px 32px; }
  .brand h1 { font-size:22px; margin:0; font-weight:800; letter-spacing:-0.01em; }
  .brand .tag { font-size:11px; text-transform:uppercase; letter-spacing:0.1em; opacity:0.75; }
  .section { padding: 28px 32px; border-bottom:1px solid #F4F4F5; }
  .section h2 { font-size:18px; margin:0 0 6px; color:#18181B; font-weight:700; }
  .section p { font-size:14px; color:#52525B; margin:0 0 16px; line-height:1.55; }
  .card { background:#FAFAFA; border:1px solid #F4F4F5; border-radius:16px; padding:16px; margin-bottom:10px; }
  .headline { font-size:28px; font-weight:800; color:#18181B; letter-spacing:-0.02em; line-height:1.2; margin:0 0 8px; }
  .pill { display:inline-block; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
  .pill-hot { background:#FEF2F2; color:#B91C1C; }
  .pill-good { background:#ECFDF5; color:#0F5132; }
  .pill-warn { background:#FEF3C7; color:#92400E; }
  .cta { display:inline-block; background:#0F5132; color:#fff !important; text-decoration:none; font-weight:700; padding:14px 28px; border-radius:999px; margin-top:8px; }
  .foot { padding:22px 32px; background:#FAFAFA; color:#71717A; font-size:11px; text-align:center; }
  .row { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:10px 0; border-bottom:1px solid #F4F4F5; }
  .row:last-child { border-bottom:none; }
  .muted { color:#71717A; font-size:12px; }
  a { color:#0F5132; }
</style>
"""


def _pct_badge(pct: Optional[int]) -> str:
    if pct is None:
        return '<span class="pill pill-warn">new</span>'
    if pct > 0:
        return f'<span class="pill pill-hot">+{pct}%</span>'
    if pct < 0:
        return f'<span class="pill pill-good">{pct}%</span>'
    return '<span class="pill pill-warn">flat</span>'


def render_email_html(p: Dict[str, Any]) -> str:
    """Render the digest payload to a premium branded HTML email."""
    e = _html.escape
    currency = p.get("currency", "NGN")

    hot_rows = []
    for h in (p.get("hot_crops") or [])[:5]:
        price = ""
        if h.get("price_min") and h.get("price_max"):
            price = f"{_fmt_money(h['price_min'], h['currency'])}–{_fmt_money(h['price_max'], h['currency'])}/kg"
        hot_rows.append(
            f"""
            <div class="row">
              <div>
                <div style="font-weight:700;color:#18181B;">{e(h['crop'])}</div>
                <div class="muted">{e(price) or '—'} · {h.get('available_listings', 0)} listing(s)</div>
              </div>
              <div style="text-align:right;">{_pct_badge(h.get('pct_change'))}</div>
            </div>
            """
        )

    supplier_rows = []
    for s in p.get("suppliers") or []:
        supplier_rows.append(
            f"""
            <div class="row">
              <div>
                <div style="font-weight:700;color:#18181B;">{e(s['name'])}</div>
                <div class="muted">{e(s['location'] or '')} · {s['completed_orders']} completed</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;color:#0F5132;">{e(s['latest_crop'])}</div>
                <div class="muted">{_fmt_money(s.get('latest_price'), s.get('latest_currency', currency))}/kg</div>
              </div>
            </div>
            """
        )

    guidance_rows = []
    for g in p.get("price_guidance") or []:
        tone = (
            "pill-good" if g["suggestion"] == "raise"
            else "pill-hot" if g["suggestion"] == "lower"
            else "pill-warn"
        )
        label = {"raise": "Raise price", "lower": "Above market", "fair": "Priced fairly"}[g["suggestion"]]
        guidance_rows.append(
            f"""
            <div class="row">
              <div>
                <div style="font-weight:700;color:#18181B;">{e(g['crop'])}</div>
                <div class="muted">You: {_fmt_money(g['your_price'], g['currency'])} · Median {_fmt_money(g['market_median'], g['currency'])} · P75 {_fmt_money(g['market_p75'], g['currency'])}</div>
              </div>
              <div style="text-align:right;"><span class="pill {tone}">{label}</span></div>
            </div>
            """
        )

    suggest_chips = ""
    if p.get("suggest_crops"):
        chips = "".join(
            f'<span class="pill pill-hot" style="margin-right:6px;">🔥 {e(s["crop"])}'
            + (f' +{s["pct_change"]}%' if s.get("pct_change") else "")
            + "</span>"
            for s in p["suggest_crops"]
        )
        suggest_chips = f"""
        <div class="section">
          <h2>Hot crops you're not listing yet</h2>
          <p>Close the gap — buyers are actively sourcing.</p>
          {chips}
        </div>
        """

    new_listings_block = ""
    if p.get("new_listings"):
        items = "".join(
            f"""
            <div class="row">
              <div>
                <div style="font-weight:700;color:#18181B;">{e(l['crop'])}</div>
                <div class="muted">{e(l.get('farmer_name',''))} · {e(l.get('location',''))}</div>
              </div>
              <div style="text-align:right;"><div style="font-weight:700;">{_fmt_money(l.get('price_per_kg'), l.get('currency', currency))}/kg</div></div>
            </div>
            """
            for l in p["new_listings"][:4]
        )
        new_listings_block = f"""
        <div class="section">
          <h2>New this week in {e(_COUNTRY_NAME.get(p['country'], p['country']))}</h2>
          <p>{len(p['new_listings'])} fresh listing(s) added in the last 7 days.</p>
          {items}
        </div>
        """

    supplier_block = f"""
        <div class="section">
          <h2>Featured verified suppliers</h2>
          <p>Top-trust farmers currently active on AGRIOS.</p>
          {''.join(supplier_rows)}
        </div>
        """ if supplier_rows else ""

    guidance_block = f"""
        <div class="section">
          <h2>Your price vs the market</h2>
          <p>Where your listings stand against verified peers.</p>
          {''.join(guidance_rows)}
        </div>
        """ if guidance_rows else ""

    return f"""<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>{_EMAIL_CSS}</head>
<body style="background:#F4F4F5;margin:0;padding:24px;">
  <div class="wrap">
    <div class="brand">
      <div class="tag">AGRIOS · Market Pulse</div>
      <h1>{e(p['period']['label'])}</h1>
    </div>

    <div class="section" style="border-bottom:none;padding-bottom:12px;">
      <div class="muted" style="margin-bottom:6px;">Hi {e(p['name'])} 👋</div>
      <div class="headline">{e(p['headline'])}</div>
      <a class="cta" href="{e(p['cta_url'])}">{e(p['cta_text'])} →</a>
    </div>

    <div class="section">
      <h2>🔥 Hot demand this week</h2>
      <p>Top crops by order velocity across AGRIOS.</p>
      {''.join(hot_rows) or '<p class="muted">No strong signals yet — still a quiet week.</p>'}
    </div>

    {supplier_block}
    {guidance_block}
    {suggest_chips}
    {new_listings_block}

    <div class="section" style="text-align:center;">
      <a class="cta" href="{e(p['cta_url'])}">{e(p['cta_text'])} →</a>
    </div>

    <div class="foot">
      You're receiving this weekly digest from AGRIOS — the Operating System for Agricultural Trade.<br/>
      Manage your digest preferences in your <a href="{e(_public_site_url())}/app/digest">settings</a>.
    </div>
  </div>
</body></html>
"""


# ----------------------------- sender (pluggable) -----------------------------


async def send_email(db, *, to: str, subject: str, html: str, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Dispatch an email. Falls back to MOCK when RESEND_API_KEY not set.

    Every call is persisted to `digest_log` for full audit — regardless of
    whether real sending happens.
    """
    entry = {
        "to": to,
        "subject": subject,
        "html_bytes": len(html or ""),
        "meta": meta or {},
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "provider": "mock",
        "status": "logged",
        "error": None,
    }

    api_key = os.environ.get("RESEND_API_KEY")
    from_addr = os.environ.get("RESEND_FROM", "AGRIOS <no-reply@agrios.africa>")

    if api_key:
        try:
            import httpx  # lazy import — only hit when configured

            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"from": from_addr, "to": [to], "subject": subject, "html": html},
                )
                if r.status_code >= 300:
                    entry["provider"] = "resend"
                    entry["status"] = "failed"
                    entry["error"] = r.text[:500]
                else:
                    entry["provider"] = "resend"
                    entry["status"] = "sent"
                    entry["resend_id"] = r.json().get("id")
        except Exception as exc:  # noqa: BLE001
            entry["provider"] = "resend"
            entry["status"] = "failed"
            entry["error"] = str(exc)[:500]
    else:
        # MOCK path — log and move on
        logger.info("[digest-mock] to=%s subject=%s bytes=%d", to, subject, len(html or ""))

    await db.digest_log.insert_one(entry.copy())
    entry.pop("_id", None)
    return entry


def wa_share_url(text: str) -> str:
    return f"https://wa.me/?text={quote(text)}"
