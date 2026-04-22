"""AGRIOS — Real-time Slack alerts (launch command center).

Pushes concise one-line alerts to SLACK_WEBHOOK_URL for launch-week visibility.

Events fired:
  • user.signup             — 🟢 New signup — John O. (UK · investor)
  • kyc.completed           — 🟡 KYC completed — Sarah A. · silver
  • wallet.funded           — 💰 Wallet funded — ₦50,000 — Tunde L.
  • investment.first        — 🚀 First investment — ₦50,000 — Chidi K. — Cassava — Ogun
  • investment.created      — 📈 New investment — ₦200,000 — 3 investors — Maize — Kaduna
                              (rolled up: bursts within 3 min on same opp become ONE summary)
  • user.inactivity_risk    — ⚠️ User at risk — funded but not invested after 24h — Chidi K.

Design:
  • All functions are fire-and-forget; failures NEVER break business flows.
  • Env-gated: no webhook URL → silent skip (logged to digest_log.provider='slack').
  • Idempotent flags on user docs prevent double-firing across restarts.
  • Investment rollup: bursts of investments on the same opportunity within 3 min
    are collapsed into a single aggregate message via `flush_investment_rollups`.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agrios.slack_alerts")

# Rollup window for bursty investment activity
INVEST_ROLLUP_SECONDS = 180  # 3 minutes
# Grace period after last investment before flushing a rollup
INVEST_ROLLUP_QUIET_SECONDS = 60  # 1 minute of silence = flush
# Inactivity threshold
INACTIVITY_HOURS = 24


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _webhook_url() -> Optional[str]:
    return os.environ.get("SLACK_WEBHOOK_URL") or os.environ.get("COHORT_DIGEST_WEBHOOK_URL")


def _mask_last_name(full_name: str) -> str:
    """'Chidi Kalu' → 'Chidi K.' — reduces PII exposure in chat."""
    if not full_name:
        return "Someone"
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][:1]}."


async def _post(db, text: str, *, reason: str, blocks: Optional[List[Dict]] = None,
                meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Core webhook sender. Always logs to digest_log, never raises."""
    entry = {
        "to": "slack-webhook",
        "subject": text[:120],
        "text_bytes": len(text or ""),
        "html_bytes": 0,
        "provider": "slack",
        "status": "logged",
        "error": None,
        "meta": {"kind": "slack_alert", "reason": reason, **(meta or {})},
        "sent_at": _now().isoformat(),
    }
    url = _webhook_url()
    if not url:
        entry["status"] = "skipped"
        entry["error"] = "SLACK_WEBHOOK_URL not set"
        try:
            await db.digest_log.insert_one(entry.copy())
        except Exception:  # noqa: BLE001
            pass
        entry.pop("_id", None)
        return entry

    body = {"text": text}
    if blocks:
        body["blocks"] = blocks

    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(url, json=body)
            if r.status_code >= 300:
                entry["status"] = "failed"
                entry["error"] = r.text[:400]
            else:
                entry["status"] = "sent"
    except Exception as exc:  # noqa: BLE001
        entry["status"] = "failed"
        entry["error"] = str(exc)[:400]

    try:
        await db.digest_log.insert_one(entry.copy())
    except Exception:  # noqa: BLE001
        pass
    entry.pop("_id", None)
    return entry


# ─── Public event helpers ──────────────────────────────────────────────────

async def alert_signup(db, user: Dict[str, Any]) -> None:
    name = _mask_last_name(user.get("full_name") or user.get("email") or "")
    role = (user.get("role") or "user").capitalize()
    country = (user.get("country") or "NG")
    text = f":seedling: *New signup* — {name} · {role} · {country}"
    await _post(db, text, reason="user.signup",
                meta={"user_id": user.get("id"), "role": user.get("role")})


async def alert_kyc_completed(db, user: Dict[str, Any], tier: str) -> None:
    name = _mask_last_name(user.get("full_name") or user.get("email") or "")
    text = f":large_yellow_circle: *KYC completed* — {name} · tier `{tier}`"
    await _post(db, text, reason="kyc.completed",
                meta={"user_id": user.get("id"), "tier": tier})


async def alert_wallet_funded(db, user: Dict[str, Any], amount: float,
                              is_first: bool = False) -> None:
    name = _mask_last_name(user.get("full_name") or user.get("email") or "")
    symbol = "₦"  # single-currency launch
    icon = ":moneybag:" if is_first else ":credit_card:"
    label = "First deposit" if is_first else "Wallet funded"
    text = f"{icon} *{label}* — {symbol}{amount:,.0f} — {name}"
    await _post(db, text, reason="wallet.funded",
                meta={"user_id": user.get("id"), "amount": amount, "is_first": is_first})


async def alert_first_investment(db, user: Dict[str, Any], opportunity: Dict[str, Any],
                                 amount: float) -> None:
    name = _mask_last_name(user.get("full_name") or user.get("email") or "")
    symbol = opportunity.get("currency") or "₦"
    if symbol == "NGN":
        symbol = "₦"
    crop = opportunity.get("crop") or opportunity.get("title") or "opportunity"
    region = opportunity.get("region") or ""
    tail = f" · {region}" if region else ""
    text = f":rocket: *First investment* — {symbol}{amount:,.0f} — {name} — {crop}{tail}"
    await _post(db, text, reason="investment.first",
                meta={"user_id": user.get("id"), "amount": amount,
                      "opportunity_id": opportunity.get("id")})


async def buffer_investment(db, user: Dict[str, Any], opportunity: Dict[str, Any],
                            amount: float) -> None:
    """Non-first investments go into a rollup; flushed by scheduler."""
    now = _now()
    rollup = await db.slack_rollups.find_one({
        "opportunity_id": opportunity["id"],
        "flushed": False,
    })
    item = {
        "user_id": user.get("id"),
        "name": _mask_last_name(user.get("full_name") or ""),
        "amount": float(amount),
        "at": now,
    }
    if rollup:
        await db.slack_rollups.update_one(
            {"_id": rollup["_id"]},
            {"$push": {"investments": item}, "$set": {"last_at": now}},
        )
    else:
        await db.slack_rollups.insert_one({
            "opportunity_id": opportunity["id"],
            "opportunity_title": opportunity.get("title", ""),
            "crop": opportunity.get("crop", ""),
            "region": opportunity.get("region", ""),
            "currency": opportunity.get("currency", "NGN"),
            "investments": [item],
            "first_at": now,
            "last_at": now,
            "flushed": False,
        })


async def flush_investment_rollups(db, *, force: bool = False) -> int:
    """Send aggregate alerts for rollups that have gone quiet for 1 min OR
    exceeded the 3 min window. Pass force=True to flush all pending rollups
    immediately (admin testing only). Returns number flushed."""
    now = _now()
    if force:
        cur = db.slack_rollups.find({"flushed": False})
    else:
        # Two reasons to flush:
        #  a) 1 min of silence since the last deposit in the burst
        #  b) total window exceeded 3 min (cap long bursts)
        cutoff_silent = now - timedelta(seconds=INVEST_ROLLUP_QUIET_SECONDS)
        cutoff_window = now - timedelta(seconds=INVEST_ROLLUP_SECONDS)
        cur = db.slack_rollups.find({
            "flushed": False,
            "$or": [
                {"last_at": {"$lte": cutoff_silent}},
                {"first_at": {"$lte": cutoff_window}},
            ],
        })
    flushed = 0
    async for doc in cur:
        try:
            investments = doc.get("investments") or []
            if not investments:
                await db.slack_rollups.update_one({"_id": doc["_id"]}, {"$set": {"flushed": True}})
                continue
            total = sum(float(i["amount"]) for i in investments)
            count = len(investments)
            crop = doc.get("crop") or doc.get("opportunity_title") or "opportunity"
            region = doc.get("region") or ""
            tail = f" · {region}" if region else ""
            symbol = "₦"
            if count == 1:
                # Rolled up singleton — still one alert, just delayed for dedupe
                i0 = investments[0]
                text = f":chart_with_upwards_trend: *New investment* — {symbol}{float(i0['amount']):,.0f} — {i0['name']} — {crop}{tail}"
            else:
                text = (
                    f":chart_with_upwards_trend: *New investment* — {symbol}{total:,.0f} — "
                    f"{count} investors — {crop}{tail}"
                )
            await _post(db, text, reason="investment.created",
                        meta={"opportunity_id": doc.get("opportunity_id"),
                              "count": count, "total": total})
            await db.slack_rollups.update_one(
                {"_id": doc["_id"]}, {"$set": {"flushed": True, "flushed_at": now}},
            )
            flushed += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("rollup flush failed for %s: %s", doc.get("opportunity_id"), exc)
    return flushed


async def alert_support_request(db, user: Dict[str, Any], issue_type: str,
                                message: Optional[str] = None) -> None:
    name = _mask_last_name(user.get("full_name") or user.get("email") or "")
    trimmed = (message or "").strip()
    if len(trimmed) > 140:
        trimmed = trimmed[:140] + "…"
    tail = f" — \"{trimmed}\"" if trimmed else ""
    text = f":warning: *Support request* — {name} · {issue_type}{tail}"
    await _post(db, text, reason="support.requested",
                meta={"user_id": user.get("id"), "issue_type": issue_type})


# ─── Inactivity risk sweep (funded > 24h + no invest yet) ─────────────────

async def inactivity_risk_sweep(db) -> int:
    """Find users who funded their wallet ≥24h ago, have balance, and never invested.
    One-shot alert per user (idempotent via slack_inactivity_alerted flag)."""
    cutoff = _now() - timedelta(hours=INACTIVITY_HOURS)
    # Find distinct user_ids with a fund event before cutoff
    funders = await db.ledger.distinct(
        "user_id",
        {"kind": "fund", "created_at": {"$lte": cutoff}},
    )
    if not funders:
        return 0
    fired = 0
    for uid in funders:
        user = await db.users.find_one(
            {"id": uid, "role": "investor", "slack_inactivity_alerted": {"$ne": True}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1},
        )
        if not user:
            continue
        # Any investment ever?
        has_invest = await db.investments.count_documents({"investor_id": uid})
        if has_invest:
            # Backfill flag so we don't recheck every hour
            await db.users.update_one({"id": uid}, {"$set": {"slack_inactivity_alerted": True}})
            continue
        # Wallet has positive balance?
        w = await db.wallets.find_one({"user_id": uid}, {"_id": 0, "available": 1})
        if not w or float(w.get("available", 0) or 0) <= 0:
            continue
        name = _mask_last_name(user.get("full_name") or user.get("email") or "")
        bal = float(w["available"])
        text = (
            f":rotating_light: *User at risk* — {name} · funded ₦{bal:,.0f} · "
            f"no investment after {INACTIVITY_HOURS}h"
        )
        await _post(db, text, reason="user.inactivity_risk",
                    meta={"user_id": uid, "balance": bal})
        await db.users.update_one({"id": uid}, {"$set": {"slack_inactivity_alerted": True}})
        fired += 1
    return fired


# ─── Background scheduler ─────────────────────────────────────────────────

async def scheduler_loop(db) -> None:
    """Single loop that handles both rollup flushes (every 30s) and inactivity
    sweeps (every 60 min)."""
    import asyncio
    last_inactivity_sweep: Optional[datetime] = None
    while True:
        try:
            await flush_investment_rollups(db)
            now = _now()
            if (
                last_inactivity_sweep is None
                or (now - last_inactivity_sweep) >= timedelta(minutes=60)
            ):
                n = await inactivity_risk_sweep(db)
                last_inactivity_sweep = now
                if n > 0:
                    logger.info("inactivity sweep fired %d alerts", n)
        except Exception as exc:  # noqa: BLE001
            logger.warning("slack_alerts scheduler tick failed: %s", exc)
        await asyncio.sleep(30)
