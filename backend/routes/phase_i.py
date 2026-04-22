"""AGRIOS Phase I — Google OAuth (Emergent-managed) + Onboarding state.

Google auth flow:
  1. Frontend redirects user to https://auth.emergentagent.com/?redirect=<origin>/auth/callback
  2. On return, frontend POSTs session_id to POST /api/auth/google/session
  3. Backend exchanges session_id via Emergent /session-data, creates/updates user,
     sets httpOnly session_token cookie AND returns existing-style JWT so the
     app's existing token-based flows keep working.

Onboarding flow:
  • GET  /api/onboarding/state   — current user's onboarding step + profile subset
  • PATCH /api/onboarding/profile — merges role-specific profile fields
  • POST /api/onboarding/advance — bumps step forward (idempotent, max 5)
  • POST /api/onboarding/complete — sets step=5, redirects caller to /app
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class GoogleSessionPayload(BaseModel):
    session_id: str = Field(..., min_length=8)
    role: Optional[str] = Field(default=None, pattern="^(investor|farmer|buyer|logistics)$")
    country: Optional[str] = Field(default=None, pattern="^[A-Za-z]{2}$")


class OnboardingProfileUpdate(BaseModel):
    # All optional — caller merges only the fields they have.
    country: Optional[str] = None
    # Investor
    investment_goal: Optional[str] = None  # passive_income | growth | diversification
    risk_preference: Optional[str] = None  # low | medium | high
    # Farmer
    farm_type: Optional[str] = None
    location: Optional[str] = None
    funding_need_range: Optional[str] = None  # "0-500k" | "500k-5M" | "5M+"
    # Buyer
    commodity_interest: Optional[str] = None  # free text or csv
    volume_range: Optional[str] = None


def register(api: APIRouter, *, db, current_user, hash_password, new_id, ensure_wallet,
             ledger, token_for):
    """`token_for(user)` issues the same JWT the password login endpoint returns."""

    # ---------------- Google OAuth ----------------
    @api.post("/auth/google/session")
    async def google_session(body: GoogleSessionPayload, response: Response):
        # Call Emergent to resolve the session_id into real user data.
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                r = await client.get(
                    EMERGENT_SESSION_URL,
                    headers={"X-Session-ID": body.session_id},
                )
            except httpx.RequestError as e:
                raise HTTPException(502, f"Auth provider unreachable: {e}")
        if r.status_code != 200:
            raise HTTPException(401, "Invalid or expired Google session")
        data = r.json()
        email = (data.get("email") or "").lower().strip()
        name = (data.get("name") or email.split("@")[0] or "User").strip()
        picture = data.get("picture") or ""
        session_token = data.get("session_token") or ""
        if not email or not session_token:
            raise HTTPException(400, "Auth provider returned incomplete payload")

        # Find or create user. Keep password-based users — if the email already
        # exists with a password, we simply log them in via Google (zero conflict).
        user = await db.users.find_one({"email": email}, {"_id": 0})
        is_new = user is None
        if is_new:
            uid = new_id()
            role = body.role or "investor"
            country = (body.country or "NG").upper()
            user = {
                "id": uid,
                "email": email,
                # Non-password account: store an un-matchable hash placeholder.
                "password_hash": hash_password(new_id() + "!GOOGLE!" + new_id()),
                "full_name": name,
                "role": role,
                "phone": "",
                "location": "",
                "country": country,
                "currency": {"NG": "NGN", "GH": "GHS", "KE": "KES", "CI": "XOF"}.get(country, "NGN"),
                "verified": False,
                "kyc_status": "pending",
                "auth_provider": "google",
                "avatar_url": picture,
                "onboarding_step": 1,  # account done → profile next
                "referral_code": f"AF-{uid[:6].upper()}",
                "created_at": datetime.now(timezone.utc),
            }
            await db.users.insert_one(user.copy())
            await ensure_wallet(uid)
        else:
            # Returning user — refresh name + picture if provided, upgrade onboarding_step if missing.
            updates: dict[str, Any] = {"auth_provider_last": "google"}
            if picture and not user.get("avatar_url"):
                updates["avatar_url"] = picture
            if "onboarding_step" not in user:
                # Existing mature user — mark onboarding complete.
                updates["onboarding_step"] = 5
            await db.users.update_one({"email": email}, {"$set": updates})
            user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})

        # Store Emergent session_token server-side for cookie-based auth.
        await db.auth_sessions.insert_one({
            "id": new_id(),
            "user_id": user["id"],
            "session_token": session_token,
            "provider": "google",
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })

        # Set httpOnly cookie (7d)
        response.set_cookie(
            key="session_token",
            value=session_token,
            max_age=7 * 24 * 60 * 60,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
        )

        # Also issue JWT so the existing Authorization-header flows keep working.
        jwt_token = token_for(user)

        # Scrub mongo-native types for JSON
        safe_user = {k: v for k, v in user.items() if k != "password_hash"}
        for k, v in list(safe_user.items()):
            if isinstance(v, datetime):
                safe_user[k] = v.isoformat()

        return {
            "ok": True,
            "is_new": is_new,
            "token": jwt_token,
            "user": safe_user,
            "next_hint": "/onboarding/profile" if is_new else "/app",
        }

    @api.post("/auth/logout")
    async def logout(response: Response, session_token: Optional[str] = Cookie(default=None)):
        if session_token:
            await db.auth_sessions.delete_many({"session_token": session_token})
        response.delete_cookie("session_token", path="/")
        return {"ok": True}

    # ---------------- Onboarding ----------------
    @api.get("/onboarding/state")
    async def onboarding_state(user: dict = Depends(current_user)):
        step = int(user.get("onboarding_step", 0) or 0)
        profile = {
            "country": user.get("country"),
            "investment_goal": user.get("investment_goal"),
            "risk_preference": user.get("risk_preference"),
            "farm_type": user.get("farm_type"),
            "location": user.get("location"),
            "funding_need_range": user.get("funding_need_range"),
            "commodity_interest": user.get("commodity_interest"),
            "volume_range": user.get("volume_range"),
        }
        return {
            "step": step,
            "total_steps": 5,
            "percent": min(100, int(step / 5 * 100)),
            "role": user.get("role"),
            "profile": profile,
            "kyc_status": user.get("kyc_status", "pending"),
            "verified": bool(user.get("verified")),
        }

    @api.patch("/onboarding/profile")
    async def onboarding_profile(body: OnboardingProfileUpdate, user: dict = Depends(current_user)):
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        if updates:
            await db.users.update_one({"id": user["id"]}, {"$set": updates})
        # Advance step 1 → 2 after profile save (idempotent)
        current_step = int(user.get("onboarding_step", 0) or 0)
        if current_step < 2:
            await db.users.update_one({"id": user["id"]}, {"$set": {"onboarding_step": 2}})
        return {"ok": True, "saved": list(updates.keys())}

    @api.post("/onboarding/advance")
    async def onboarding_advance(user: dict = Depends(current_user)):
        current_step = int(user.get("onboarding_step", 0) or 0)
        next_step = min(5, current_step + 1)
        await db.users.update_one({"id": user["id"]}, {"$set": {"onboarding_step": next_step}})
        return {"ok": True, "step": next_step}

    @api.post("/onboarding/complete")
    async def onboarding_complete(user: dict = Depends(current_user)):
        await db.users.update_one({"id": user["id"]}, {"$set": {"onboarding_step": 5}})
        return {"ok": True, "step": 5}
