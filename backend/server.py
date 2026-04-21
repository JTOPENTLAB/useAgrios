"""AGRIOS — African agricultural financial infrastructure.

MVP backend (Phase 1). FastAPI + MongoDB (motor).
All routes are prefixed with /api. No _id leaks to clients.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import bcrypt
import jwt
import requests
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------- Config ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))
COMMISSION_PCT = float(os.environ.get("COMMISSION_PCT", "5"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Object storage
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "agriflow"
storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        return storage_key
    except Exception as e:
        logging.exception("Storage init failed: %s", e)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage not initialized")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage not initialized")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("agriflow")

app = FastAPI(title="AgriFlow API", version="0.1.0")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

Role = Literal["farmer", "buyer", "logistics", "admin", "investor"]
OrderStatus = Literal[
    "awaiting_payment",
    "escrow_funded",
    "in_logistics",
    "in_transit",
    "delivered",
    "completed",
    "cancelled",
    "disputed",
]
JobStatus = Literal["pending", "accepted", "picked_up", "in_transit", "delivered", "cancelled"]
EscrowStatus = Literal["pending", "funded", "released", "refunded", "disputed"]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------- Models ----------------
class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: Role
    phone: Optional[str] = None
    business_name: Optional[str] = None
    location: Optional[str] = None
    referral_code: Optional[str] = None
    farm_size_hectares: Optional[float] = None
    country: Optional[str] = "NG"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseDoc):
    id: str
    email: EmailStr
    full_name: str
    role: Role
    phone: Optional[str] = None
    business_name: Optional[str] = None
    location: Optional[str] = None
    kyc_status: str = "unverified"
    verified: bool = False
    referral_code: Optional[str] = None
    farm_size_hectares: Optional[float] = None
    subscription_tier: Optional[str] = "basic"
    subscription_expires_at: Optional[str] = None
    country: Optional[str] = "NG"
    currency: Optional[str] = "NGN"
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class KYCSubmit(BaseModel):
    document_type: str
    document_number: str
    full_name: str
    address: str


class ListingCreate(BaseModel):
    crop: str
    variety: Optional[str] = None
    quantity_kg: float = Field(gt=0)
    price_per_kg: float = Field(gt=0)
    grade: Literal["A", "B", "C"] = "A"
    location: str
    description: Optional[str] = ""
    image_url: Optional[str] = None
    available_from: Optional[str] = None


class ListingUpdate(BaseModel):
    quantity_kg: Optional[float] = None
    price_per_kg: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[Literal["active", "paused", "sold"]] = None


class OfferCreate(BaseModel):
    listing_id: str
    quantity_kg: float = Field(gt=0)
    price_per_kg: float = Field(gt=0)
    message: Optional[str] = ""


class OfferAction(BaseModel):
    action: Literal["accept", "reject"]


class OrderCreate(BaseModel):
    listing_id: str
    quantity_kg: float = Field(gt=0)
    delivery_address: str
    delivery_notes: Optional[str] = ""


class FundWallet(BaseModel):
    amount: float = Field(gt=0)


class PayoutRequest(BaseModel):
    amount: float = Field(gt=0)
    bank_account: str


class JobAccept(BaseModel):
    pass


class JobStatusUpdate(BaseModel):
    status: Literal["picked_up", "in_transit", "delivered"]
    notes: Optional[str] = ""
    proof_url: Optional[str] = None


class ReviewCreate(BaseModel):
    order_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


class DisputeCreate(BaseModel):
    order_id: str
    reason: str
    description: str


class DisputeResolve(BaseModel):
    resolution: Literal["release_to_farmer", "refund_buyer", "split"]
    notes: Optional[str] = ""


class AIPriceIn(BaseModel):
    crop: str
    region: str
    grade: str = "A"
    quantity_kg: float = 100
    season: Optional[str] = None


class AIVideoIn(BaseModel):
    crop: str
    quantity_kg: float
    price_per_kg: float
    location: str
    grade: str = "A"


# ---------------- Helpers ----------------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing auth token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def _checker(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {roles}")
        return user

    return _checker


def serialize(doc: dict) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id" and k != "password_hash"}
    return d


async def ensure_wallet(user_id: str) -> dict:
    w = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    if w:
        return w
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    cinfo = country_info(u.get("country") if u else "NG")
    w = {
        "user_id": user_id,
        "available": 0.0,
        "pending": 0.0,
        "escrow_held": 0.0,
        "currency": cinfo["currency"],
        "country": cinfo["code"],
        "created_at": utcnow(),
    }
    await db.wallets.insert_one(w.copy())
    return w


async def ledger(
    user_id: str, kind: str, amount: float, direction: str, ref: str, note: str = ""
) -> None:
    entry = {
        "id": new_id(),
        "user_id": user_id,
        "kind": kind,  # fund, escrow_lock, escrow_release, payout, commission, refund
        "amount": amount,
        "direction": direction,  # credit / debit
        "ref": ref,
        "note": note,
        "created_at": utcnow(),
    }
    await db.ledger.insert_one(entry.copy())


async def public_user(user_id: str) -> dict:
    u = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0, "kyc": 0}
    )
    return u or {"id": user_id, "full_name": "Unknown"}


# ---------------- Auth ----------------
@api.post("/auth/signup", response_model=AuthResponse)
async def signup(body: SignupIn):
    if body.role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts are provisioned by the system")
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = new_id()
    ref_code = "AF-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    cinfo = country_info(body.country)
    doc = {
        "id": uid,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
        "business_name": body.business_name,
        "location": body.location,
        "farm_size_hectares": body.farm_size_hectares,
        "kyc_status": "unverified",
        "verified": False,
        "referral_code": ref_code,
        "referred_by": None,
        "country": cinfo["code"],
        "currency": cinfo["currency"],
        "created_at": utcnow(),
    }
    # Apply referral if provided
    if body.referral_code:
        referrer = await db.users.find_one({"referral_code": body.referral_code.strip().upper()})
        if referrer:
            doc["referred_by"] = referrer["id"]
    await db.users.insert_one(doc.copy())
    await ensure_wallet(uid)
    # First-order signup bonus for buyers
    if body.role == "buyer":
        bonus = float(cinfo.get("signup_bonus") or 0)
        if bonus > 0:
            await db.wallets.update_one({"user_id": uid}, {"$inc": {"available": bonus}})
            await ledger(uid, "signup_bonus", bonus, "credit", "welcome", "Welcome bonus — first order on AgriFlow")
            await db.users.update_one({"id": uid}, {"$set": {"signup_bonus_given": True, "signup_bonus_amount": bonus}})
            await notify(uid, "Welcome bonus credited 🎁", f"{cinfo['symbol']}{bonus:,.0f} added to your wallet. Fund your first order on AgriFlow.", "bonus", "welcome")
    user_view = {k: v for k, v in doc.items() if k != "password_hash"}
    return AuthResponse(token=make_token(uid, body.role), user=UserOut(**user_view))


@api.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await ensure_wallet(u["id"])
    user_view = {k: v for k, v in u.items() if k != "password_hash" and k != "_id"}
    return AuthResponse(token=make_token(u["id"], u["role"]), user=UserOut(**user_view))


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    await _check_subscription_reminder(user)
    return UserOut(**user)


async def _check_subscription_reminder(user: dict) -> None:
    """Fire a one-time reminder 3 days before subscription expiry."""
    exp = user.get("subscription_expires_at")
    tier = user.get("subscription_tier")
    if not exp or not tier or tier == "basic":
        return
    try:
        exp_dt = datetime.fromisoformat(exp)
    except Exception:
        return
    now = datetime.now(timezone.utc)
    days_left = (exp_dt - now).days
    if days_left < 0 or days_left > 3:
        return
    # Only fire once per expiry date
    ref = f"renew:{tier}:{exp[:10]}"
    existing = await db.notifications.find_one({"user_id": user["id"], "ref": ref})
    if existing:
        return
    await notify(
        user["id"],
        f"Your {tier.title()} plan expires in {days_left} day{'s' if days_left != 1 else ''}",
        f"Top up your wallet or renew to keep priority sourcing active. Expires {exp_dt.strftime('%b %d, %Y')}.",
        "subscription",
        ref,
    )


# ---------------- KYC / Profile ----------------
@api.post("/users/kyc")
async def submit_kyc(body: KYCSubmit, user: dict = Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "kyc": body.model_dump(),
                "kyc_status": "pending",
                "kyc_submitted_at": utcnow(),
            }
        },
    )
    return {"ok": True, "kyc_status": "pending"}


@api.get("/users/public/{user_id}")
async def get_public_user(user_id: str):
    u = await public_user(user_id)
    return u


# ---------------- Listings ----------------
@api.post("/listings")
async def create_listing(body: ListingCreate, user: dict = Depends(require_roles("farmer"))):
    cinfo = country_info(user.get("country"))
    doc = {
        "id": new_id(),
        "farmer_id": user["id"],
        "farmer_name": user["full_name"],
        "farmer_verified": user.get("verified", False),
        "country": cinfo["code"],
        "currency": cinfo["currency"],
        **body.model_dump(),
        "status": "active",
        "created_at": utcnow(),
    }
    await db.listings.insert_one(doc.copy())
    # Phase D: fire price alerts for matching buyers
    try:
        await _check_alerts_for_listing(doc)
    except Exception:
        logger.exception("price alert check failed")
    return serialize(doc)


@api.get("/listings")
async def list_listings(
    q: Optional[str] = None,
    crop: Optional[str] = None,
    location: Optional[str] = None,
    grade: Optional[str] = None,
    sort: Optional[str] = None,
):
    filt: dict[str, Any] = {"status": "active"}
    if crop:
        filt["crop"] = {"$regex": crop, "$options": "i"}
    if location:
        filt["location"] = {"$regex": location, "$options": "i"}
    if grade:
        filt["grade"] = grade
    if q:
        filt["$or"] = [
            {"crop": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"variety": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.listings.find(filt, {"_id": 0})
    if sort == "trending":
        cursor = cursor.sort("views", -1)
    elif sort == "price_low":
        cursor = cursor.sort("price_per_kg", 1)
    elif sort == "price_high":
        cursor = cursor.sort("price_per_kg", -1)
    else:
        cursor = cursor.sort("created_at", -1)
    items = await cursor.to_list(200)
    return items


@api.get("/listings/mine")
async def my_listings(user: dict = Depends(require_roles("farmer"))):
    items = (
        await db.listings.find({"farmer_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return items


@api.get("/listings/trending")
async def trending_listings():
    items = (
        await db.listings.find({"status": "active"}, {"_id": 0})
        .sort("views", -1)
        .limit(6)
        .to_list(6)
    )
    return items


@api.get("/listings/saved")
async def saved_listings(user: dict = Depends(require_roles("buyer"))):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    ids = (u or {}).get("saved_listings", [])
    if not ids:
        return []
    items = await db.listings.find({"id": {"$in": ids}, "status": "active"}, {"_id": 0}).to_list(200)
    return items


@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str, request_: Optional[dict] = None, ua: Optional[str] = Header(default=None, alias="User-Agent"), xff: Optional[str] = Header(default=None, alias="X-Forwarded-For")):
    l = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Listing not found")
    # Bump view counter (lifetime) + log ephemeral view event (Phase E)
    await db.listings.update_one({"id": listing_id}, {"$inc": {"views": 1}})
    l["views"] = (l.get("views") or 0) + 1
    # Identify viewer (anon IP-ish fingerprint is fine — this is only a 10-min heuristic)
    viewer_id = (xff or "").split(",")[0].strip() or (ua or "anon")[:50]
    try:
        await db.listing_views.insert_one({
            "listing_id": listing_id,
            "viewer_id": viewer_id,
            "at": datetime.now(timezone.utc),
        })
    except Exception:
        pass
    return l


@api.post("/listings/{listing_id}/save")
async def toggle_save(listing_id: str, user: dict = Depends(require_roles("buyer"))):
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(404, "Listing not found")
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    saved = set((u or {}).get("saved_listings", []))
    if listing_id in saved:
        saved.discard(listing_id)
        await db.listings.update_one({"id": listing_id}, {"$inc": {"saves": -1}})
        action = "unsaved"
    else:
        saved.add(listing_id)
        await db.listings.update_one({"id": listing_id}, {"$inc": {"saves": 1}})
        action = "saved"
    await db.users.update_one({"id": user["id"]}, {"$set": {"saved_listings": list(saved)}})
    return {"ok": True, "action": action, "saved": action == "saved"}


@api.patch("/listings/{listing_id}")
async def update_listing(
    listing_id: str, body: ListingUpdate, user: dict = Depends(require_roles("farmer"))
):
    l = await db.listings.find_one({"id": listing_id})
    if not l or l["farmer_id"] != user["id"]:
        raise HTTPException(404, "Not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.listings.update_one({"id": listing_id}, {"$set": updates})
    l = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    return l


# ---------------- Offers ----------------
@api.post("/offers")
async def create_offer(body: OfferCreate, user: dict = Depends(require_roles("buyer"))):
    l = await db.listings.find_one({"id": body.listing_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Listing not found")
    doc = {
        "id": new_id(),
        "listing_id": body.listing_id,
        "farmer_id": l["farmer_id"],
        "buyer_id": user["id"],
        "buyer_name": user["full_name"],
        "crop": l["crop"],
        "quantity_kg": body.quantity_kg,
        "price_per_kg": body.price_per_kg,
        "message": body.message,
        "status": "pending",
        "created_at": utcnow(),
    }
    await db.offers.insert_one(doc.copy())
    await notify(l["farmer_id"], "New offer received", f"{user['full_name']} offered ₦{body.price_per_kg:,.0f}/kg for {body.quantity_kg}kg of {l['crop']}.", "offer", doc["id"])
    return serialize(doc)


@api.get("/offers/farmer")
async def offers_for_farmer(user: dict = Depends(require_roles("farmer"))):
    items = (
        await db.offers.find({"farmer_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return items


@api.get("/offers/buyer")
async def offers_by_buyer(user: dict = Depends(require_roles("buyer"))):
    items = (
        await db.offers.find({"buyer_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return items


@api.post("/offers/{offer_id}/action")
async def action_offer(
    offer_id: str, body: OfferAction, user: dict = Depends(require_roles("farmer"))
):
    o = await db.offers.find_one({"id": offer_id})
    if not o or o["farmer_id"] != user["id"]:
        raise HTTPException(404, "Offer not found")
    new_status = "accepted" if body.action == "accept" else "rejected"
    await db.offers.update_one({"id": offer_id}, {"$set": {"status": new_status}})
    return {"ok": True, "status": new_status}


# ---------------- Orders + Escrow ----------------
@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(require_roles("buyer"))):
    l = await db.listings.find_one({"id": body.listing_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Listing not found")
    if body.quantity_kg > l["quantity_kg"]:
        raise HTTPException(400, "Insufficient quantity in listing")
    total = round(body.quantity_kg * l["price_per_kg"], 2)
    commission = round(total * (COMMISSION_PCT / 100), 2)
    farmer_amount = round(total - commission, 2)
    order_id = new_id()
    doc = {
        "id": order_id,
        "listing_id": l["id"],
        "crop": l["crop"],
        "country": l.get("country", "NG"),
        "currency": l.get("currency", "NGN"),
        "buyer_id": user["id"],
        "buyer_name": user["full_name"],
        "farmer_id": l["farmer_id"],
        "farmer_name": l["farmer_name"],
        "quantity_kg": body.quantity_kg,
        "price_per_kg": l["price_per_kg"],
        "total": total,
        "commission": commission,
        "farmer_amount": farmer_amount,
        "delivery_address": body.delivery_address,
        "delivery_notes": body.delivery_notes,
        "status": "awaiting_payment",
        "escrow_status": "pending",
        "created_at": utcnow(),
        "timeline": [{"ts": utcnow(), "event": "order_created", "by": "buyer"}],
    }
    await db.orders.insert_one(doc.copy())
    return serialize(doc)


@api.get("/orders")
async def list_orders(user: dict = Depends(current_user)):
    if user["role"] == "farmer":
        filt = {"farmer_id": user["id"]}
    elif user["role"] == "buyer":
        filt = {"buyer_id": user["id"]}
    elif user["role"] == "admin":
        filt = {}
    else:
        filt = {"logistics_id": user["id"]}
    items = await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    allowed = user["role"] == "admin" or user["id"] in (
        o.get("buyer_id"),
        o.get("farmer_id"),
        o.get("logistics_id"),
    )
    if not allowed:
        raise HTTPException(403, "Forbidden")
    return o


@api.post("/orders/{order_id}/fund-escrow")
async def fund_escrow(order_id: str, user: dict = Depends(require_roles("buyer"))):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["buyer_id"] != user["id"]:
        raise HTTPException(404, "Order not found")
    if o["escrow_status"] != "pending":
        raise HTTPException(400, "Escrow already processed")
    w = await ensure_wallet(user["id"])
    if w["available"] < o["total"]:
        raise HTTPException(400, f"Insufficient wallet balance. Need ₦{o['total']:.2f}")
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"available": -o["total"], "escrow_held": o["total"]}},
    )
    await ledger(
        user["id"], "escrow_lock", o["total"], "debit", order_id, f"Escrow for order {order_id[:8]}"
    )
    # reduce listing qty
    await db.listings.update_one(
        {"id": o["listing_id"]}, {"$inc": {"quantity_kg": -o["quantity_kg"]}}
    )
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": "escrow_funded", "escrow_status": "funded"},
            "$push": {"timeline": {"ts": utcnow(), "event": "escrow_funded", "by": "buyer"}},
        },
    )
    # Auto create logistics job
    job = {
        "id": new_id(),
        "order_id": order_id,
        "crop": o["crop"],
        "quantity_kg": o["quantity_kg"],
        "pickup_from": o.get("farmer_name"),
        "deliver_to": o["delivery_address"],
        "buyer_name": o["buyer_name"],
        "farmer_id": o["farmer_id"],
        "buyer_id": o["buyer_id"],
        "status": "pending",
        "payout": round(o["total"] * 0.08, 2),
        "created_at": utcnow(),
    }
    await db.logistics_jobs.insert_one(job.copy())
    await notify(o["farmer_id"], "Order funded", f"Escrow funded for your {o['crop']} order. Logistics pending.", "order", order_id)
    return {"ok": True, "order_id": order_id, "status": "escrow_funded"}


@api.post("/orders/{order_id}/reorder")
async def reorder(order_id: str, user: dict = Depends(require_roles("buyer"))):
    original = await db.orders.find_one({"id": order_id})
    if not original or original["buyer_id"] != user["id"]:
        raise HTTPException(404, "Order not found")
    listing = await db.listings.find_one({"id": original["listing_id"]}, {"_id": 0})
    if not listing or listing.get("status") != "active":
        raise HTTPException(400, "Listing no longer available — please browse for alternatives")
    qty = min(float(original["quantity_kg"]), float(listing["quantity_kg"]))
    if qty <= 0:
        raise HTTPException(400, "Out of stock")
    total = round(qty * listing["price_per_kg"], 2)
    commission = round(total * (COMMISSION_PCT / 100), 2)
    farmer_amount = round(total - commission, 2)
    new_order_id = new_id()
    doc = {
        "id": new_order_id,
        "listing_id": listing["id"],
        "crop": listing["crop"],
        "country": listing.get("country", "NG"),
        "currency": listing.get("currency", "NGN"),
        "buyer_id": user["id"],
        "buyer_name": user["full_name"],
        "farmer_id": listing["farmer_id"],
        "farmer_name": listing["farmer_name"],
        "quantity_kg": qty,
        "price_per_kg": listing["price_per_kg"],
        "total": total,
        "commission": commission,
        "farmer_amount": farmer_amount,
        "delivery_address": original["delivery_address"],
        "delivery_notes": original.get("delivery_notes", ""),
        "status": "awaiting_payment",
        "escrow_status": "pending",
        "reorder_of": order_id,
        "created_at": utcnow(),
        "timeline": [{"ts": utcnow(), "event": "order_created_from_reorder", "by": "buyer"}],
    }
    await db.orders.insert_one(doc.copy())
    # Auto-fund if wallet has enough
    wallet = await ensure_wallet(user["id"])
    auto_funded = False
    if wallet["available"] >= total:
        await db.wallets.update_one(
            {"user_id": user["id"]},
            {"$inc": {"available": -total, "escrow_held": total}},
        )
        await ledger(user["id"], "escrow_lock", total, "debit", new_order_id, f"Reorder escrow (from {order_id[:8]})")
        await db.listings.update_one({"id": listing["id"]}, {"$inc": {"quantity_kg": -qty}})
        await db.orders.update_one(
            {"id": new_order_id},
            {
                "$set": {"status": "escrow_funded", "escrow_status": "funded"},
                "$push": {"timeline": {"ts": utcnow(), "event": "escrow_funded", "by": "buyer"}},
            },
        )
        job = {
            "id": new_id(),
            "order_id": new_order_id,
            "crop": listing["crop"],
            "quantity_kg": qty,
            "pickup_from": listing["farmer_name"],
            "deliver_to": original["delivery_address"],
            "buyer_name": user["full_name"],
            "farmer_id": listing["farmer_id"],
            "buyer_id": user["id"],
            "status": "pending",
            "payout": round(total * 0.08, 2),
            "created_at": utcnow(),
        }
        await db.logistics_jobs.insert_one(job.copy())
        await notify(listing["farmer_id"], "Repeat order received 🔁", f"{user['full_name']} reordered {qty}kg of {listing['crop']}.", "order", new_order_id)
        auto_funded = True
    return {"ok": True, "order_id": new_order_id, "auto_funded": auto_funded, "total": total, "quantity_kg": qty}


@api.post("/orders/{order_id}/confirm-delivery")
async def confirm_delivery(order_id: str, user: dict = Depends(require_roles("buyer"))):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["buyer_id"] != user["id"]:
        raise HTTPException(404, "Order not found")
    if o["status"] != "delivered":
        raise HTTPException(400, "Order is not delivered yet")
    # Release escrow to farmer wallet, take commission
    await db.wallets.update_one(
        {"user_id": user["id"]}, {"$inc": {"escrow_held": -o["total"]}}
    )
    await ensure_wallet(o["farmer_id"])
    await db.wallets.update_one(
        {"user_id": o["farmer_id"]}, {"$inc": {"available": o["farmer_amount"]}}
    )
    await ledger(
        user["id"],
        "escrow_release",
        o["total"],
        "debit",
        order_id,
        "Released from escrow",
    )
    await ledger(
        o["farmer_id"],
        "escrow_release",
        o["farmer_amount"],
        "credit",
        order_id,
        f"Payment for order {order_id[:8]}",
    )
    await ledger(
        "platform",
        "commission",
        o["commission"],
        "credit",
        order_id,
        f"Commission from order {order_id[:8]}",
    )
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": "completed", "escrow_status": "released"},
            "$push": {"timeline": {"ts": utcnow(), "event": "completed", "by": "buyer"}},
        },
    )
    await notify(o["farmer_id"], "Payment released 🎉", f"₦{o['farmer_amount']:,.0f} added to your wallet for order {order_id[:8].upper()}.", "order", order_id)
    await notify(o["buyer_id"], "Order completed", f"Delivery confirmed. Thanks for using AgriFlow!", "order", order_id)
    # Referral bonus on buyer's FIRST completed order
    buyer = await db.users.find_one({"id": o["buyer_id"]}, {"_id": 0})
    if buyer and buyer.get("referred_by") and not buyer.get("referral_bonus_given"):
        completed_count = await db.orders.count_documents({"buyer_id": o["buyer_id"], "status": "completed"})
        if completed_count == 1:
            bonus = 5000.0
            await db.wallets.update_one({"user_id": o["buyer_id"]}, {"$inc": {"available": bonus}})
            await ensure_wallet(buyer["referred_by"])
            await db.wallets.update_one({"user_id": buyer["referred_by"]}, {"$inc": {"available": bonus}})
            await ledger(o["buyer_id"], "referral_bonus", bonus, "credit", order_id, "First-order referral bonus")
            await ledger(buyer["referred_by"], "referral_bonus", bonus, "credit", order_id, "Referred buyer completed first order")
            await db.users.update_one({"id": o["buyer_id"]}, {"$set": {"referral_bonus_given": True}})
            await notify(o["buyer_id"], "Referral bonus credited", f"₦{bonus:,.0f} added for your first completed order.", "referral", order_id)
            await notify(buyer["referred_by"], "Referral paid", f"₦{bonus:,.0f} credited — your referral just completed their first order.", "referral", order_id)
    return {"ok": True, "status": "completed"}


# ---------------- Wallet ----------------
@api.get("/wallet")
async def get_wallet(user: dict = Depends(current_user)):
    w = await ensure_wallet(user["id"])
    entries = (
        await db.ledger.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )
    return {"wallet": {k: v for k, v in w.items() if k != "_id"}, "entries": entries}


@api.post("/wallet/fund")
async def fund_wallet(body: FundWallet, user: dict = Depends(current_user)):
    # Simulated top-up (no real payment gateway in MVP)
    await ensure_wallet(user["id"])
    await db.wallets.update_one(
        {"user_id": user["id"]}, {"$inc": {"available": body.amount}}
    )
    await ledger(
        user["id"], "fund", body.amount, "credit", new_id(), "Wallet top-up (simulated)"
    )
    w = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"ok": True, "wallet": w}


@api.post("/wallet/payout")
async def request_payout(body: PayoutRequest, user: dict = Depends(current_user)):
    wallet = await ensure_wallet(user["id"])
    if wallet["available"] < body.amount:
        raise HTTPException(400, "Insufficient available balance")
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"available": -body.amount, "pending": body.amount}},
    )
    ref = new_id()
    await db.payouts.insert_one(
        {
            "id": ref,
            "user_id": user["id"],
            "amount": body.amount,
            "bank_account": body.bank_account,
            "status": "processing",
            "created_at": utcnow(),
        }
    )
    await ledger(
        user["id"], "payout", body.amount, "debit", ref, f"Payout to {body.bank_account}"
    )
    return {"ok": True, "payout_id": ref, "status": "processing"}


# ---------------- Logistics ----------------
@api.get("/logistics/jobs")
async def list_jobs(
    mine: bool = False, user: dict = Depends(require_roles("logistics", "admin"))
):
    if mine and user["role"] == "logistics":
        filt = {"logistics_id": user["id"]}
    elif user["role"] == "logistics":
        filt = {"$or": [{"status": "pending"}, {"logistics_id": user["id"]}]}
    else:
        filt = {}
    items = (
        await db.logistics_jobs.find(filt, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return items


@api.post("/logistics/jobs/{job_id}/accept")
async def accept_job(job_id: str, user: dict = Depends(require_roles("logistics"))):
    j = await db.logistics_jobs.find_one({"id": job_id})
    if not j:
        raise HTTPException(404, "Job not found")
    if j["status"] != "pending":
        raise HTTPException(400, "Job already taken")
    await db.logistics_jobs.update_one(
        {"id": job_id},
        {
            "$set": {
                "logistics_id": user["id"],
                "logistics_name": user["full_name"],
                "status": "accepted",
                "accepted_at": utcnow(),
            }
        },
    )
    await db.orders.update_one(
        {"id": j["order_id"]},
        {
            "$set": {
                "status": "in_logistics",
                "logistics_id": user["id"],
                "logistics_name": user["full_name"],
            },
            "$push": {
                "timeline": {
                    "ts": utcnow(),
                    "event": "logistics_accepted",
                    "by": user["full_name"],
                }
            },
        },
    )
    return {"ok": True}


@api.post("/logistics/jobs/{job_id}/status")
async def update_job_status(
    job_id: str, body: JobStatusUpdate, user: dict = Depends(require_roles("logistics"))
):
    j = await db.logistics_jobs.find_one({"id": job_id})
    if not j or j.get("logistics_id") != user["id"]:
        raise HTTPException(404, "Job not found")
    updates = {"status": body.status}
    if body.proof_url:
        updates["proof_url"] = body.proof_url
    await db.logistics_jobs.update_one({"id": job_id}, {"$set": updates})
    order_status_map = {
        "picked_up": "in_transit",
        "in_transit": "in_transit",
        "delivered": "delivered",
    }
    await db.orders.update_one(
        {"id": j["order_id"]},
        {
            "$set": {"status": order_status_map[body.status]},
            "$push": {
                "timeline": {
                    "ts": utcnow(),
                    "event": body.status,
                    "by": user["full_name"],
                    "notes": body.notes,
                }
            },
        },
    )
    return {"ok": True, "status": body.status}


# ---------------- Reviews ----------------
@api.post("/reviews")
async def create_review(body: ReviewCreate, user: dict = Depends(current_user)):
    o = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["id"] not in (o["buyer_id"], o["farmer_id"]):
        raise HTTPException(403, "Forbidden")
    # Reviewer reviews the other party
    target = o["farmer_id"] if user["id"] == o["buyer_id"] else o["buyer_id"]
    doc = {
        "id": new_id(),
        "order_id": body.order_id,
        "reviewer_id": user["id"],
        "reviewer_name": user["full_name"],
        "target_id": target,
        "rating": body.rating,
        "comment": body.comment,
        "created_at": utcnow(),
    }
    await db.reviews.insert_one(doc.copy())
    return serialize(doc)


@api.get("/reviews/user/{user_id}")
async def reviews_for_user(user_id: str):
    items = (
        await db.reviews.find({"target_id": user_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )
    return items


# ---------------- Disputes ----------------
@api.post("/disputes")
async def create_dispute(body: DisputeCreate, user: dict = Depends(current_user)):
    o = await db.orders.find_one({"id": body.order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["id"] not in (o["buyer_id"], o["farmer_id"]):
        raise HTTPException(403, "Forbidden")
    doc = {
        "id": new_id(),
        "order_id": body.order_id,
        "raised_by": user["id"],
        "raised_by_name": user["full_name"],
        "reason": body.reason,
        "description": body.description,
        "status": "open",
        "created_at": utcnow(),
    }
    await db.disputes.insert_one(doc.copy())
    await db.orders.update_one(
        {"id": body.order_id},
        {"$set": {"status": "disputed"}, "$push": {"timeline": {"ts": utcnow(), "event": "disputed", "by": user["full_name"]}}},
    )
    return serialize(doc)


@api.get("/disputes")
async def list_disputes(user: dict = Depends(current_user)):
    if user["role"] == "admin":
        filt = {}
    else:
        filt = {"raised_by": user["id"]}
    items = await db.disputes.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str, body: DisputeResolve, user: dict = Depends(require_roles("admin"))
):
    d = await db.disputes.find_one({"id": dispute_id})
    if not d:
        raise HTTPException(404, "Dispute not found")
    o = await db.orders.find_one({"id": d["order_id"]})
    if not o:
        raise HTTPException(404, "Order not found")
    if body.resolution == "release_to_farmer":
        await db.wallets.update_one(
            {"user_id": o["buyer_id"]}, {"$inc": {"escrow_held": -o["total"]}}
        )
        await ensure_wallet(o["farmer_id"])
        await db.wallets.update_one(
            {"user_id": o["farmer_id"]}, {"$inc": {"available": o["farmer_amount"]}}
        )
        await ledger(o["farmer_id"], "escrow_release", o["farmer_amount"], "credit", o["id"], "Dispute resolved: released")
        await db.orders.update_one({"id": o["id"]}, {"$set": {"status": "completed", "escrow_status": "released"}})
    elif body.resolution == "refund_buyer":
        await db.wallets.update_one(
            {"user_id": o["buyer_id"]},
            {"$inc": {"escrow_held": -o["total"], "available": o["total"]}},
        )
        await ledger(o["buyer_id"], "refund", o["total"], "credit", o["id"], "Dispute resolved: refunded")
        await db.orders.update_one({"id": o["id"]}, {"$set": {"status": "cancelled", "escrow_status": "refunded"}})
    else:  # split
        half = round(o["total"] / 2, 2)
        await db.wallets.update_one(
            {"user_id": o["buyer_id"]},
            {"$inc": {"escrow_held": -o["total"], "available": half}},
        )
        await ensure_wallet(o["farmer_id"])
        await db.wallets.update_one(
            {"user_id": o["farmer_id"]}, {"$inc": {"available": half}}
        )
        await ledger(o["buyer_id"], "refund", half, "credit", o["id"], "Dispute split refund")
        await ledger(o["farmer_id"], "escrow_release", half, "credit", o["id"], "Dispute split settlement")
        await db.orders.update_one({"id": o["id"]}, {"$set": {"status": "completed", "escrow_status": "released"}})
    await db.disputes.update_one(
        {"id": dispute_id},
        {
            "$set": {
                "status": "resolved",
                "resolution": body.resolution,
                "resolution_notes": body.notes,
                "resolved_at": utcnow(),
                "resolved_by": user["id"],
            }
        },
    )
    return {"ok": True, "resolution": body.resolution}


# ---------------- Admin ----------------
@api.get("/admin/overview")
async def admin_overview(user: dict = Depends(require_roles("admin"))):
    users_count = await db.users.count_documents({})
    farmers = await db.users.count_documents({"role": "farmer"})
    buyers = await db.users.count_documents({"role": "buyer"})
    listings = await db.listings.count_documents({"status": "active"})
    orders = await db.orders.count_documents({})
    completed = await db.orders.count_documents({"status": "completed"})
    disputes = await db.disputes.count_documents({"status": "open"})
    pipeline = [{"$group": {"_id": None, "gmv": {"$sum": "$total"}, "commission": {"$sum": "$commission"}}}]
    agg = await db.orders.aggregate(pipeline).to_list(1)
    gmv = agg[0]["gmv"] if agg else 0
    commission = agg[0]["commission"] if agg else 0
    return {
        "users": users_count,
        "farmers": farmers,
        "buyers": buyers,
        "active_listings": listings,
        "orders": orders,
        "completed_orders": completed,
        "open_disputes": disputes,
        "gmv": round(gmv, 2),
        "platform_commission": round(commission, 2),
    }


@api.get("/admin/users")
async def admin_users(user: dict = Depends(require_roles("admin"))):
    items = (
        await db.users.find({}, {"_id": 0, "password_hash": 0})
        .sort("created_at", -1)
        .to_list(1000)
    )
    return items


@api.post("/admin/users/{user_id}/verify")
async def admin_verify_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    await db.users.update_one(
        {"id": user_id}, {"$set": {"verified": True, "kyc_status": "verified"}}
    )
    return {"ok": True}


@api.get("/admin/disputes")
async def admin_disputes(user: dict = Depends(require_roles("admin"))):
    items = await db.disputes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# ---------------- AI (Claude) ----------------
async def _claude_call(system: str, prompt: str) -> str:
    if not EMERGENT_LLM_KEY:
        return "AI service not configured."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=new_id(),
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=prompt))
        return resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.exception("Claude call failed")
        return f"AI temporarily unavailable: {e}"


@api.post("/ai/price-recommendation")
async def ai_price(body: AIPriceIn, user: dict = Depends(current_user)):
    system = (
        "You are an expert agricultural market analyst for Nigeria and West Africa. "
        "Provide concise, practical, data-informed price guidance. Use Naira (₦)."
    )
    prompt = (
        f"Recommend a fair wholesale price per kg in Naira for {body.crop} "
        f"(grade {body.grade}) in {body.region}. "
        f"Quantity: {body.quantity_kg} kg. Season: {body.season or 'current'}.\n\n"
        "Return in this structure (short, no preamble):\n"
        "• Suggested price range (₦/kg)\n"
        "• Key factors (3 bullets)\n"
        "• Best timing to sell (1 line)\n"
        "• Negotiation tip (1 line)"
    )
    text = await _claude_call(system, prompt)
    return {"crop": body.crop, "region": body.region, "recommendation": text}


@api.post("/ai/video-script")
async def ai_video_script(body: AIVideoIn, user: dict = Depends(current_user)):
    system = (
        "You are a top-performing short-form video director for African agri-commerce. "
        "Write punchy, authentic scripts that convert buyers."
    )
    total = body.quantity_kg * body.price_per_kg
    prompt = (
        f"Create a 20-second short-form video script for a Nigerian farmer selling "
        f"{body.quantity_kg}kg of {body.crop} (grade {body.grade}) at ₦{body.price_per_kg}/kg "
        f"(total ₦{total:,.0f}) from {body.location}. "
        "Target: wholesalers, retailers, exporters. Tone: premium, authentic, urgent.\n\n"
        "Return the script as:\n"
        "HOOK (0-3s): ...\n"
        "SCENE 1 (3-8s): ...\n"
        "SCENE 2 (8-14s): ...\n"
        "TRUST BEAT (14-17s): ...\n"
        "CTA (17-20s): ...\n"
        "ON-SCREEN CAPTIONS: bullet list\n"
        "MUSIC: one suggestion (afrobeats/amapiano/etc)\n"
        "CAMERA STYLE: one line"
    )
    text = await _claude_call(system, prompt)
    return {"crop": body.crop, "script": text}


# ---------------- Health + root ----------------
@api.get("/")
async def root():
    return {"service": "AGRIOS API", "status": "ok"}


@api.get("/health")
async def health():
    return {"status": "ok", "time": utcnow()}


# ---------------- Notifications ----------------
async def notify(user_id: str, title: str, body: str, kind: str = "info", ref: Optional[str] = None) -> None:
    if not user_id:
        return
    await db.notifications.insert_one(
        {
            "id": new_id(),
            "user_id": user_id,
            "title": title,
            "body": body,
            "kind": kind,
            "ref": ref,
            "read": False,
            "created_at": utcnow(),
        }
    )


@api.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    items = (
        await db.notifications.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(50)
    )
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- File upload ----------------
ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
}
MAX_UPLOAD_MB = 5


@api.post("/uploads")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    ct = file.content_type or "application/octet-stream"
    if ct not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {ct}")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large (max {MAX_UPLOAD_MB}MB)")
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower()
    sensitive = ct == "application/pdf"
    prefix = "private" if sensitive else "public"
    path = f"{APP_NAME}/uploads/{prefix}/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, ct)
    file_id = new_id()
    await db.files.insert_one(
        {
            "id": file_id,
            "user_id": user["id"],
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": ct,
            "size": result.get("size", len(data)),
            "is_deleted": False,
            "sensitive": sensitive,
            "created_at": utcnow(),
        }
    )
    if sensitive:
        signed = sign_file_url(result["path"], ttl_seconds=3600)
        url = f"/api/files/{result['path']}?sig={signed['sig']}&exp={signed['exp']}"
    else:
        url = f"/api/files/{result['path']}"
    return {"id": file_id, "path": result["path"], "url": url, "size": len(data), "sensitive": sensitive}


def sign_file_url(path: str, ttl_seconds: int = 3600) -> dict:
    exp = int(time.time()) + ttl_seconds
    msg = f"{path}|{exp}".encode()
    sig = hmac.new(JWT_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return {"sig": sig, "exp": exp}


def verify_file_sig(path: str, sig: str, exp: int) -> bool:
    if exp < int(time.time()):
        return False
    msg = f"{path}|{exp}".encode()
    expected = hmac.new(JWT_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


@api.post("/files/{path:path}/sign")
async def sign_sensitive_file(path: str, user: dict = Depends(current_user)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    # Only owner (or admin) can mint signed URLs for sensitive files
    if record.get("sensitive") and user["role"] != "admin" and record["user_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    signed = sign_file_url(path, ttl_seconds=3600)
    return {"url": f"/api/files/{path}?sig={signed['sig']}&exp={signed['exp']}", "exp": signed["exp"]}


@api.get("/files/{path:path}")
async def download_file(path: str, sig: Optional[str] = None, exp: Optional[int] = None):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    if record.get("sensitive"):
        if not sig or not exp or not verify_file_sig(path, sig, exp):
            raise HTTPException(403, "This file requires a valid signed URL")
    data, ctype = get_object(path)
    return Response(
        content=data,
        media_type=record.get("content_type", ctype),
        headers={"Cache-Control": "private, max-age=600" if record.get("sensitive") else "public, max-age=3600"},
    )


# ---------------- Credit scoring ----------------
async def compute_credit_score(user_id: str) -> dict:
    """Score 300-850 based on behaviour. Weighted signals."""
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        return {"score": 300, "band": "D", "signals": {}}
    farm_size = float(u.get("farm_size_hectares") or 0)
    listings_count = await db.listings.count_documents({"farmer_id": user_id})
    completed_orders = await db.orders.count_documents({"farmer_id": user_id, "status": "completed"})
    disputes = await db.disputes.count_documents({"raised_by": user_id})
    agg = await db.orders.aggregate(
        [
            {"$match": {"farmer_id": user_id, "status": "completed"}},
            {"$group": {"_id": None, "gmv": {"$sum": "$total"}}},
        ]
    ).to_list(1)
    gmv = agg[0]["gmv"] if agg else 0
    prev_loans = await db.loans.count_documents({"farmer_id": user_id, "status": "repaid"})
    defaulted = await db.loans.count_documents({"farmer_id": user_id, "status": "defaulted"})
    verified = 1 if u.get("verified") else 0

    signals = {
        "farm_size_hectares": farm_size,
        "listings": listings_count,
        "completed_orders": completed_orders,
        "gmv": round(gmv, 2),
        "previous_repaid_loans": prev_loans,
        "defaulted_loans": defaulted,
        "disputes_raised": disputes,
        "verified": bool(verified),
    }
    # Simple weighted sum
    score = 400
    score += min(farm_size, 20) * 8  # +160 max
    score += min(listings_count, 20) * 3  # +60
    score += min(completed_orders, 30) * 6  # +180
    score += min(gmv / 1000_000, 5) * 10  # +50 per NGN 1M, max 50
    score += prev_loans * 25  # +25 each
    score += verified * 30
    score -= defaulted * 120
    score -= disputes * 10
    score = int(max(300, min(850, score)))
    if score >= 720:
        band = "A"
    elif score >= 640:
        band = "B"
    elif score >= 560:
        band = "C"
    else:
        band = "D"
    return {"score": score, "band": band, "signals": signals}


# ---------------- Loans ----------------
class LoanApply(BaseModel):
    amount: float = Field(gt=0)
    purpose: str
    term_months: int = Field(ge=1, le=24)


class LoanDecision(BaseModel):
    action: Literal["approve", "reject"]
    interest_rate_pct: float = 10.0
    notes: Optional[str] = ""


class LoanRepayIn(BaseModel):
    amount: float = Field(gt=0)


def _repay_schedule(principal: float, rate_pct: float, months: int, start_iso: str) -> list[dict]:
    total = round(principal * (1 + rate_pct / 100), 2)
    monthly = round(total / months, 2)
    start = datetime.fromisoformat(start_iso) if isinstance(start_iso, str) else datetime.now(timezone.utc)
    out = []
    remaining = total
    for i in range(1, months + 1):
        due = start + timedelta(days=30 * i)
        amt = monthly if i < months else round(remaining, 2)
        remaining = round(remaining - amt, 2)
        out.append({"installment": i, "due_date": due.isoformat(), "amount": amt, "paid": False})
    return out


@api.get("/loans/score")
async def get_my_score(user: dict = Depends(require_roles("farmer"))):
    return await compute_credit_score(user["id"])


@api.post("/loans/apply")
async def apply_loan(body: LoanApply, user: dict = Depends(require_roles("farmer"))):
    score = await compute_credit_score(user["id"])
    loan_id = new_id()
    doc = {
        "id": loan_id,
        "farmer_id": user["id"],
        "farmer_name": user["full_name"],
        "amount": body.amount,
        "purpose": body.purpose,
        "term_months": body.term_months,
        "credit_score": score["score"],
        "credit_band": score["band"],
        "credit_signals": score["signals"],
        "status": "pending",
        "created_at": utcnow(),
    }
    await db.loans.insert_one(doc.copy())
    await notify(user["id"], "Loan application received", f"₦{body.amount:,.0f} for {body.purpose}. We'll review within 24h.", "loan", loan_id)
    return serialize(doc)


@api.get("/loans/mine")
async def my_loans(user: dict = Depends(require_roles("farmer"))):
    items = (
        await db.loans.find({"farmer_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )
    return items


@api.get("/loans")
async def all_loans(user: dict = Depends(require_roles("admin"))):
    items = await db.loans.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.get("/loans/{loan_id}")
async def get_loan(loan_id: str, user: dict = Depends(current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(404, "Loan not found")
    if user["role"] != "admin" and loan["farmer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    return loan


@api.post("/loans/{loan_id}/decision")
async def decide_loan(loan_id: str, body: LoanDecision, user: dict = Depends(require_roles("admin"))):
    loan = await db.loans.find_one({"id": loan_id})
    if not loan:
        raise HTTPException(404, "Loan not found")
    if loan["status"] != "pending":
        raise HTTPException(400, "Loan already decided")
    if body.action == "reject":
        await db.loans.update_one(
            {"id": loan_id},
            {"$set": {"status": "rejected", "notes": body.notes, "decided_at": utcnow(), "decided_by": user["id"]}},
        )
        await notify(loan["farmer_id"], "Loan decision", "Your loan application was not approved. See details in your loan page.", "loan", loan_id)
        return {"ok": True, "status": "rejected"}
    # approve
    schedule = _repay_schedule(loan["amount"], body.interest_rate_pct, loan["term_months"], utcnow())
    await db.loans.update_one(
        {"id": loan_id},
        {
            "$set": {
                "status": "approved",
                "interest_rate_pct": body.interest_rate_pct,
                "total_repayable": round(loan["amount"] * (1 + body.interest_rate_pct / 100), 2),
                "outstanding": round(loan["amount"] * (1 + body.interest_rate_pct / 100), 2),
                "schedule": schedule,
                "notes": body.notes,
                "decided_at": utcnow(),
                "decided_by": user["id"],
            }
        },
    )
    await notify(
        loan["farmer_id"],
        "Loan approved 🎉",
        f"Your ₦{loan['amount']:,.0f} loan was approved at {body.interest_rate_pct}% for {loan['term_months']} months.",
        "loan",
        loan_id,
    )
    return {"ok": True, "status": "approved"}


@api.post("/loans/{loan_id}/disburse")
async def disburse_loan(loan_id: str, user: dict = Depends(require_roles("admin"))):
    loan = await db.loans.find_one({"id": loan_id})
    if not loan:
        raise HTTPException(404, "Loan not found")
    if loan["status"] != "approved":
        raise HTTPException(400, "Loan must be approved first")
    await ensure_wallet(loan["farmer_id"])
    await db.wallets.update_one(
        {"user_id": loan["farmer_id"]}, {"$inc": {"available": loan["amount"]}}
    )
    await ledger(
        loan["farmer_id"],
        "loan_disbursement",
        loan["amount"],
        "credit",
        loan_id,
        f"Loan disbursed: {loan['purpose']}",
    )
    await db.loans.update_one(
        {"id": loan_id}, {"$set": {"status": "disbursed", "disbursed_at": utcnow()}}
    )
    await notify(loan["farmer_id"], "Loan disbursed", f"₦{loan['amount']:,.0f} is now in your wallet.", "loan", loan_id)
    return {"ok": True, "status": "disbursed"}


@api.post("/loans/{loan_id}/repay")
async def repay_loan(loan_id: str, body: LoanRepayIn, user: dict = Depends(require_roles("farmer"))):
    loan = await db.loans.find_one({"id": loan_id})
    if not loan or loan["farmer_id"] != user["id"]:
        raise HTTPException(404, "Loan not found")
    if loan["status"] not in ("disbursed", "partially_repaid"):
        raise HTTPException(400, "Loan is not in a repayable state")
    w = await ensure_wallet(user["id"])
    if w["available"] < body.amount:
        raise HTTPException(400, "Insufficient wallet balance")
    outstanding = float(loan.get("outstanding", 0))
    pay = min(body.amount, outstanding)
    await db.wallets.update_one(
        {"user_id": user["id"]}, {"$inc": {"available": -pay}}
    )
    await ledger(user["id"], "loan_repayment", pay, "debit", loan_id, "Loan repayment")
    new_outstanding = round(outstanding - pay, 2)
    new_status = "repaid" if new_outstanding <= 0 else "partially_repaid"
    # Update schedule rows
    sched = loan.get("schedule", [])
    remaining = pay
    for row in sched:
        if row["paid"] or remaining <= 0:
            continue
        row["paid"] = True
        row["paid_at"] = utcnow()
        remaining -= row["amount"]
    await db.loans.update_one(
        {"id": loan_id},
        {"$set": {"outstanding": new_outstanding, "status": new_status, "schedule": sched}},
    )
    await notify(user["id"], "Repayment recorded", f"₦{pay:,.0f} applied. Outstanding: ₦{new_outstanding:,.0f}.", "loan", loan_id)
    return {"ok": True, "status": new_status, "outstanding": new_outstanding}


# ---------------- Analytics ----------------
@api.get("/analytics/prices")
async def analytics_prices(user: dict = Depends(current_user)):
    pipeline = [
        {"$match": {"status": "active"}},
        {
            "$group": {
                "_id": "$crop",
                "avg_price": {"$avg": "$price_per_kg"},
                "min_price": {"$min": "$price_per_kg"},
                "max_price": {"$max": "$price_per_kg"},
                "total_qty": {"$sum": "$quantity_kg"},
                "listings": {"$sum": 1},
            }
        },
        {"$sort": {"avg_price": -1}},
    ]
    rows = await db.listings.aggregate(pipeline).to_list(50)
    return [
        {
            "crop": r["_id"],
            "avg_price": round(r["avg_price"], 2),
            "min_price": round(r["min_price"], 2),
            "max_price": round(r["max_price"], 2),
            "total_qty_kg": r["total_qty"],
            "listings": r["listings"],
        }
        for r in rows
    ]


@api.get("/analytics/demand")
async def analytics_demand(user: dict = Depends(current_user)):
    pipeline = [
        {"$group": {"_id": "$crop", "orders": {"$sum": 1}, "gmv": {"$sum": "$total"}}},
        {"$sort": {"gmv": -1}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(50)
    return [{"crop": r["_id"], "orders": r["orders"], "gmv": round(r["gmv"], 2)} for r in rows]


@api.get("/analytics/weather")
async def analytics_weather(user: dict = Depends(current_user)):
    """Live weather via Open-Meteo (free, no key). Falls back to mocked if API unreachable."""
    regions = [
        {"region": "Ogun", "lat": 7.16, "lon": 3.35},
        {"region": "Benue", "lat": 7.73, "lon": 8.52},
        {"region": "Oyo", "lat": 8.14, "lon": 3.75},
        {"region": "Kano", "lat": 12.00, "lon": 8.52},
        {"region": "Kaduna", "lat": 10.52, "lon": 7.44},
    ]
    # Cache for 30 minutes
    cached = await db.cache.find_one({"_id": "weather"}, {"_id": 0})
    if cached:
        try:
            aged_sec = (datetime.now(timezone.utc) - datetime.fromisoformat(cached["cached_at"])).total_seconds()
            if aged_sec < 1800:
                return cached["data"]
        except Exception:
            pass

    def fetch_one(r: dict) -> dict:
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast?latitude={r['lat']}&longitude={r['lon']}"
                f"&current=temperature_2m,precipitation,relative_humidity_2m"
                f"&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Africa%2FLagos"
            )
            resp = requests.get(url, timeout=6)
            resp.raise_for_status()
            d = resp.json()
            cur = d.get("current", {})
            daily = d.get("daily", {}).get("precipitation_sum", [])
            rain_7d = round(sum(x for x in daily[:7] if x is not None), 1)
            temp_c = round(cur.get("temperature_2m", 0), 1)
            humidity = cur.get("relative_humidity_2m")
            alert = None
            if rain_7d < 10:
                alert = "Low rainfall — consider irrigation"
            elif rain_7d > 120:
                alert = "Heavy rain — inspect drainage"
            if temp_c >= 34:
                alert = "Heat stress risk"
            return {
                "region": r["region"],
                "temp_c": temp_c,
                "rainfall_mm_7d": rain_7d,
                "humidity": humidity,
                "alert": alert,
            }
        except Exception:
            return {"region": r["region"], "temp_c": None, "rainfall_mm_7d": None, "humidity": None, "alert": "Data unavailable"}

    results = [fetch_one(r) for r in regions]
    # Note: requests is sync; list comp already runs sequentially but is fast with 6s timeouts.
    data = {"updated_at": utcnow(), "source": "open-meteo", "regions": results}
    await db.cache.update_one(
        {"_id": "weather"},
        {"$set": {"_id": "weather", "cached_at": utcnow(), "data": data}},
        upsert=True,
    )
    return data


# ---------------- Video script library ----------------
VIDEO_TEMPLATES = [
    {"id": "v01", "title": "Fresh Harvest — Tomato", "hook": "Still buying tomatoes at market price?", "beats": ["Farm-fresh visuals", "Grade A proof", "Price on screen", "CTA: DM to order"]},
    {"id": "v02", "title": "Bulk Stock Available", "hook": "500 bags. One farm. Ready to move.", "beats": ["Warehouse pan shot", "Quantity caption", "Location", "CTA: Escrow-protected"]},
    {"id": "v03", "title": "Export-grade Yam", "hook": "This yam is passport-ready.", "beats": ["Close-up of produce", "Export grade badge", "Origin story", "CTA"]},
    {"id": "v04", "title": "Farm-to-Market Story", "hook": "From my farm — to your warehouse in 24h.", "beats": ["Harvest", "Loading", "Transit", "Arrival"]},
    {"id": "v05", "title": "Day-in-the-life", "hook": "5am. The day starts now.", "beats": ["Sunrise", "Workers", "Produce sorting", "CTA"]},
    {"id": "v06", "title": "Trust & Verification", "hook": "Why 120 buyers trust us.", "beats": ["Verified badge", "Ratings", "Testimonial clip", "CTA"]},
    {"id": "v07", "title": "Price drop alert", "hook": "This week only: cassava at ₦350/kg.", "beats": ["Big price overlay", "Quantity", "Deadline", "CTA"]},
    {"id": "v08", "title": "New season crop", "hook": "First pepper harvest just landed.", "beats": ["Pepper close-up", "Fresh-picked caption", "Farm tour", "CTA"]},
    {"id": "v09", "title": "Behind the scenes", "hook": "How we hit Grade A every time.", "beats": ["Process", "Tools", "Team", "CTA"]},
    {"id": "v10", "title": "Customer unboxing", "hook": "Our buyer got their order. Watch.", "beats": ["Driver arrives", "Unboxing", "Smile", "CTA"]},
    {"id": "v11", "title": "Proof of quantity", "hook": "Weigh it yourself.", "beats": ["Scale shot", "Qty caption", "Buyer witness", "CTA"]},
    {"id": "v12", "title": "Logistics flex", "hook": "Abuja → Lagos in 14 hours.", "beats": ["Loading", "Driver", "GPS", "Delivered"]},
    {"id": "v13", "title": "Escrow explainer", "hook": "Safe money. Safe produce.", "beats": ["Buyer funds", "Escrow locked", "Delivered", "Released"]},
    {"id": "v14", "title": "Farmer testimonial", "hook": "AgriFlow paid me in 12 hours.", "beats": ["Farmer talking head", "Wallet shot", "Number", "CTA"]},
    {"id": "v15", "title": "Regional sourcing", "hook": "Looking for Ogun-grown tomato?", "beats": ["Map animation", "Farm location", "Offers", "CTA"]},
    {"id": "v16", "title": "Bulk deal of the week", "hook": "2,000kg. One price. One call.", "beats": ["Quantity", "Price", "Timer", "CTA"]},
    {"id": "v17", "title": "Sustainability story", "hook": "Grown with less water — more love.", "beats": ["Drip irrigation", "Practice", "Farmer quote", "CTA"]},
    {"id": "v18", "title": "Export announcement", "hook": "First container to Dubai. Let's go.", "beats": ["Container", "Paperwork", "Handshake", "CTA"]},
    {"id": "v19", "title": "Farm team", "hook": "Meet the people behind your produce.", "beats": ["Team shot", "Names", "Roles", "CTA"]},
    {"id": "v20", "title": "New buyer onboarding", "hook": "First order? Here's how it works.", "beats": ["Browse", "Offer", "Fund escrow", "Delivered"]},
]


@api.get("/video-templates")
async def video_templates(user: dict = Depends(current_user)):
    return VIDEO_TEMPLATES


# ---------------- Hook: referral bonus on first completed order (amend confirm below is injected elsewhere) ----------------


# ---------------- Subscriptions ----------------
SUBSCRIPTION_PLANS = [
    {
        "tier": "basic",
        "name": "Basic",
        "price_ngn": 0,
        "tagline": "Start sourcing on AgriFlow",
        "features": [
            "Browse full marketplace",
            "Escrow-protected orders",
            "Basic analytics",
            "Standard support",
        ],
    },
    {
        "tier": "professional",
        "name": "Professional",
        "price_ngn": 25000,
        "tagline": "For serious buyers moving real volume",
        "features": [
            "Priority sourcing (2h head-start on new listings)",
            "Advanced analytics — trend lines, demand signals",
            "Saved supplier shortlists",
            "Priority support",
            "Export & reorder shortcuts",
        ],
        "popular": True,
    },
    {
        "tier": "enterprise",
        "name": "Enterprise",
        "price_ngn": 100000,
        "tagline": "Scale sourcing across teams and countries",
        "features": [
            "Everything in Professional",
            "Dedicated account manager",
            "Multi-user team seats",
            "API access + bulk CSV tools",
            "Custom SLAs + quarterly reviews",
        ],
    },
]


class SubscribeIn(BaseModel):
    tier: Literal["basic", "professional", "enterprise"]


def _tier_price(tier: str) -> float:
    for p in SUBSCRIPTION_PLANS:
        if p["tier"] == tier:
            return float(p["price_ngn"])
    raise HTTPException(400, "Unknown tier")


@api.get("/subscriptions/plans")
async def list_plans():
    return SUBSCRIPTION_PLANS


@api.get("/subscriptions/me")
async def my_subscription(user: dict = Depends(current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    tier = u.get("subscription_tier", "basic") if u else "basic"
    expires = u.get("subscription_expires_at") if u else None
    return {"tier": tier, "expires_at": expires, "plans": SUBSCRIPTION_PLANS}


@api.post("/subscriptions/subscribe")
async def subscribe(body: SubscribeIn, user: dict = Depends(require_roles("buyer"))):
    price = _tier_price(body.tier)
    if body.tier == "basic":
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"subscription_tier": "basic", "subscription_expires_at": None}},
        )
        return {"ok": True, "tier": "basic", "expires_at": None}
    wallet = await ensure_wallet(user["id"])
    if wallet["available"] < price:
        raise HTTPException(400, f"Insufficient wallet balance. Need ₦{price:,.0f}")
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"available": -price}})
    await ledger(
        user["id"],
        "subscription_fee",
        price,
        "debit",
        body.tier,
        f"Subscription: {body.tier.title()} (30 days)",
    )
    await ledger("platform", "subscription_revenue", price, "credit", body.tier, f"Subscription revenue: {user['email']}")
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"subscription_tier": body.tier, "subscription_expires_at": expires}},
    )
    await notify(
        user["id"],
        f"{body.tier.title()} plan activated 🎉",
        f"Your plan is live for 30 days. ₦{price:,.0f} was charged from your wallet.",
        "subscription",
        body.tier,
    )
    return {"ok": True, "tier": body.tier, "expires_at": expires}


@api.post("/subscriptions/cancel")
async def cancel_sub(user: dict = Depends(require_roles("buyer"))):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"subscription_tier": "basic", "subscription_expires_at": None}},
    )
    return {"ok": True, "tier": "basic"}


# ---------------- Country / currency ----------------
COUNTRIES = [
    {"code": "NG", "name": "Nigeria", "currency": "NGN", "symbol": "₦", "phone_prefix": "+234", "timezone": "Africa/Lagos", "languages": ["English", "Yoruba", "Hausa", "Igbo"], "flag": "🇳🇬", "active": True, "signup_bonus": 5000},
    {"code": "GH", "name": "Ghana", "currency": "GHS", "symbol": "₵", "phone_prefix": "+233", "timezone": "Africa/Accra", "languages": ["English", "Twi"], "flag": "🇬🇭", "active": True, "signup_bonus": 50},
    {"code": "KE", "name": "Kenya", "currency": "KES", "symbol": "KSh", "phone_prefix": "+254", "timezone": "Africa/Nairobi", "languages": ["English", "Swahili"], "flag": "🇰🇪", "active": True, "signup_bonus": 500},
    {"code": "CI", "name": "Côte d'Ivoire", "currency": "XOF", "symbol": "CFA", "phone_prefix": "+225", "timezone": "Africa/Abidjan", "languages": ["French"], "flag": "🇨🇮", "active": True, "signup_bonus": 3000},
]
COUNTRY_BY_CODE = {c["code"]: c for c in COUNTRIES}


def country_info(code: Optional[str]) -> dict:
    return COUNTRY_BY_CODE.get((code or "NG").upper(), COUNTRY_BY_CODE["NG"])


@api.get("/countries")
async def list_countries():
    return COUNTRIES


# ---------------- Public stats (social proof) ----------------
@api.get("/stats/public")
async def public_stats():
    since_iso = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since_iso}, "status": {"$in": ["escrow_funded", "in_logistics", "in_transit", "delivered", "completed"]}}},
        {"$group": {"_id": None, "gmv": {"$sum": "$total"}, "orders": {"$sum": 1}}},
    ]
    agg = await db.orders.aggregate(pipeline).to_list(1)
    gmv_week = agg[0]["gmv"] if agg else 0
    orders_week = agg[0]["orders"] if agg else 0
    active_farmers = await db.users.count_documents({"role": "farmer"})
    active_buyers = await db.users.count_documents({"role": "buyer"})
    active_listings = await db.listings.count_documents({"status": "active"})
    countries_live = len([c for c in COUNTRIES if c["active"]])
    # Escrow currently locked
    escrow_agg = await db.wallets.aggregate(
        [{"$group": {"_id": None, "locked": {"$sum": "$escrow_held"}}}]
    ).to_list(1)
    escrow_locked_amount = escrow_agg[0]["locked"] if escrow_agg else 0
    escrow_locked_count = await db.orders.count_documents({"escrow_status": "funded"})
    return {
        "gmv_week_ngn": round(gmv_week, 2),
        "orders_week": orders_week,
        "active_farmers": active_farmers,
        "active_buyers": active_buyers,
        "active_listings": active_listings,
        "countries_live": countries_live,
        "escrow_locked_amount": round(escrow_locked_amount, 2),
        "escrow_locked_count": escrow_locked_count,
        "updated_at": utcnow(),
    }


@api.get("/stats/recent-deals")
async def recent_deals():
    """Anonymised living feed of recent on-platform orders for landing social proof."""
    since_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    items = (
        await db.orders.find(
            {
                "created_at": {"$gte": since_iso},
                "status": {"$in": ["escrow_funded", "in_logistics", "in_transit", "delivered", "completed"]},
                "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
            },
            {"_id": 0},
        )
        .sort("created_at", -1)
        .limit(20)
        .to_list(20)
    )
    now = datetime.now(timezone.utc)
    out = []
    for o in items:
        try:
            created = datetime.fromisoformat(o["created_at"])
            seconds_ago = int((now - created).total_seconds())
        except Exception:
            seconds_ago = 0
        # Anonymise: first name initial + first letter of last
        fn = (o.get("farmer_name") or "A").split()
        farmer_alias = f"{fn[0][0].upper()}.{fn[-1][0].upper()}." if len(fn) > 1 else fn[0]
        dest = (o.get("delivery_address") or "").split(",")[0].strip() or "—"
        # Pull origin from listing
        listing = await db.listings.find_one({"id": o["listing_id"]}, {"_id": 0})
        origin = (listing or {}).get("location", "—")
        out.append(
            {
                "id": o["id"][:8],
                "crop": o["crop"],
                "quantity_kg": o["quantity_kg"],
                "total": o["total"],
                "currency": o.get("currency", "NGN"),
                "country": o.get("country", "NG"),
                "farmer_alias": farmer_alias,
                "origin": origin,
                "destination": dest,
                "status": o["status"],
                "seconds_ago": seconds_ago,
            }
        )
    return out


# ---------------- Social share (per-listing OG cards) ----------------
_CURRENCY_SYMBOL = {"NGN": "₦", "GHS": "₵", "KES": "KSh ", "XOF": "CFA "}
_COUNTRY_NAME = {"NG": "Nigeria", "GH": "Ghana", "KE": "Kenya", "CI": "Côte d'Ivoire"}
_PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")


def _html_escape(s: str) -> str:
    return (
        str(s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _public_site_url(request_host: str) -> str:
    # Prefer env override (public domain); fall back to incoming Host header.
    if _PUBLIC_SITE_URL:
        return _PUBLIC_SITE_URL
    return f"https://{request_host}" if request_host else ""


@api.get("/p/{listing_id}")
async def share_listing(listing_id: str, host: Optional[str] = Header(None)):
    """Serves OG-tagged HTML for a listing — scraped by WhatsApp/Twitter/Facebook/Slack.
    Humans get JS-redirected to the frontend SPA listing page.
    """
    from fastapi.responses import HTMLResponse

    l = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not l or l.get("status") != "active":
        return HTMLResponse(
            status_code=404,
            content="<!doctype html><title>Listing unavailable</title><h1>Listing unavailable</h1>",
        )

    site = _public_site_url(host or "")
    target_url = f"{site}/listing/{listing_id}"
    currency = l.get("currency") or "NGN"
    symbol = _CURRENCY_SYMBOL.get(currency, f"{currency} ")
    price = f"{symbol}{int(l.get('price_per_kg') or 0):,}/kg"
    qty = f"{int(l.get('quantity_kg') or 0):,}kg available"
    country = _COUNTRY_NAME.get(l.get("country_code") or "NG", "Nigeria")
    farmer = l.get("farmer_name") or "Verified farmer"
    title = f"{l['crop']} · Grade {l.get('grade', 'A')} · {price} — AGRIOS"
    description = (
        f"{qty} from {farmer} in {l.get('location', country)}, {country}. "
        f"Escrow-protected orders. Pay only when produce arrives. Order on AGRIOS."
    )
    image = l.get("image_url") or "https://images.unsplash.com/photo-1596788068873-9ffd5cacd4c4?auto=format&fit=crop&w=1200&h=630&q=85"
    # Ensure image is absolute
    if image and image.startswith("/"):
        image = f"{site}{image}"

    canonical = f"{site}/listing/{listing_id}"

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{_html_escape(title)}</title>
<meta name="description" content="{_html_escape(description)}" />
<link rel="canonical" href="{_html_escape(canonical)}" />

<!-- Open Graph -->
<meta property="og:type" content="product" />
<meta property="og:site_name" content="AGRIOS" />
<meta property="og:title" content="{_html_escape(title)}" />
<meta property="og:description" content="{_html_escape(description)}" />
<meta property="og:url" content="{_html_escape(canonical)}" />
<meta property="og:image" content="{_html_escape(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="{_html_escape(l['crop'])} on AGRIOS" />
<meta property="product:price:amount" content="{int(l.get('price_per_kg') or 0)}" />
<meta property="product:price:currency" content="{currency}" />
<meta property="product:availability" content="in stock" />
<meta property="og:locale" content="en_NG" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{_html_escape(title)}" />
<meta name="twitter:description" content="{_html_escape(description)}" />
<meta name="twitter:image" content="{_html_escape(image)}" />
<meta name="twitter:image:alt" content="{_html_escape(l['crop'])} on AGRIOS" />

<!-- Structured data: Product -->
<script type="application/ld+json">
{json.dumps({
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": l["crop"],
    "description": description,
    "image": image,
    "brand": {"@type": "Brand", "name": "AGRIOS"},
    "offers": {
        "@type": "Offer",
        "priceCurrency": currency,
        "price": int(l.get("price_per_kg") or 0),
        "availability": "https://schema.org/InStock",
        "url": canonical,
    },
}, ensure_ascii=False)}
</script>

<meta http-equiv="refresh" content="0; url={_html_escape(target_url)}" />
<script>window.location.replace({json.dumps(target_url)});</script>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 40px; text-align: center; background: #FAFAFA; color: #18181B; }}
  img {{ max-width: 360px; border-radius: 16px; margin: 20px 0; }}
  a.btn {{ display: inline-block; background: #0F5132; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; }}
</style>
</head>
<body>
  <h1 style="margin:0 0 8px;font-family:system-ui;font-weight:800;">{_html_escape(l["crop"])}</h1>
  <div style="color:#52525b;">{_html_escape(price)} · {_html_escape(qty)}</div>
  {f'<img src="{_html_escape(image)}" alt="{_html_escape(l["crop"])}" />' if image else ""}
  <p style="color:#52525b;max-width:440px;margin:0 auto 24px;">{_html_escape(description)}</p>
  <a class="btn" href="{_html_escape(target_url)}">View on AGRIOS →</a>
</body>
</html>"""
    return HTMLResponse(content=html, headers={"Cache-Control": "public, max-age=300"})


@api.get("/sitemap-listings.xml")
async def sitemap_listings(host: Optional[str] = Header(None)):
    """Dynamic sitemap of active listings for search engines."""
    from fastapi.responses import Response as FastResponse

    site = _public_site_url(host or "")
    items = await db.listings.find({"status": "active"}, {"_id": 0, "id": 1, "updated_at": 1, "created_at": 1}).to_list(5000)
    urls = []
    for it in items:
        lastmod = it.get("updated_at") or it.get("created_at") or ""
        # Trim to date
        lastmod_date = (lastmod or "")[:10]
        urls.append(
            f"  <url><loc>{site}/listing/{it['id']}</loc>"
            f"{f'<lastmod>{lastmod_date}</lastmod>' if lastmod_date else ''}"
            f"<changefreq>daily</changefreq><priority>0.7</priority></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>"
    )
    return FastResponse(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=900"})


# ---------------- Phase B: Insights & Recommendations ----------------
@api.get("/insights/hot-demand")
async def hot_demand():
    """Top crops by order velocity over last 30 days. Lightweight aggregate:
    order count + GMV + week-over-week % change (vs prior 30d window).
    """
    now = datetime.now(timezone.utc)
    win_30d = (now - timedelta(days=30)).isoformat()
    win_60d = (now - timedelta(days=60)).isoformat()
    prior_cutoff = (now - timedelta(days=30)).isoformat()

    active_statuses = ["escrow_funded", "in_logistics", "in_transit", "delivered", "completed"]

    # Current 30-day window — exclude TEST_ crops from the public feed
    pipeline_curr = [
        {"$match": {
            "created_at": {"$gte": win_30d},
            "status": {"$in": active_statuses},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {
            "_id": {"$toLower": "$crop"},
            "crop": {"$first": "$crop"},
            "orders": {"$sum": 1},
            "gmv": {"$sum": "$total"},
            "qty_kg": {"$sum": "$quantity_kg"},
            "currency": {"$first": "$currency"},
        }},
        {"$sort": {"orders": -1}},
        {"$limit": 10},
    ]
    curr = await db.orders.aggregate(pipeline_curr).to_list(10)

    # Prior 30-day window for % change
    pipeline_prev = [
        {"$match": {
            "created_at": {"$gte": win_60d, "$lt": prior_cutoff},
            "status": {"$in": active_statuses},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        }},
        {"$group": {"_id": {"$toLower": "$crop"}, "orders": {"$sum": 1}, "gmv": {"$sum": "$total"}}},
    ]
    prev = {r["_id"]: r for r in await db.orders.aggregate(pipeline_prev).to_list(100)}

    # Enrich with price range from current active listings
    out = []
    for c in curr:
        key = c["_id"]
        prev_orders = (prev.get(key) or {}).get("orders", 0)
        pct_change = None
        if prev_orders > 0:
            pct_change = int(round(((c["orders"] - prev_orders) / prev_orders) * 100))
        elif c["orders"] > 0:
            pct_change = 100  # new entry
        # Price range from active listings for this crop
        listings_for_crop = await db.listings.find(
            {"status": "active", "crop": {"$regex": f"^{c['crop']}$", "$options": "i"}},
            {"_id": 0, "price_per_kg": 1},
        ).to_list(100)
        prices = [l["price_per_kg"] for l in listings_for_crop if l.get("price_per_kg")]
        price_min = int(min(prices)) if prices else None
        price_max = int(max(prices)) if prices else None

        out.append({
            "crop": c["crop"],
            "orders": c["orders"],
            "gmv": c.get("gmv", 0),
            "qty_kg": c.get("qty_kg", 0),
            "currency": c.get("currency", "NGN"),
            "pct_change": pct_change,
            "price_min": price_min,
            "price_max": price_max,
            "signal": "high" if c["orders"] >= 3 else "moderate",
        })

    # Fallback: if no real orders yet, surface top listings by views so UI never looks empty
    if not out:
        fallback = await db.listings.find(
            {"status": "active", "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}}},
            {"_id": 0},
        ).sort("views", -1).limit(6).to_list(6)
        out = [
            {
                "crop": l["crop"],
                "orders": 0,
                "gmv": 0,
                "qty_kg": l.get("quantity_kg", 0),
                "currency": l.get("currency", "NGN"),
                "pct_change": None,
                "price_min": int(l.get("price_per_kg") or 0),
                "price_max": int(l.get("price_per_kg") or 0),
                "signal": "moderate",
            }
            for l in fallback
        ]
    return out


@api.get("/insights/featured-suppliers")
async def featured_suppliers():
    """Verified farmers ranked by completed orders + rating. Returns up to 8."""
    active_statuses = ["delivered", "completed"]
    # Aggregate completed order count per farmer
    pipeline = [
        {"$match": {"status": {"$in": active_statuses}}},
        {"$group": {
            "_id": "$farmer_id",
            "completed": {"$sum": 1},
            "gmv": {"$sum": "$farmer_amount"},
        }},
    ]
    order_stats = {r["_id"]: r for r in await db.orders.aggregate(pipeline).to_list(200) if r.get("_id")}

    # Pull verified farmers
    farmers = await db.users.find(
        {"role": "farmer", "verified": True},
        {"_id": 0, "id": 1, "full_name": 1, "location": 1, "country": 1, "business_name": 1},
    ).to_list(200)

    # Compute ratings from reviews (if any)
    enriched = []
    for f in farmers:
        stats = order_stats.get(f["id"]) or {"completed": 0, "gmv": 0}
        reviews = await db.reviews.find({"reviewee_id": f["id"]}, {"_id": 0, "rating": 1}).to_list(200)
        if reviews:
            avg = sum(r["rating"] for r in reviews) / len(reviews)
            count = len(reviews)
        else:
            # Deterministic placeholder rating from farmer id, anchored high for verified
            h = int(hashlib.md5(f["id"].encode()).hexdigest(), 16) % 60
            avg = round(4.4 + h / 100, 1)
            count = max(8, stats["completed"] * 3 + (h % 20))

        # Featured crop = most recent active listing (excluding TEST_ crops)
        last = await db.listings.find_one(
            {
                "farmer_id": f["id"],
                "status": "active",
                "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
            },
            {"_id": 0, "crop": 1, "image_url": 1, "location": 1},
            sort=[("created_at", -1)],
        )
        enriched.append({
            "id": f["id"],
            "name": f.get("full_name") or f.get("business_name") or "Verified Farmer",
            "location": f.get("location") or (last or {}).get("location") or "",
            "country": f.get("country") or "NG",
            "verified": True,
            "completed_orders": stats["completed"],
            "rating": round(avg, 1),
            "rating_count": count,
            "featured_crop": (last or {}).get("crop"),
            "image": (last or {}).get("image_url"),
        })

    enriched.sort(key=lambda x: (x["completed_orders"], x["rating"]), reverse=True)
    return enriched[:8]


@api.get("/recommendations/for-buyer")
async def recommend_for_buyer(user: dict = Depends(require_roles("buyer"))):
    """Simple rule-based recs: 'buyers like you also purchased' + 'popular in your region'."""
    # My past ordered crops
    my_orders = await db.orders.find(
        {"buyer_id": user["id"]},
        {"_id": 0, "crop": 1, "listing_id": 1},
    ).to_list(200)
    my_crops = {o["crop"].lower() for o in my_orders}
    my_listing_ids = {o["listing_id"] for o in my_orders}

    my_country = user.get("country") or "NG"

    # "Popular in your region" — active listings from same country sorted by views, excluding what user already bought
    region_listings = await db.listings.find(
        {
            "status": "active",
            "country_code": my_country,
            "id": {"$nin": list(my_listing_ids)},
            "crop": {"$not": {"$regex": "^TEST_", "$options": "i"}},
        },
        {"_id": 0},
    ).sort("views", -1).limit(6).to_list(6)

    # "Buyers like you also purchased" — find other buyers who bought the same crops, surface their other orders
    similar_crops = set()
    if my_crops:
        other_orders = await db.orders.find(
            {"crop": {"$in": [c for c in my_crops]}, "buyer_id": {"$ne": user["id"]}},
            {"_id": 0, "buyer_id": 1},
        ).limit(50).to_list(50)
        similar_buyers = {o["buyer_id"] for o in other_orders}
        if similar_buyers:
            sim_orders = await db.orders.find(
                {"buyer_id": {"$in": list(similar_buyers)}, "crop": {"$nin": list(my_crops)}},
                {"_id": 0, "crop": 1},
            ).limit(100).to_list(100)
            for o in sim_orders:
                similar_crops.add(o["crop"])

    similar_listings = []
    if similar_crops:
        similar_listings = await db.listings.find(
            {
                "status": "active",
                "crop": {"$in": list(similar_crops)},
                "id": {"$nin": list(my_listing_ids)},
            },
            {"_id": 0},
        ).limit(6).to_list(6)

    return {
        "region": region_listings,
        "similar_buyers": similar_listings,
    }


@api.get("/recommendations/product/{listing_id}")
async def recommend_related(listing_id: str):
    """Related listings: same crop (other farmers) + same-region alternatives."""
    l = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Listing not found")

    same_crop = await db.listings.find(
        {
            "status": "active",
            "id": {"$ne": listing_id},
            "crop": {"$regex": f"^{l['crop']}$", "$options": "i"},
        },
        {"_id": 0},
    ).sort("views", -1).limit(4).to_list(4)

    same_region = await db.listings.find(
        {
            "status": "active",
            "id": {"$ne": listing_id},
            "country_code": l.get("country_code", "NG"),
            "crop": {"$not": {"$regex": f"^{l['crop']}$", "$options": "i"}},
        },
        {"_id": 0},
    ).sort("views", -1).limit(4).to_list(4)

    return {"same_crop": same_crop, "same_region": same_region}


@api.get("/recommendations/for-farmer")
async def recommend_for_farmer(user: dict = Depends(require_roles("farmer"))):
    """Farmer guidance: best-price crops + high-demand crops to consider planting/listing."""
    # What's hot right now?
    hot = await hot_demand()
    # Farmer's own crops
    mine = await db.listings.find({"farmer_id": user["id"]}, {"_id": 0, "crop": 1, "price_per_kg": 1}).to_list(100)
    my_crops = {m["crop"].lower() for m in mine}

    # Hot crops the farmer is NOT yet listing
    suggest = [h for h in hot if h["crop"].lower() not in my_crops][:4]

    # Best-price guidance for what the farmer HAS listed — show the 75th-percentile price across active listings
    guidance = []
    for m in mine[:5]:
        listings_for_crop = await db.listings.find(
            {"status": "active", "crop": {"$regex": f"^{m['crop']}$", "$options": "i"}},
            {"_id": 0, "price_per_kg": 1},
        ).to_list(200)
        prices = sorted([x["price_per_kg"] for x in listings_for_crop if x.get("price_per_kg")])
        if not prices:
            continue
        p75 = prices[int(len(prices) * 0.75)] if len(prices) > 1 else prices[0]
        median = prices[len(prices) // 2]
        guidance.append({
            "crop": m["crop"],
            "your_price": m["price_per_kg"],
            "market_median": int(median),
            "market_p75": int(p75),
            "suggestion": (
                "lower" if m["price_per_kg"] > p75 * 1.1
                else "raise" if m["price_per_kg"] < median * 0.9
                else "fair"
            ),
        })

    return {"suggest_crops": suggest, "price_guidance": guidance}


# ---------------- Phase C: Market Pulse (weekly digest) ----------------
from services.digest import build_digest as _build_digest, send_email as _send_email, wa_share_url as _wa_share_url
from services import config as _cfg


@api.get("/config")
async def app_config():
    """Public config + feature flags consumed by the React frontend."""
    return _cfg.public_config()


@api.get("/digest/preview")
async def digest_preview(user: dict = Depends(current_user)):
    """Preview the digest this user would receive today."""
    payload = await _build_digest(db, user)
    return payload


@api.get("/digest/prefs")
async def digest_prefs(user: dict = Depends(current_user)):
    prefs = user.get("digest_prefs") or {"email": True, "frequency": "weekly"}
    return prefs


@api.put("/digest/prefs")
async def update_digest_prefs(body: dict, user: dict = Depends(current_user)):
    prefs = {
        "email": bool(body.get("email", True)),
        "frequency": body.get("frequency") or "weekly",
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"digest_prefs": prefs}})
    return prefs


@api.post("/digest/send-me-now")
async def send_me_now(user: dict = Depends(current_user)):
    """Manually trigger the user's own digest (for testing + 'send preview' UX)."""
    payload = await _build_digest(db, user)
    result = await _send_email(
        db,
        to=user["email"],
        subject=payload.get("subject") or f"AGRIOS Market Pulse — {payload['period']['label']}",
        html=payload["html"],
        text=payload.get("text"),
        meta={"user_id": user["id"], "kind": "self-test", "role": user.get("role")},
    )
    return {
        "dispatch": result,
        "whatsapp_text": payload["whatsapp_text"],
        "whatsapp_url": _wa_share_url(payload["whatsapp_text"]),
    }


@api.post("/digest/trigger")
async def trigger_blast(user: dict = Depends(require_roles("admin"))):
    """Admin-only: blast the digest to every opted-in user right now."""
    return await _run_digest_blast(reason="admin-trigger", actor=user["id"])


@api.get("/digest/log")
async def digest_log(limit: int = 50, user: dict = Depends(require_roles("admin"))):
    rows = (
        await db.digest_log.find({}, {"_id": 0, "html_bytes": 1, "text_bytes": 1, "to": 1, "subject": 1, "sent_at": 1, "provider": 1, "status": 1, "error": 1, "meta": 1})
        .sort("sent_at", -1)
        .limit(max(1, min(200, limit)))
        .to_list(200)
    )
    return rows


async def _run_digest_blast(*, reason: str = "scheduled", actor: str | None = None) -> dict:
    """Compose + send the digest for every opted-in user. Idempotent per 7 days."""
    now = datetime.now(timezone.utc)
    cursor = db.users.find(
        {
            "role": {"$in": ["buyer", "farmer"]},
            "$or": [
                {"digest_prefs.email": {"$ne": False}},
                {"digest_prefs": {"$exists": False}},
            ],
        },
        {"_id": 0, "password_hash": 0},
    )
    sent = 0
    failed = 0
    users = await cursor.to_list(10_000)
    for u in users:
        try:
            payload = await _build_digest(db, u)
            result = await _send_email(
                db,
                to=u["email"],
                subject=payload.get("subject") or f"AGRIOS Market Pulse — {payload['period']['label']}",
                html=payload["html"],
                text=payload.get("text"),
                meta={"user_id": u["id"], "kind": "blast", "reason": reason, "role": u.get("role")},
            )
            if result.get("status") == "failed":
                failed += 1
            else:
                sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("digest blast failed for %s: %s", u.get("email"), exc)
            failed += 1

    await db.system.update_one(
        {"key": "digest_last_run"},
        {"$set": {"key": "digest_last_run", "at": now.isoformat(), "sent": sent, "failed": failed, "reason": reason, "actor": actor}},
        upsert=True,
    )
    return {"sent": sent, "failed": failed, "total_users": len(users), "reason": reason, "ran_at": now.isoformat()}


async def _digest_scheduler_loop():
    """Wake hourly, fire a blast once per Monday at MARKET_PULSE_CRON_HOUR_UTC."""
    import asyncio

    target_hour = _cfg.MARKET_PULSE_CRON_HOUR_UTC
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            if now_utc.weekday() == 0 and now_utc.hour == target_hour:
                last = await db.system.find_one({"key": "digest_last_run"}, {"_id": 0, "at": 1})
                last_at = None
                if last and last.get("at"):
                    try:
                        last_at = datetime.fromisoformat(last["at"])
                    except Exception:
                        last_at = None
                if not last_at or (now_utc - last_at) > timedelta(hours=24):
                    logger.info("Market Pulse: scheduled Monday blast starting")
                    result = await _run_digest_blast(reason="scheduled-monday")
                    logger.info("Market Pulse: blast complete %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("digest scheduler tick failed: %s", exc)
        await asyncio.sleep(60 * 60)


@app.on_event("startup")
async def start_digest_scheduler() -> None:
    import asyncio
    if not _cfg.ENABLE_CRON or not _cfg.FLAGS.get("market_pulse"):
        logger.info("Market Pulse scheduler disabled (ENABLE_CRON or FEATURE_MARKET_PULSE off)")
        return
    asyncio.create_task(_digest_scheduler_loop())


# ---------------- Phase C: Payments + Webhooks + Admin audit ----------------
from services import payments as _pay

from fastapi import Request
from fastapi.responses import JSONResponse


async def _admin_audit(*, admin_id: str, action: str, resource_type: str, resource_id: str | None = None, reason: str | None = None, before: dict | None = None, after: dict | None = None) -> None:
    """Append-only admin action trail. Every financial admin action MUST call this."""
    await db.admin_audit.insert_one({
        "admin_id": admin_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "reason": reason,
        "before": before,
        "after": after,
        "at": datetime.now(timezone.utc).isoformat(),
    })


# ---- Health / readiness ----
@app.get("/api/health")
async def health():
    return {"ok": True, "service": "agrios-api", "ts": datetime.now(timezone.utc).isoformat()}


@app.get("/api/ready")
async def ready():
    status: dict = {"ok": True, "checks": {}}
    try:
        await db.command("ping")
        status["checks"]["mongo"] = "ok"
    except Exception as e:
        status["ok"] = False
        status["checks"]["mongo"] = f"fail: {str(e)[:120]}"
    status["checks"]["email_provider"] = _cfg.public_config()["providers"]["email"]["effective"]
    status["checks"]["payment_provider"] = _cfg.public_config()["providers"]["payment"]["effective"]
    return status if status["ok"] else JSONResponse(status_code=503, content=status)


# ---- Payment initialization ----
@api.post("/payments/initialize")
async def initialize_payment(body: dict, user: dict = Depends(current_user)):
    """Initialize a wallet-funding payment. Returns authorization_url for hosted checkout."""
    amount = float(body.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    purpose = body.get("purpose") or "wallet_funding"  # wallet_funding | order_escrow
    order_id = body.get("order_id")

    reference = f"AGR-{uuid.uuid4().hex[:18].upper()}"
    currency = user.get("currency") or _cfg.PAYMENT_CURRENCY_DEFAULT
    provider = _pay.get_provider()

    # Persist intent BEFORE calling the provider so we can reconcile orphans
    await db.payments.insert_one({
        "id": reference,
        "reference": reference,
        "user_id": user["id"],
        "provider": provider.name,
        "amount": amount,
        "currency": currency,
        "status": "pending",
        "purpose": purpose,
        "order_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    try:
        init = await provider.initialize(
            amount=amount, currency=currency, email=user["email"], reference=reference,
            metadata={"user_id": user["id"], "purpose": purpose, "order_id": order_id},
            callback_url=f"{_cfg.PUBLIC_SITE_URL}/app/wallet?ref={reference}",
        )
    except Exception as exc:  # noqa: BLE001
        await db.payments.update_one({"id": reference}, {"$set": {"status": "initialize_failed", "error": str(exc)[:500]}})
        raise HTTPException(502, f"Provider error: {exc}")

    return {**init, "amount": amount, "currency": currency}


@api.get("/payments/verify/{reference}")
async def verify_payment(reference: str, user: dict = Depends(current_user)):
    """Verify a payment status by reference. Idempotent — multiple calls safe."""
    rec = await db.payments.find_one({"id": reference}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Payment reference not found")
    if rec["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")

    if rec["status"] == "success":
        return rec  # already reconciled

    provider = _pay.provider_by_name(rec["provider"])
    try:
        v = await provider.verify(reference)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Provider verify error: {exc}")

    if v.get("status") == "success":
        await _apply_payment_success(rec, v.get("amount") or rec["amount"])
    else:
        await db.payments.update_one({"id": reference}, {"$set": {"status": "failed", "verified_at": datetime.now(timezone.utc).isoformat()}})
    updated = await db.payments.find_one({"id": reference}, {"_id": 0})
    return updated


async def _apply_payment_success(payment: dict, amount: float) -> None:
    """Idempotent payment-success handler — credits wallet + locks escrow as needed."""
    if payment["status"] == "success":
        return
    user_id = payment["user_id"]
    currency = payment["currency"]
    now = datetime.now(timezone.utc).isoformat()

    await db.payments.update_one(
        {"id": payment["id"]},
        {"$set": {"status": "success", "verified_at": now, "verified_amount": amount}},
    )

    if payment["purpose"] == "wallet_funding":
        # Credit wallet — ledger entry is immutable
        await db.ledger.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "kind": "wallet_funding",
            "direction": "credit",
            "amount": amount,
            "currency": currency,
            "note": f"Wallet funded via {payment['provider']} · {payment['id']}",
            "payment_ref": payment["id"],
            "created_at": now,
        })
        await db.wallets.update_one(
            {"user_id": user_id},
            {"$inc": {"available": amount}, "$set": {"currency": currency}},
            upsert=True,
        )
    elif payment["purpose"] == "order_escrow" and payment.get("order_id"):
        # Fund escrow on order
        order = await db.orders.find_one({"id": payment["order_id"]}, {"_id": 0})
        if order and order.get("escrow_status") != "funded":
            await db.orders.update_one(
                {"id": payment["order_id"]},
                {"$set": {"escrow_status": "funded", "escrow_funded_at": now, "status": "escrow_funded"}},
            )
            await db.ledger.insert_one({
                "id": new_id(),
                "user_id": user_id,
                "kind": "escrow_lock",
                "direction": "debit",
                "amount": amount,
                "currency": currency,
                "note": f"Escrow funded for order {payment['order_id']}",
                "order_id": payment["order_id"],
                "payment_ref": payment["id"],
                "created_at": now,
            })


# ---- Webhooks (idempotent, signature-verified) ----
@app.post("/api/payments/{provider_name}/webhook")
async def payment_webhook(provider_name: str, request: Request):
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    prov = _pay.provider_by_name(provider_name)

    if prov.name != "mock" and not prov.verify_webhook_signature(raw, headers):
        await db.webhook_events.insert_one({
            "id": new_id(), "provider": provider_name, "received_at": datetime.now(timezone.utc).isoformat(),
            "status": "signature_rejected", "raw_bytes": len(raw),
        })
        raise HTTPException(401, "Invalid signature")

    try:
        parsed = prov.parse_webhook(raw)
    except Exception as exc:
        raise HTTPException(400, f"Malformed payload: {exc}")

    event_id = parsed.get("event_id") or f"{provider_name}-{datetime.now(timezone.utc).isoformat()}"
    # Idempotency guard — unique index would be ideal; upsert works too
    existing = await db.webhook_events.find_one({"provider": provider_name, "event_id": event_id}, {"_id": 0})
    if existing and existing.get("status") == "processed":
        return {"ok": True, "duplicate": True, "event_id": event_id}

    # Record the event (raw + parsed) BEFORE touching balances
    await db.webhook_events.insert_one({
        "id": new_id(),
        "provider": provider_name,
        "event_id": event_id,
        "reference": parsed.get("reference"),
        "event_type": parsed.get("event_type"),
        "status": "received",
        "parsed": {k: v for k, v in parsed.items() if k != "raw"},
        "raw": parsed.get("raw"),
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    # Apply the side effect if payment succeeded
    if parsed["status"] == "success" and parsed.get("reference"):
        rec = await db.payments.find_one({"id": parsed["reference"]}, {"_id": 0})
        if rec and rec["status"] != "success":
            await _apply_payment_success(rec, parsed.get("amount") or rec["amount"])

    await db.webhook_events.update_one(
        {"provider": provider_name, "event_id": event_id},
        {"$set": {"status": "processed", "processed_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "event_id": event_id}


# ---- Admin: reconciliation + audit ----
_VALID_ESCROW_TRANSITIONS = {
    "pending": {"funded", "cancelled"},
    "funded": {"held", "released", "refunded", "disputed"},
    "held": {"partially_released", "released", "refunded", "disputed"},
    "partially_released": {"released", "refunded", "disputed"},
    "released": set(),  # terminal
    "refunded": set(),  # terminal
    "disputed": {"released", "refunded"},
    "cancelled": set(),
}


@api.post("/admin/escrow/{order_id}/transition")
async def admin_escrow_transition(order_id: str, body: dict, user: dict = Depends(require_roles("admin"))):
    target = body.get("to")
    reason = body.get("reason") or ""
    if not target:
        raise HTTPException(400, "Missing target state")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    current = order.get("escrow_status") or "pending"
    if target not in _VALID_ESCROW_TRANSITIONS.get(current, set()):
        raise HTTPException(400, f"Invalid transition {current} → {target}")

    before = {"escrow_status": current}
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"escrow_status": target, f"escrow_{target}_at": datetime.now(timezone.utc).isoformat()}},
    )
    await _admin_audit(
        admin_id=user["id"], action=f"escrow.transition.{target}",
        resource_type="order", resource_id=order_id, reason=reason,
        before=before, after={"escrow_status": target},
    )
    return {"ok": True, "from": current, "to": target}


@api.get("/admin/reconcile")
async def admin_reconcile(user: dict = Depends(require_roles("admin"))):
    """Four reconciliation buckets for Nigeria launch:
    1. Pending payments older than 30min (should auto-verify or hit webhook by now)
    2. Orders with escrow_status='funded' but no matching 'escrow_lock' ledger
    3. Payout requests in 'pending' older than 24h
    4. Webhook events stuck in 'received' (never processed)
    """
    now = datetime.now(timezone.utc)
    cutoff_30m = (now - timedelta(minutes=30)).isoformat()
    cutoff_24h = (now - timedelta(hours=24)).isoformat()

    stale_payments = await db.payments.find(
        {"status": "pending", "created_at": {"$lt": cutoff_30m}},
        {"_id": 0},
    ).limit(50).to_list(50)

    # Orphan escrow check — sample recent funded orders missing their lock entry
    funded_orders = await db.orders.find(
        {"escrow_status": "funded"}, {"_id": 0, "id": 1, "buyer_id": 1, "total": 1, "created_at": 1},
    ).sort("created_at", -1).limit(200).to_list(200)
    orphans = []
    for o in funded_orders:
        locked = await db.ledger.find_one({"order_id": o["id"], "kind": "escrow_lock"}, {"_id": 0})
        if not locked:
            orphans.append(o)
        if len(orphans) >= 20:
            break

    stale_payouts = await db.payout_requests.find(
        {"status": "pending", "created_at": {"$lt": cutoff_24h}},
        {"_id": 0},
    ).limit(50).to_list(50)

    unprocessed_webhooks = await db.webhook_events.find(
        {"status": "received"}, {"_id": 0},
    ).limit(50).to_list(50)

    return {
        "stale_payments": stale_payments,
        "escrow_orphans": orphans,
        "stale_payouts": stale_payouts,
        "unprocessed_webhooks": unprocessed_webhooks,
        "counts": {
            "stale_payments": len(stale_payments),
            "escrow_orphans": len(orphans),
            "stale_payouts": len(stale_payouts),
            "unprocessed_webhooks": len(unprocessed_webhooks),
        },
        "generated_at": now.isoformat(),
    }


@api.get("/admin/audit")
async def admin_audit_log(limit: int = 100, user: dict = Depends(require_roles("admin"))):
    rows = await db.admin_audit.find({}, {"_id": 0}).sort("at", -1).limit(max(1, min(500, limit))).to_list(500)
    return rows


@api.get("/admin/webhook-events")
async def admin_webhook_events(limit: int = 50, user: dict = Depends(require_roles("admin"))):
    rows = await db.webhook_events.find({}, {"_id": 0, "raw": 0}).sort("received_at", -1).limit(max(1, min(200, limit))).to_list(200)
    return rows


# ---------------- Phase D: Scale + Moat routes (register on api before include) ----------------
from routes import phase_d as _phase_d  # noqa: E402
from routes import phase_f as _phase_f  # noqa: E402

_phase_d_handles = _phase_d.register(
    api,
    db=db,
    current_user=current_user,
    require_roles=require_roles,
    notify=notify,
    new_id=new_id,
)
_check_alerts_for_listing = _phase_d_handles["check_alerts_for_listing"]

_phase_f.register(
    api,
    db=db,
    current_user=current_user,
    require_roles=require_roles,
    notify=notify,
    new_id=new_id,
    ensure_wallet=ensure_wallet,
    ledger=ledger,
)


app.include_router(api)


# ---------------- Phase C: Market Pulse duplicate guard ----------------

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Startup seed ----------------
@app.on_event("startup")
async def seed() -> None:
    init_storage()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.listings.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.wallets.create_index("user_id", unique=True)
    await db.logistics_jobs.create_index("id", unique=True)
    await db.loans.create_index("id", unique=True)
    await db.notifications.create_index("user_id")
    await db.files.create_index("storage_path")
    await db.price_alerts.create_index("user_id")
    await db.price_alerts.create_index([("crop", 1), ("country", 1), ("active", 1)])
    # Phase E: ephemeral listing view events — TTL 10 min (600s)
    await db.listing_views.create_index("at", expireAfterSeconds=600)
    await db.listing_views.create_index([("listing_id", 1), ("at", -1)])
    # Phase E: supplier score snapshots (retention 365d)
    await db.supplier_score_history.create_index([("supplier_id", 1), ("captured_at", -1)])
    # Phase F: opportunities + investments
    await db.opportunities.create_index("id", unique=True)
    await db.opportunities.create_index([("status", 1), ("created_at", -1)])
    await db.investments.create_index("id", unique=True)
    await db.investments.create_index([("investor_id", 1), ("created_at", -1)])

    # Seed admin
    if not await db.users.find_one({"email": "admin@agriflow.ng"}):
        uid = new_id()
        await db.users.insert_one(
            {
                "id": uid,
                "email": "admin@agriflow.ng",
                "password_hash": hash_password("Admin@12345"),
                "full_name": "AgriFlow Admin",
                "role": "admin",
                "verified": True,
                "kyc_status": "verified",
                "created_at": utcnow(),
            }
        )
        await ensure_wallet(uid)
        logger.info("Seeded admin@agriflow.ng")

    # Seed demo farmer
    if not await db.users.find_one({"email": "farmer@agriflow.ng"}):
        fid = new_id()
        await db.users.insert_one(
            {
                "id": fid,
                "email": "farmer@agriflow.ng",
                "password_hash": hash_password("Farmer@123"),
                "full_name": "Adebayo Ogunleye",
                "role": "farmer",
                "phone": "+2348012345678",
                "location": "Ogun State",
                "farm_size_hectares": 12.5,
                "verified": True,
                "kyc_status": "verified",
                "referral_code": "AF-DEMO01",
                "created_at": utcnow(),
            }
        )
        await ensure_wallet(fid)
        # demo listings
        demos = [
            {
                "crop": "Tomato",
                "variety": "Roma",
                "quantity_kg": 500,
                "price_per_kg": 850,
                "grade": "A",
                "location": "Ogun State",
                "description": "Freshly harvested Roma tomatoes, bulk ready for pickup.",
                "image_url": "https://images.pexels.com/photos/13711819/pexels-photo-13711819.jpeg?auto=compress&cs=tinysrgb&w=800",
            },
            {
                "crop": "Yam",
                "variety": "White Yam",
                "quantity_kg": 1200,
                "price_per_kg": 1200,
                "grade": "A",
                "location": "Benue State",
                "description": "Premium white yam tubers, export-grade.",
                "image_url": "https://images.pexels.com/photos/36853837/pexels-photo-36853837.jpeg?auto=compress&cs=tinysrgb&w=800",
            },
            {
                "crop": "Cassava",
                "variety": "TME 419",
                "quantity_kg": 2000,
                "price_per_kg": 350,
                "grade": "B",
                "location": "Oyo State",
                "description": "Fresh cassava, suitable for garri and fufu processors.",
                "image_url": "https://images.pexels.com/photos/34705724/pexels-photo-34705724.jpeg?auto=compress&cs=tinysrgb&w=800",
            },
        ]
        for d in demos:
            await db.listings.insert_one(
                {
                    "id": new_id(),
                    "farmer_id": fid,
                    "farmer_name": "Adebayo Ogunleye",
                    "farmer_verified": True,
                    "country_code": "NG",
                    "currency": "NGN",
                    **d,
                    "status": "active",
                    "created_at": utcnow(),
                }
            )
        logger.info("Seeded demo farmer + listings")

    # Backfill country_code / currency on any existing listings missing them
    await db.listings.update_many(
        {"country_code": {"$exists": False}},
        {"$set": {"country_code": "NG", "currency": "NGN"}},
    )

    # Seed demo buyer
    if not await db.users.find_one({"email": "buyer@agriflow.ng"}):
        bid = new_id()
        await db.users.insert_one(
            {
                "id": bid,
                "email": "buyer@agriflow.ng",
                "password_hash": hash_password("Buyer@123"),
                "full_name": "Chioma Okeke",
                "role": "buyer",
                "phone": "+2348087654321",
                "business_name": "Okeke Wholesale Foods",
                "location": "Lagos",
                "verified": True,
                "kyc_status": "verified",
                "referral_code": "AF-DEMO02",
                "created_at": utcnow(),
            }
        )
        w = await ensure_wallet(bid)
        # Give demo buyer some balance
        await db.wallets.update_one({"user_id": bid}, {"$set": {"available": 5000000}})
        await ledger(bid, "fund", 5000000, "credit", new_id(), "Demo seed balance")
        logger.info("Seeded demo buyer")

    # Seed demo logistics
    if not await db.users.find_one({"email": "logistics@agriflow.ng"}):
        lid = new_id()
        await db.users.insert_one(
            {
                "id": lid,
                "email": "logistics@agriflow.ng",
                "password_hash": hash_password("Logistics@123"),
                "full_name": "Ibrahim Transport Co.",
                "role": "logistics",
                "phone": "+2348055512345",
                "location": "Lagos",
                "verified": True,
                "kyc_status": "verified",
                "created_at": utcnow(),
            }
        )
        await ensure_wallet(lid)
        logger.info("Seeded demo logistics")

    # Seed demo investor
    if not await db.users.find_one({"email": "investor@agriflow.ng"}):
        iid = new_id()
        await db.users.insert_one(
            {
                "id": iid,
                "email": "investor@agriflow.ng",
                "password_hash": hash_password("Invest@123"),
                "full_name": "Tunde Adesanya",
                "role": "investor",
                "phone": "+2348099988877",
                "location": "Lagos",
                "verified": True,
                "kyc_status": "verified",
                "referral_code": "AF-INV001",
                "country": "NG",
                "currency": "NGN",
                "created_at": utcnow(),
            }
        )
        await ensure_wallet(iid)
        await db.wallets.update_one({"user_id": iid}, {"$set": {"available": 2000000}})
        await ledger(iid, "fund", 2000000, "credit", new_id(), "Demo seed balance")
        logger.info("Seeded demo investor")

    # Seed demo opportunities if none exist
    if await db.opportunities.count_documents({}) == 0:
        farmer = await db.users.find_one({"email": "farmer@agriflow.ng"}, {"_id": 0})
        if farmer:
            demo_opps = [
                {
                    "title": "Cassava expansion — Oyo · 6mo cycle",
                    "crop": "Cassava",
                    "summary": "Scaling our Cassava farm from 8ha to 20ha for the next dry-season harvest. Funds go to seedlings, labour, and mechanised tilling. 3yr track record with AGRIOS.",
                    "region": "Oyo",
                    "duration_months": 6,
                    "funding_target": 750000.0,
                    "funding_raised": 180000.0,
                    "min_ticket": 5000.0,
                    "target_return_pct": 14.0,
                    "risk_band": "B",
                    "use_of_funds": "40% seedlings · 30% labour · 20% mechanised tilling · 10% working capital",
                    "investor_count": 3,
                },
                {
                    "title": "Tomato greenhouse — Ogun · 4mo",
                    "crop": "Tomato",
                    "summary": "Short-cycle greenhouse tomato production with pre-committed offtake from two Lagos wholesalers. Lower weather risk thanks to covered cultivation.",
                    "region": "Ogun",
                    "duration_months": 4,
                    "funding_target": 400000.0,
                    "funding_raised": 320000.0,
                    "min_ticket": 10000.0,
                    "target_return_pct": 11.0,
                    "risk_band": "A",
                    "use_of_funds": "60% inputs · 25% greenhouse maintenance · 15% labour",
                    "investor_count": 8,
                },
                {
                    "title": "Rice paddy — Kebbi · 10mo",
                    "crop": "Rice",
                    "summary": "New 15ha paddy cycle in Kebbi with pending offtake agreement. Higher upside, longer cycle, seasonal price volatility.",
                    "region": "Kebbi",
                    "duration_months": 10,
                    "funding_target": 1500000.0,
                    "funding_raised": 250000.0,
                    "min_ticket": 25000.0,
                    "target_return_pct": 22.0,
                    "risk_band": "C",
                    "use_of_funds": "Land prep, inputs, irrigation repair, harvest labour",
                    "investor_count": 2,
                },
            ]
            for d in demo_opps:
                await db.opportunities.insert_one(
                    {
                        "id": new_id(),
                        "farmer_id": farmer["id"],
                        "farmer_name": farmer["full_name"],
                        "farmer_verified": True,
                        "country": "NG",
                        "currency": "NGN",
                        "status": "open",
                        "approved_at": datetime.now(timezone.utc),
                        "expected_close_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                        "created_at": datetime.now(timezone.utc),
                        **d,
                    }
                )
            logger.info("Seeded demo opportunities")


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()
