"""AGRIOS Phase O — Cohort retention weekly digest.

Every Monday 09:00 local (configurable UTC hour), email each admin a compact
summary of last-week's cohort retention + deltas vs the prior week.

Endpoints:
  • GET  /api/admin/cohort-digest/preview      — admin, preview HTML + text
  • POST /api/admin/cohort-digest/send-me-now  — admin, sends to self
  • POST /api/admin/cohort-digest/trigger      — admin, blasts to all admins
  • GET  /api/admin/cohort-digest/log          — admin, audit trail

Scheduler:
  • Hourly tick; fires once per Monday at COHORT_DIGEST_HOUR_UTC
  • Idempotent via system.cohort_digest_last_run
  • Controlled by ENABLE_CRON + FEATURE_MARKET_PULSE (reuses existing flags)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from services import digest as digest_service
from services import config as cfg_module

logger = logging.getLogger("agrios.cohort_digest")

MILESTONES = [1, 2, 4, 8]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _monday(dt: datetime) -> datetime:
    d = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return d - timedelta(days=d.weekday())


async def _compute_cohort_snapshot(db, weeks: int = 8) -> Dict[str, Any]:
    """Reuse the same math as /api/admin/cohorts/retention but as a pure fn."""
    weeks = max(2, min(weeks, 26))
    now = _now()
    current_monday = _monday(now)
    window_start = current_monday - timedelta(weeks=weeks - 1)

    users = await db.users.find(
        {"role": "investor", "created_at": {"$gte": window_start}},
        {"_id": 0, "id": 1, "created_at": 1},
    ).to_list(length=5000)

    agg = db.investments.aggregate([
        {"$match": {"created_at": {"$gte": window_start}}},
        {"$group": {"_id": "$investor_id", "first_at": {"$min": "$created_at"}}},
    ])
    first_by_user = {r["_id"]: r["first_at"] for r in await agg.to_list(length=10000)}

    cohorts = []
    for i in range(weeks):
        week_start = window_start + timedelta(weeks=i)
        cohorts.append({
            "week_start": week_start,
            "label": week_start.strftime("%b %d"),
            "size": 0,
            "retention": {m: {"count": 0, "pct": 0.0, "eligible": True} for m in MILESTONES},
        })

    for u in users:
        created = u.get("created_at")
        if not created:
            continue
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        idx = (created - window_start).days // 7
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
        for m in MILESTONES:
            if weeks_elapsed <= m:
                cohorts[idx]["retention"][m]["count"] += 1

    for i, c in enumerate(cohorts):
        cohort_start_dt = window_start + timedelta(weeks=i)
        weeks_since = (now - cohort_start_dt).days / 7.0
        for m in MILESTONES:
            cell = c["retention"][m]
            cell["eligible"] = weeks_since >= m
            cell["pct"] = round(100.0 * cell["count"] / c["size"], 1) if c["size"] > 0 else 0.0

    # Overall (eligible cells only)
    totals = {m: 0 for m in MILESTONES}
    eligible_size = {m: 0 for m in MILESTONES}
    for c in cohorts:
        for m in MILESTONES:
            if c["retention"][m]["eligible"]:
                totals[m] += c["retention"][m]["count"]
                eligible_size[m] += c["size"]
    overall = {
        m: {
            "pct": round(100.0 * totals[m] / eligible_size[m], 1) if eligible_size[m] > 0 else 0.0,
            "count": totals[m],
            "eligible_size": eligible_size[m],
        }
        for m in MILESTONES
    }

    return {
        "weeks": weeks,
        "window_start": window_start,
        "cohorts": cohorts,
        "overall": overall,
        "total_signups": sum(c["size"] for c in cohorts),
    }


async def _period_metrics(db, since: datetime, until: datetime) -> Dict[str, Any]:
    """Growth + funnel metrics for a window."""
    signups = await db.users.count_documents({"created_at": {"$gte": since, "$lt": until}})
    signups_investor = await db.users.count_documents({
        "role": "investor", "created_at": {"$gte": since, "$lt": until}
    })
    depositors = await db.ledger.distinct("user_id", {
        "kind": "fund", "created_at": {"$gte": since, "$lt": until}
    })
    investors = await db.investments.distinct("investor_id", {
        "created_at": {"$gte": since, "$lt": until}
    })
    invs_cur = db.investments.aggregate([
        {"$match": {"created_at": {"$gte": since, "$lt": until}}},
        {"$group": {"_id": None, "v": {"$sum": "$amount"}, "n": {"$sum": 1}}},
    ])
    invs = await invs_cur.to_list(1)
    total_invested = float((invs[0]["v"] if invs else 0) or 0)
    invest_count = int((invs[0]["n"] if invs else 0) or 0)
    return {
        "signups": signups,
        "signups_investor": signups_investor,
        "depositors": len(depositors),
        "first_investors": len(investors),
        "total_invested": total_invested,
        "invest_count": invest_count,
    }


def _delta_badge(new: float, old: float, unit: str = "pts") -> str:
    if old == 0 and new == 0:
        return "—"
    d = round(new - old, 1)
    if d > 0:
        return f"↑ {d} {unit}"
    if d < 0:
        return f"↓ {abs(d)} {unit}"
    return f"→ 0 {unit}"


async def build_cohort_digest(db) -> Dict[str, Any]:
    """Compose the full digest payload for admins."""
    now = _now()
    current_monday = _monday(now)
    last_week_start = current_monday - timedelta(weeks=1)
    prev_week_start = current_monday - timedelta(weeks=2)

    snapshot = await _compute_cohort_snapshot(db, weeks=8)

    # Week-over-week period metrics
    last_week = await _period_metrics(db, last_week_start, current_monday)
    prev_week = await _period_metrics(db, prev_week_start, last_week_start)

    # Overall retention deltas — compare the last two cohorts that are eligible for each milestone
    # We look at the row index = weeks-1 (current) and weeks-2 (previous) for W+1 eligibility primarily
    cohorts = snapshot["cohorts"]
    retention_deltas = {}
    for m in MILESTONES:
        # Find the 2 most-recent eligible cohorts for this milestone
        eligible = [c for c in cohorts if c["retention"][m]["eligible"] and c["size"] > 0]
        if len(eligible) >= 2:
            cur = eligible[-1]["retention"][m]["pct"]
            prev = eligible[-2]["retention"][m]["pct"]
            retention_deltas[m] = {
                "current": cur,
                "previous": prev,
                "badge": _delta_badge(cur, prev),
            }
        elif len(eligible) == 1:
            retention_deltas[m] = {
                "current": eligible[-1]["retention"][m]["pct"],
                "previous": None,
                "badge": "first data point",
            }
        else:
            retention_deltas[m] = {
                "current": None, "previous": None, "badge": "no eligible cohort yet"
            }

    # Headline — most notable change
    headline = "AGRIOS weekly launch pulse"
    if last_week["first_investors"] > 0 and prev_week["first_investors"] == 0:
        headline = f"🎉 First {last_week['first_investors']} investor{'s' if last_week['first_investors'] != 1 else ''} this week"
    elif last_week["signups"] > 0:
        headline = f"{last_week['signups']} new signup{'s' if last_week['signups'] != 1 else ''} this week"
    elif snapshot["total_signups"] == 0:
        headline = "No new investor signups this week — time to push traffic"

    return {
        "generated_at": now.isoformat(),
        "window": {
            "last_week_start": last_week_start.isoformat(),
            "last_week_end": current_monday.isoformat(),
            "label": f"{last_week_start.strftime('%b %d')} – {(current_monday - timedelta(days=1)).strftime('%b %d, %Y')}",
        },
        "headline": headline,
        "last_week": last_week,
        "prev_week": prev_week,
        "deltas": {
            "signups": _delta_badge(last_week["signups"], prev_week["signups"], "signups"),
            "depositors": _delta_badge(last_week["depositors"], prev_week["depositors"], "depositors"),
            "first_investors": _delta_badge(
                last_week["first_investors"], prev_week["first_investors"], "investors"
            ),
            "invested": _delta_badge(
                last_week["total_invested"] / 1000,
                prev_week["total_invested"] / 1000,
                "K₦",
            ),
        },
        "retention": {
            f"W+{m}": retention_deltas[m] for m in MILESTONES
        },
        "cohort_matrix": [
            {
                "label": c["label"],
                "size": c["size"],
                "cells": {
                    f"W+{m}": {
                        "pct": c["retention"][m]["pct"],
                        "count": c["retention"][m]["count"],
                        "eligible": c["retention"][m]["eligible"],
                    } for m in MILESTONES
                },
            }
            for c in cohorts
        ],
        "action_items": _build_action_items(last_week, retention_deltas),
    }


def _build_action_items(week: Dict, retention: Dict) -> List[str]:
    items = []
    if week["signups"] == 0:
        items.append("No signups this week — push on referral / traffic channels.")
    if week["signups"] > 0 and week["depositors"] == 0:
        items.append("Signups but zero deposits — trust issue at wallet funding step.")
    if week["depositors"] > 0 and week["first_investors"] == 0:
        items.append("Deposits but zero first invests — decision friction on opportunity pages.")
    w1 = retention.get(1, {})
    if isinstance(w1.get("current"), (int, float)) and w1["current"] < 20:
        items.append(f"W+1 retention is low ({w1['current']}%) — investors aren't moving fast enough.")
    if not items:
        items.append("Healthy funnel this week. Keep doing what you're doing.")
    return items


# ─── Email rendering ──────────────────────────────────────────────────────
def render_cohort_email_html(p: Dict[str, Any]) -> str:
    retention = p["retention"]
    last = p["last_week"]
    deltas = p["deltas"]

    def pill(v):
        if not v:
            return ""
        v = str(v)
        if "↑" in v:
            color = "#059669"
        elif "↓" in v:
            color = "#dc2626"
        else:
            color = "#71717a"
        return f'<span style="font-size:11px;color:{color};font-weight:600;margin-left:6px">{v}</span>'

    def cell(cell_data):
        if not cell_data.get("eligible"):
            return '<td style="padding:6px;text-align:center;background:#fafafa;color:#a1a1aa;font-size:12px">—</td>'
        pct = cell_data["pct"]
        if pct >= 40:
            bg = "#059669"; fg = "#fff"
        elif pct >= 25:
            bg = "#10b981"; fg = "#fff"
        elif pct >= 15:
            bg = "#34d399"; fg = "#fff"
        elif pct >= 5:
            bg = "#a7f3d0"; fg = "#064e3b"
        elif pct > 0:
            bg = "#d1fae5"; fg = "#064e3b"
        else:
            bg = "#fafafa"; fg = "#a1a1aa"
        return f'<td style="padding:6px;text-align:center;background:{bg};color:{fg};font-size:12px;font-weight:600">{pct}%</td>'

    rows = "".join(
        f'<tr><td style="padding:6px 12px;font-size:12px;color:#27272a">{c["label"]}</td>'
        f'<td style="padding:6px 12px;font-size:12px;color:#52525b;text-align:right">{c["size"]}</td>'
        + "".join(cell(c["cells"][f"W+{m}"]) for m in MILESTONES)
        + "</tr>"
        for c in p["cohort_matrix"]
    )

    action_html = "".join(
        f'<li style="margin-bottom:6px;color:#3f3f46;font-size:14px">{a}</li>'
        for a in p["action_items"]
    )

    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7">
    <div style="background:linear-gradient(135deg,#0F5132,#047857);color:#fff;padding:28px 28px 24px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;opacity:.8">AGRIOS · WEEKLY LAUNCH PULSE</div>
      <div style="font-size:22px;font-weight:800;margin-top:6px;letter-spacing:-.01em">{p["headline"]}</div>
      <div style="font-size:12px;opacity:.75;margin-top:4px">Week of {p["window"]["label"]}</div>
    </div>

    <div style="padding:24px 28px">
      <h3 style="margin:0 0 12px;font-size:15px;color:#18181b">This week in numbers</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;color:#52525b;font-size:13px">Signups</td>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;font-weight:700;color:#18181b">{last["signups"]}{pill(deltas["signups"])}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;color:#52525b;font-size:13px">Depositors</td>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;font-weight:700;color:#18181b">{last["depositors"]}{pill(deltas["depositors"])}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;color:#52525b;font-size:13px">First-time investors</td>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;font-weight:700;color:#18181b">{last["first_investors"]}{pill(deltas["first_investors"])}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#52525b;font-size:13px">Volume invested</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#18181b">₦{last["total_invested"]:,.0f}{pill(deltas["invested"])}</td>
        </tr>
      </table>
    </div>

    <div style="padding:0 28px 24px">
      <h3 style="margin:0 0 12px;font-size:15px;color:#18181b">Retention snapshot</h3>
      <table style="width:100%;border-collapse:collapse">
        {"".join(
            f'<tr><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;color:#52525b;font-size:13px">W+{m} retention</td>'
            f'<td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;font-weight:700;color:#18181b">'
            f'{retention[f"W+{m}"]["current"] if retention[f"W+{m}"]["current"] is not None else "—"}%'
            f'{pill(retention[f"W+{m}"]["badge"])}</td></tr>'
            for m in MILESTONES
        )}
      </table>
    </div>

    <div style="padding:0 28px 24px">
      <h3 style="margin:0 0 12px;font-size:15px;color:#18181b">Cohort matrix (last 8 weeks)</h3>
      <table style="width:100%;border-collapse:separate;border-spacing:2px">
        <thead>
          <tr>
            <th style="padding:6px 12px;text-align:left;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Cohort</th>
            <th style="padding:6px 12px;text-align:right;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Size</th>
            {"".join(f'<th style="padding:6px;text-align:center;font-size:11px;color:#71717a">W+{m}</th>' for m in MILESTONES)}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>

    <div style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e4e4e7">
      <h3 style="margin:0 0 12px;font-size:15px;color:#18181b">What to watch next</h3>
      <ul style="margin:0;padding-left:20px">{action_html}</ul>
    </div>

    <div style="padding:16px 28px;font-size:11px;color:#a1a1aa;text-align:center">
      AGRIOS · Automated weekly digest · Generated {p["generated_at"][:10]}
    </div>
  </div>
</div>
</body></html>"""


def render_cohort_email_text(p: Dict[str, Any]) -> str:
    last = p["last_week"]
    deltas = p["deltas"]
    retention = p["retention"]
    lines = [
        "AGRIOS WEEKLY LAUNCH PULSE",
        f"Week of {p['window']['label']}",
        "",
        p["headline"],
        "",
        "THIS WEEK IN NUMBERS",
        f"  Signups:            {last['signups']:>5}   {deltas['signups']}",
        f"  Depositors:         {last['depositors']:>5}   {deltas['depositors']}",
        f"  First investors:    {last['first_investors']:>5}   {deltas['first_investors']}",
        f"  Volume invested:    ₦{last['total_invested']:,.0f}   {deltas['invested']}",
        "",
        "RETENTION",
    ]
    for m in MILESTONES:
        r = retention[f"W+{m}"]
        cur = f"{r['current']}%" if r["current"] is not None else "—"
        lines.append(f"  W+{m}:   {cur}   {r['badge']}")
    lines += ["", "WHAT TO WATCH NEXT"]
    for a in p["action_items"]:
        lines.append(f"  • {a}")
    lines += ["", "—", "AGRIOS · Automated weekly digest"]
    return "\n".join(lines)


def render_cohort_email_subject(p: Dict[str, Any]) -> str:
    last = p["last_week"]
    deltas = p["deltas"]
    if last["first_investors"] > 0:
        return f"AGRIOS: {last['first_investors']} new investor{'s' if last['first_investors'] != 1 else ''} this week · ₦{last['total_invested']:,.0f} invested"
    if last["signups"] > 0:
        return f"AGRIOS weekly: {last['signups']} signups · {deltas['signups']}"
    return "AGRIOS weekly: no new signups — check traffic"


# ─── Webhook (Slack / Discord / WhatsApp via Zapier/Make) ──────────────────
def render_webhook_summary(p: Dict[str, Any]) -> str:
    """One-line summary + key metrics block for chat delivery.

    Works in Slack, Discord, Google Chat, and any relay that forwards plain
    text to WhatsApp/Telegram (Zapier, Make, n8n).
    """
    last = p["last_week"]
    deltas = p["deltas"]
    retention = p["retention"]
    w1 = retention.get("W+1", {})
    w1_str = f"{w1['current']}% {w1['badge']}" if w1.get("current") is not None else "—"
    one_liner = (
        f"*AGRIOS weekly* — {last['signups']} signup{'s' if last['signups'] != 1 else ''} · "
        f"{last['first_investors']} first investor{'s' if last['first_investors'] != 1 else ''} · "
        f"₦{last['total_invested']:,.0f} invested · W+1 retention {w1_str}"
    )
    body = (
        f"{one_liner}\n"
        f"_{p['headline']} · {p['window']['label']}_\n"
        f"• Signups: {last['signups']} ({deltas['signups']})\n"
        f"• Depositors: {last['depositors']} ({deltas['depositors']})\n"
        f"• First investors: {last['first_investors']} ({deltas['first_investors']})\n"
        f"• Volume: ₦{last['total_invested']:,.0f} ({deltas['invested']})\n"
        f"What to watch: {p['action_items'][0] if p['action_items'] else '—'}"
    )
    return body


def render_webhook_slack_blocks(p: Dict[str, Any]) -> Dict[str, Any]:
    """Slack Block Kit payload — renders as a proper card in Slack."""
    last = p["last_week"]
    deltas = p["deltas"]
    retention = p["retention"]
    w1 = retention.get("W+1", {})
    w1_str = f"{w1['current']}% {w1['badge']}" if w1.get("current") is not None else "—"

    headline = f":seedling: *AGRIOS weekly* — {p['headline']}"
    metrics = (
        f"*Signups:* {last['signups']} _{deltas['signups']}_\n"
        f"*Depositors:* {last['depositors']} _{deltas['depositors']}_\n"
        f"*First investors:* {last['first_investors']} _{deltas['first_investors']}_\n"
        f"*Volume:* ₦{last['total_invested']:,.0f} _{deltas['invested']}_\n"
        f"*W+1 retention:* {w1_str}"
    )
    actions = "\n".join(f"• {a}" for a in p["action_items"][:3]) or "—"
    return {
        "text": render_webhook_summary(p),  # fallback for unfurl/plain clients
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": headline}},
            {"type": "context", "elements": [{"type": "mrkdwn",
                "text": f"_Week of {p['window']['label']}_"}]},
            {"type": "section", "text": {"type": "mrkdwn", "text": metrics}},
            {"type": "divider"},
            {"type": "section", "text": {"type": "mrkdwn",
                "text": f"*What to watch next:*\n{actions}"}},
        ],
    }


async def send_slack_webhook(db, payload: Dict[str, Any], *, reason: str,
                             actor: Optional[str] = None) -> Dict[str, Any]:
    """POST to Slack-compatible webhook (SLACK_WEBHOOK_URL).

    Logged to `digest_log` with provider='slack' for audit.
    """
    import os
    import httpx
    url = os.environ.get("SLACK_WEBHOOK_URL") or os.environ.get("COHORT_DIGEST_WEBHOOK_URL")
    entry = {
        "to": "slack-webhook",
        "subject": render_cohort_email_subject(payload),
        "text_bytes": 0,
        "html_bytes": 0,
        "provider": "slack",
        "status": "logged",
        "error": None,
        "meta": {"kind": "cohort_digest", "reason": reason, "actor": actor, "channel": "slack"},
        "sent_at": _now().isoformat(),
    }
    if not url:
        entry["status"] = "skipped"
        entry["error"] = "SLACK_WEBHOOK_URL not set"
        await db.digest_log.insert_one(entry.copy())
        entry.pop("_id", None)
        return entry

    body = render_webhook_slack_blocks(payload)
    entry["text_bytes"] = len(body.get("text") or "")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=body)
            if r.status_code >= 300:
                entry["status"] = "failed"
                entry["error"] = r.text[:500]
            else:
                entry["status"] = "sent"
    except Exception as exc:  # noqa: BLE001
        entry["status"] = "failed"
        entry["error"] = str(exc)[:500]

    await db.digest_log.insert_one(entry.copy())
    entry.pop("_id", None)
    return entry


async def send_whatsapp_cloud(db, payload: Dict[str, Any], *, reason: str,
                              actor: Optional[str] = None) -> Dict[str, Any]:
    """Send digest one-liner via WhatsApp Cloud API (Meta).

    Requires env: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TO.
    Free text messages only work within 24h of a user-initiated conversation;
    otherwise a pre-approved template message is required. For a solo-operator
    launch, easier to use Slack webhook → Zapier/Make → WhatsApp instead.
    """
    import os
    import httpx
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
    to = os.environ.get("WHATSAPP_TO")
    entry = {
        "to": to or "whatsapp-cloud",
        "subject": render_cohort_email_subject(payload),
        "text_bytes": 0,
        "html_bytes": 0,
        "provider": "whatsapp",
        "status": "logged",
        "error": None,
        "meta": {"kind": "cohort_digest", "reason": reason, "actor": actor, "channel": "whatsapp"},
        "sent_at": _now().isoformat(),
    }
    if not (phone_id and token and to):
        entry["status"] = "skipped"
        entry["error"] = "WHATSAPP_* env vars not set"
        await db.digest_log.insert_one(entry.copy())
        entry.pop("_id", None)
        return entry

    # Strip markdown asterisks for WhatsApp (it uses single * for bold too, but
    # keeping the formatting is fine — both render as bold in WhatsApp).
    text = render_webhook_summary(payload)
    entry["text_bytes"] = len(text)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://graph.facebook.com/v20.0/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}",
                         "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "text",
                    "text": {"body": text[:4096]},
                },
            )
            if r.status_code >= 300:
                entry["status"] = "failed"
                entry["error"] = r.text[:500]
            else:
                entry["status"] = "sent"
                try:
                    entry["message_id"] = (r.json().get("messages") or [{}])[0].get("id")
                except Exception:  # noqa: BLE001
                    pass
    except Exception as exc:  # noqa: BLE001
        entry["status"] = "failed"
        entry["error"] = str(exc)[:500]

    await db.digest_log.insert_one(entry.copy())
    entry.pop("_id", None)
    return entry


async def run_cohort_digest_blast(db, reason: str = "manual", actor: Optional[str] = None) -> Dict[str, Any]:
    """Send the digest to every admin user via email + Slack + WhatsApp (where configured)."""
    admins = await db.users.find(
        {"role": "admin"}, {"_id": 0, "id": 1, "email": 1, "full_name": 1}
    ).to_list(100)
    payload = await build_cohort_digest(db)
    subject = render_cohort_email_subject(payload)
    html = render_cohort_email_html(payload)
    text = render_cohort_email_text(payload)

    # Email each admin
    sent = failed = 0
    for admin in admins:
        if not admin.get("email"):
            continue
        try:
            result = await digest_service.send_email(
                db,
                to=admin["email"],
                subject=subject,
                html=html,
                text=text,
                meta={"kind": "cohort_digest", "reason": reason, "actor": actor, "channel": "email"},
            )
            if result.get("status") == "failed":
                failed += 1
            else:
                sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("cohort_digest email to %s failed: %s", admin.get("email"), exc)
            failed += 1

    # Chat channels (once per blast, not per admin)
    slack_result = await send_slack_webhook(db, payload, reason=reason, actor=actor)
    whatsapp_result = await send_whatsapp_cloud(db, payload, reason=reason, actor=actor)

    now_iso = _now().isoformat()
    await db.system.update_one(
        {"key": "cohort_digest_last_run"},
        {"$set": {
            "key": "cohort_digest_last_run",
            "at": now_iso,
            "sent": sent,
            "failed": failed,
            "reason": reason,
            "actor": actor,
            "slack_status": slack_result["status"],
            "whatsapp_status": whatsapp_result["status"],
        }},
        upsert=True,
    )
    return {
        "sent": sent,
        "failed": failed,
        "total": len(admins),
        "reason": reason,
        "ran_at": now_iso,
        "channels": {"slack": slack_result["status"], "whatsapp": whatsapp_result["status"]},
    }


# ─── Router registration ───────────────────────────────────────────────────
def register(api: APIRouter, *, db, require_roles):

    @api.get("/admin/cohort-digest/preview")
    async def preview(user: dict = Depends(require_roles("admin"))):
        payload = await build_cohort_digest(db)
        return {
            "subject": render_cohort_email_subject(payload),
            "payload": payload,
            "text": render_cohort_email_text(payload),
        }

    @api.post("/admin/cohort-digest/send-me-now")
    async def send_me_now(user: dict = Depends(require_roles("admin"))):
        if not user.get("email"):
            raise HTTPException(400, "Admin account has no email on file")
        payload = await build_cohort_digest(db)
        subject = render_cohort_email_subject(payload)
        html = render_cohort_email_html(payload)
        text = render_cohort_email_text(payload)
        email_result = await digest_service.send_email(
            db, to=user["email"], subject=subject, html=html, text=text,
            meta={"kind": "cohort_digest", "reason": "send-me-now", "actor": user["id"], "channel": "email"},
        )
        slack_result = await send_slack_webhook(
            db, payload, reason="send-me-now", actor=user["id"]
        )
        whatsapp_result = await send_whatsapp_cloud(
            db, payload, reason="send-me-now", actor=user["id"]
        )
        return {
            "ok": True,
            "delivery": email_result,
            "subject": subject,
            "channels": {
                "email": email_result["status"],
                "slack": slack_result["status"],
                "whatsapp": whatsapp_result["status"],
            },
        }

    @api.post("/admin/cohort-digest/test-webhooks")
    async def test_webhooks(user: dict = Depends(require_roles("admin"))):
        """Fire a test push to both chat channels without emailing."""
        payload = await build_cohort_digest(db)
        slack_result = await send_slack_webhook(
            db, payload, reason="test-webhooks", actor=user["id"]
        )
        whatsapp_result = await send_whatsapp_cloud(
            db, payload, reason="test-webhooks", actor=user["id"]
        )
        return {
            "preview_text": render_webhook_summary(payload),
            "slack": slack_result,
            "whatsapp": whatsapp_result,
        }

    @api.post("/admin/cohort-digest/trigger")
    async def trigger(user: dict = Depends(require_roles("admin"))):
        return await run_cohort_digest_blast(db, reason="manual-trigger", actor=user["id"])

    @api.get("/admin/cohort-digest/log")
    async def log(limit: int = 30, user: dict = Depends(require_roles("admin"))):
        limit = max(1, min(limit, 200))
        cur = db.digest_log.find(
            {"meta.kind": "cohort_digest"},
            {"_id": 0, "to": 1, "subject": 1, "status": 1, "sent_at": 1,
             "provider": 1, "error": 1, "meta": 1},
        ).sort("sent_at", -1).limit(limit)
        rows = await cur.to_list(limit)
        last_run = await db.system.find_one({"key": "cohort_digest_last_run"}, {"_id": 0})
        return {"last_run": last_run, "rows": rows}


# ─── Scheduler ─────────────────────────────────────────────────────────────
async def scheduler_loop(db) -> None:
    """Wake hourly, fire once per Monday at COHORT_DIGEST_HOUR_UTC (default 8 UTC = 9am WAT)."""
    import asyncio
    import os

    target_hour = int(os.environ.get("COHORT_DIGEST_HOUR_UTC", "8"))
    while True:
        try:
            now = _now()
            if now.weekday() == 0 and now.hour == target_hour:
                last = await db.system.find_one({"key": "cohort_digest_last_run"}, {"_id": 0, "at": 1})
                last_at = None
                if last and last.get("at"):
                    try:
                        last_at = datetime.fromisoformat(last["at"])
                    except Exception:
                        last_at = None
                if not last_at or (now - last_at) > timedelta(hours=24):
                    logger.info("Cohort digest: scheduled Monday blast starting")
                    result = await run_cohort_digest_blast(db, reason="scheduled-monday")
                    logger.info("Cohort digest blast complete: %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("cohort digest scheduler tick failed: %s", exc)
        await asyncio.sleep(60 * 60)
