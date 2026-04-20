"""AgriFlow — African agricultural financial infrastructure.

MVP backend (Phase 1). FastAPI + MongoDB (motor).
All routes are prefixed with /api. No _id leaks to clients.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
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

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("agriflow")

app = FastAPI(title="AgriFlow API", version="0.1.0")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

Role = Literal["farmer", "buyer", "logistics", "admin"]
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
    w = {
        "user_id": user_id,
        "available": 0.0,
        "pending": 0.0,
        "escrow_held": 0.0,
        "currency": "NGN",
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
    doc = {
        "id": uid,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "role": body.role,
        "phone": body.phone,
        "business_name": body.business_name,
        "location": body.location,
        "kyc_status": "unverified",
        "verified": False,
        "created_at": utcnow(),
    }
    await db.users.insert_one(doc.copy())
    await ensure_wallet(uid)
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
    return UserOut(**user)


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
    doc = {
        "id": new_id(),
        "farmer_id": user["id"],
        "farmer_name": user["full_name"],
        "farmer_verified": user.get("verified", False),
        **body.model_dump(),
        "status": "active",
        "created_at": utcnow(),
    }
    await db.listings.insert_one(doc.copy())
    return serialize(doc)


@api.get("/listings")
async def list_listings(
    q: Optional[str] = None,
    crop: Optional[str] = None,
    location: Optional[str] = None,
    grade: Optional[str] = None,
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
    items = await db.listings.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/listings/mine")
async def my_listings(user: dict = Depends(require_roles("farmer"))):
    items = (
        await db.listings.find({"farmer_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return items


@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    l = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Listing not found")
    return l


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
    return {"ok": True, "order_id": order_id, "status": "escrow_funded"}


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
    return {"service": "AgriFlow API", "status": "ok"}


@api.get("/health")
async def health():
    return {"status": "ok", "time": utcnow()}


app.include_router(api)

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
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.listings.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.wallets.create_index("user_id", unique=True)
    await db.logistics_jobs.create_index("id", unique=True)

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
                "verified": True,
                "kyc_status": "verified",
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
                    **d,
                    "status": "active",
                    "created_at": utcnow(),
                }
            )
        logger.info("Seeded demo farmer + listings")

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


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()
