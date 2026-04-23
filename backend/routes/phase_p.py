"""AGRIOS Phase P — Founder concierge chat (in-app ↔ Slack).

Collections:
  support_threads: {id, user_id, user_name, user_email, user_role, created_at,
                    last_message_at, last_message_preview, last_author_role,
                    unread_for_user, unread_for_admin, status}
  support_messages: {id, thread_id, author_id, author_role, body, created_at}

Flow:
  User types in floating widget → POST /api/support/messages
    → upsert thread, append message, fire Slack 💬 alert, increment admin unread
  Admin opens /app/admin/support → sees thread list + conversation
  Admin replies → POST /api/admin/support/threads/{id}/reply
    → append message, fire Slack ✅ alert, increment user unread
  User re-opens widget → polling GET /api/support/thread returns new msgs,
    then POST /api/support/messages/read clears unread_for_user

Design choices:
  • ONE thread per user (no multi-thread UI for first 10 users)
  • Slack alerts reuse `services.slack_alerts._post` for audit-logged delivery
  • `_id` always excluded from responses
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SendMessageBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class ReplyBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


def register(api: APIRouter, *, db, current_user, require_roles, new_id):
    from services import slack_alerts as _slack

    async def _upsert_thread(user: dict) -> dict:
        t = await db.support_threads.find_one({"user_id": user["id"]}, {"_id": 0})
        if t:
            return t
        doc = {
            "id": new_id(),
            "user_id": user["id"],
            "user_name": user.get("full_name") or user.get("email"),
            "user_email": user.get("email"),
            "user_role": user.get("role"),
            "created_at": _now(),
            "last_message_at": None,
            "last_message_preview": "",
            "last_author_role": None,
            "unread_for_user": 0,
            "unread_for_admin": 0,
            "status": "open",
        }
        await db.support_threads.insert_one(doc.copy())
        doc.pop("_id", None)
        return doc

    # ───────── USER endpoints ─────────

    @api.get("/support/thread")
    async def get_my_thread(user: dict = Depends(current_user)):
        """Return the user's thread + all messages. Creates thread lazily."""
        t = await _upsert_thread(user)
        msgs = await db.support_messages.find(
            {"thread_id": t["id"]}, {"_id": 0},
        ).sort("created_at", 1).to_list(500)
        return {"thread": t, "messages": msgs}

    @api.post("/support/messages")
    async def send_message(body: SendMessageBody, user: dict = Depends(current_user)):
        t = await _upsert_thread(user)
        now = _now()
        msg = {
            "id": new_id(),
            "thread_id": t["id"],
            "author_id": user["id"],
            "author_role": user.get("role"),
            "body": body.body.strip(),
            "created_at": now,
        }
        await db.support_messages.insert_one(msg.copy())
        msg.pop("_id", None)
        preview = msg["body"][:140]
        await db.support_threads.update_one(
            {"id": t["id"]},
            {"$set": {
                "last_message_at": now,
                "last_message_preview": preview,
                "last_author_role": user.get("role"),
                "status": "open",
            }, "$inc": {"unread_for_admin": 1}},
        )
        # Slack alert — founder concierge ping
        try:
            name = _slack._mask_last_name(user.get("full_name") or user.get("email") or "")
            role = (user.get("role") or "user").capitalize()
            text = f":speech_balloon: *Support — {name}* ({role}) — \"{preview}\""
            await _slack._post(
                db, text, reason="support.message",
                meta={"user_id": user["id"], "thread_id": t["id"]},
            )
        except Exception:
            pass
        return msg

    @api.post("/support/messages/read")
    async def mark_read(user: dict = Depends(current_user)):
        """User has opened the widget; clear admin-reply unread count."""
        await db.support_threads.update_one(
            {"user_id": user["id"]}, {"$set": {"unread_for_user": 0}},
        )
        return {"ok": True}

    # ───────── ADMIN endpoints ─────────

    @api.get("/admin/support/threads")
    async def list_threads(user: dict = Depends(require_roles("admin"))):
        threads = await db.support_threads.find(
            {}, {"_id": 0},
        ).sort("last_message_at", -1).to_list(500)
        total_unread = sum(int(t.get("unread_for_admin") or 0) for t in threads)
        return {"threads": threads, "total_unread_admin": total_unread}

    @api.get("/admin/support/threads/{thread_id}")
    async def get_thread(thread_id: str, user: dict = Depends(require_roles("admin"))):
        t = await db.support_threads.find_one({"id": thread_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Thread not found")
        msgs = await db.support_messages.find(
            {"thread_id": thread_id}, {"_id": 0},
        ).sort("created_at", 1).to_list(500)
        # Opening a thread clears admin's unread badge
        await db.support_threads.update_one(
            {"id": thread_id}, {"$set": {"unread_for_admin": 0}},
        )
        t["unread_for_admin"] = 0
        return {"thread": t, "messages": msgs}

    @api.post("/admin/support/threads/{thread_id}/reply")
    async def reply_thread(
        thread_id: str, body: ReplyBody,
        user: dict = Depends(require_roles("admin")),
    ):
        t = await db.support_threads.find_one({"id": thread_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Thread not found")
        now = _now()
        msg = {
            "id": new_id(),
            "thread_id": thread_id,
            "author_id": user["id"],
            "author_role": "admin",
            "body": body.body.strip(),
            "created_at": now,
        }
        await db.support_messages.insert_one(msg.copy())
        msg.pop("_id", None)
        preview = msg["body"][:140]
        await db.support_threads.update_one(
            {"id": thread_id},
            {"$set": {
                "last_message_at": now,
                "last_message_preview": preview,
                "last_author_role": "admin",
                "unread_for_admin": 0,
                "status": "open",
            }, "$inc": {"unread_for_user": 1}},
        )
        # Slack ack so admin sees their own reply in the launch channel
        try:
            name = _slack._mask_last_name(t.get("user_name") or t.get("user_email") or "")
            text = f":white_check_mark: *Replied to {name}* — \"{preview}\""
            await _slack._post(
                db, text, reason="support.reply",
                meta={"thread_id": thread_id, "admin_id": user["id"]},
            )
        except Exception:
            pass
        return msg

    @api.post("/admin/support/threads/{thread_id}/close")
    async def close_thread(thread_id: str, user: dict = Depends(require_roles("admin"))):
        r = await db.support_threads.update_one(
            {"id": thread_id}, {"$set": {"status": "closed"}},
        )
        if r.matched_count == 0:
            raise HTTPException(404, "Thread not found")
        return {"ok": True}
