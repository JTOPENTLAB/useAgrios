"""AgriFlow comprehensive backend tests covering auth, listings, wallet, escrow, offers, logistics, disputes, admin and AI."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@agriflow.ng", "password": "Admin@12345"}
FARMER = {"email": "farmer@agriflow.ng", "password": "Farmer@123"}
BUYER = {"email": "buyer@agriflow.ng", "password": "Buyer@123"}
LOGI = {"email": "logistics@agriflow.ng", "password": "Logistics@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def tokens():
    a, _ = _login(ADMIN)
    f, fu = _login(FARMER)
    b, bu = _login(BUYER)
    l, lu = _login(LOGI)
    return {"admin": a, "farmer": (f, fu), "buyer": (b, bu), "logistics": (l, lu)}


# -------- Health & basic --------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# -------- Auth --------
def test_signup_admin_rejected():
    r = requests.post(f"{API}/auth/signup", json={
        "email": f"hacker_{uuid.uuid4().hex[:6]}@x.com", "password": "Pass1234",
        "full_name": "X", "role": "admin"
    }, timeout=10)
    assert r.status_code == 400


def test_signup_farmer_ok():
    em = f"TEST_farmer_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/signup", json={
        "email": em, "password": "Pass1234", "full_name": "Test Farmer", "role": "farmer"
    }, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["role"] == "farmer"
    assert "token" in data
    # _id should not leak
    assert "_id" not in data["user"]


def test_login_all_demo(tokens):
    # implicit success via fixture
    assert tokens["admin"]
    assert tokens["farmer"][1]["role"] == "farmer"
    assert tokens["buyer"][1]["role"] == "buyer"
    assert tokens["logistics"][1]["role"] == "logistics"


def test_me(tokens):
    tok, _ = tokens["buyer"]
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    assert r.json()["email"] == "buyer@agriflow.ng"
    assert "_id" not in r.json()


# -------- Listings --------
def test_public_listings_seeded():
    r = requests.get(f"{API}/listings", timeout=10)
    assert r.status_code == 200
    items = r.json()
    crops = {i["crop"] for i in items}
    assert {"Tomato", "Yam", "Cassava"}.issubset(crops)
    for it in items:
        assert "_id" not in it


def test_listings_filter_q():
    r = requests.get(f"{API}/listings", params={"q": "Tomato"}, timeout=10)
    assert r.status_code == 200
    assert any(i["crop"] == "Tomato" for i in r.json())


def test_listings_filter_grade():
    r = requests.get(f"{API}/listings", params={"grade": "B"}, timeout=10)
    assert r.status_code == 200
    assert all(i["grade"] == "B" for i in r.json())


def test_create_listing_buyer_forbidden(tokens):
    tok, _ = tokens["buyer"]
    r = requests.post(f"{API}/listings", headers=_h(tok), json={
        "crop": "Maize", "quantity_kg": 10, "price_per_kg": 100, "grade": "A", "location": "Lagos"
    }, timeout=10)
    assert r.status_code == 403


def test_create_listing_farmer_ok(tokens):
    tok, _ = tokens["farmer"]
    r = requests.post(f"{API}/listings", headers=_h(tok), json={
        "crop": "Maize", "variety": "Yellow", "quantity_kg": 100, "price_per_kg": 500,
        "grade": "A", "location": "Kaduna", "description": "TEST_listing"
    }, timeout=10)
    assert r.status_code == 200
    assert r.json()["crop"] == "Maize"


def test_listings_mine_farmer(tokens):
    tok, _ = tokens["farmer"]
    r = requests.get(f"{API}/listings/mine", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    assert len(r.json()) >= 3


# -------- Wallet --------
def test_buyer_wallet_seed(tokens):
    tok, _ = tokens["buyer"]
    r = requests.get(f"{API}/wallet", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    w = r.json()["wallet"]
    assert w["available"] >= 0  # may have spent in prior runs


def test_wallet_fund(tokens):
    tok, _ = tokens["buyer"]
    before = requests.get(f"{API}/wallet", headers=_h(tok), timeout=10).json()["wallet"]["available"]
    r = requests.post(f"{API}/wallet/fund", headers=_h(tok), json={"amount": 1000}, timeout=10)
    assert r.status_code == 200
    after = r.json()["wallet"]["available"]
    assert round(after - before, 2) == 1000.0


# -------- E2E escrow flow --------
@pytest.fixture(scope="session")
def e2e_order(tokens):
    """Create order, fund escrow, run logistics state machine, confirm delivery."""
    btok, buyer = tokens["buyer"]
    ltok, logi = tokens["logistics"]

    # Get a listing with enough qty
    listings = requests.get(f"{API}/listings", timeout=10).json()
    lst = next(i for i in listings if i["crop"] == "Tomato")

    qty = 2.0
    total_expected = round(qty * lst["price_per_kg"], 2)
    commission_expected = round(total_expected * 0.05, 2)
    farmer_expected = round(total_expected - commission_expected, 2)

    # Top up to ensure balance
    requests.post(f"{API}/wallet/fund", headers=_h(btok), json={"amount": total_expected + 1000}, timeout=10)
    w_before = requests.get(f"{API}/wallet", headers=_h(btok), timeout=10).json()["wallet"]
    avail_before = w_before["available"]
    escrow_before = w_before["escrow_held"]

    # Create order
    r = requests.post(f"{API}/orders", headers=_h(btok), json={
        "listing_id": lst["id"], "quantity_kg": qty, "delivery_address": "TEST 1 Lagos"
    }, timeout=10)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["total"] == total_expected
    assert order["commission"] == commission_expected
    assert order["farmer_amount"] == farmer_expected
    oid = order["id"]

    # Fund escrow
    r = requests.post(f"{API}/orders/{oid}/fund-escrow", headers=_h(btok), timeout=10)
    assert r.status_code == 200, r.text
    w_after = requests.get(f"{API}/wallet", headers=_h(btok), timeout=10).json()["wallet"]
    assert round(avail_before - w_after["available"], 2) == total_expected
    assert round(w_after["escrow_held"] - escrow_before, 2) == total_expected

    # Logistics accepts: find pending job
    jobs = requests.get(f"{API}/logistics/jobs", headers=_h(ltok), timeout=10).json()
    job = next(j for j in jobs if j["order_id"] == oid)
    r = requests.post(f"{API}/logistics/jobs/{job['id']}/accept", headers=_h(ltok), timeout=10)
    assert r.status_code == 200, r.text

    # Status transitions
    for status in ["picked_up", "in_transit", "delivered"]:
        r = requests.post(f"{API}/logistics/jobs/{job['id']}/status",
                          headers=_h(ltok), json={"status": status}, timeout=10)
        assert r.status_code == 200, f"{status}: {r.text}"

    # Buyer confirms delivery
    r = requests.post(f"{API}/orders/{oid}/confirm-delivery", headers=_h(btok), timeout=10)
    assert r.status_code == 200, r.text

    # Verify order completed
    o = requests.get(f"{API}/orders/{oid}", headers=_h(btok), timeout=10).json()
    assert o["status"] == "completed"
    assert o["escrow_status"] == "released"

    return {"order": o, "buyer_avail_before": avail_before,
            "total": total_expected, "farmer_amount": farmer_expected}


def test_e2e_escrow_completes(e2e_order):
    assert e2e_order["order"]["status"] == "completed"


def test_farmer_received_payment(tokens, e2e_order):
    tok, _ = tokens["farmer"]
    w = requests.get(f"{API}/wallet", headers=_h(tok), timeout=10).json()["wallet"]
    # Farmer wallet should have at least farmer_amount
    assert w["available"] >= e2e_order["farmer_amount"]


# -------- Offers --------
def test_offer_flow(tokens):
    btok, _ = tokens["buyer"]
    ftok, _ = tokens["farmer"]
    listings = requests.get(f"{API}/listings", timeout=10).json()
    lst = listings[0]
    r = requests.post(f"{API}/offers", headers=_h(btok), json={
        "listing_id": lst["id"], "quantity_kg": 10, "price_per_kg": 100, "message": "TEST_offer"
    }, timeout=10)
    assert r.status_code == 200
    oid = r.json()["id"]

    r = requests.get(f"{API}/offers/farmer", headers=_h(ftok), timeout=10)
    assert r.status_code == 200
    assert any(o["id"] == oid for o in r.json())

    r = requests.post(f"{API}/offers/{oid}/action", headers=_h(ftok),
                      json={"action": "accept"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"


# -------- Dispute flow --------
def test_dispute_refund_buyer(tokens):
    """Create another order, fund escrow, raise dispute, admin refunds buyer."""
    btok, buyer = tokens["buyer"]
    atok = tokens["admin"]
    listings = requests.get(f"{API}/listings", timeout=10).json()
    lst = next(i for i in listings if i["crop"] == "Yam")
    qty = 1.0

    requests.post(f"{API}/wallet/fund", headers=_h(btok),
                  json={"amount": qty * lst["price_per_kg"] + 1000}, timeout=10)
    avail_pre = requests.get(f"{API}/wallet", headers=_h(btok), timeout=10).json()["wallet"]["available"]

    r = requests.post(f"{API}/orders", headers=_h(btok), json={
        "listing_id": lst["id"], "quantity_kg": qty, "delivery_address": "TEST"
    }, timeout=10)
    oid = r.json()["id"]
    total = r.json()["total"]

    requests.post(f"{API}/orders/{oid}/fund-escrow", headers=_h(btok), timeout=10)

    r = requests.post(f"{API}/disputes", headers=_h(btok), json={
        "order_id": oid, "reason": "quality", "description": "TEST_dispute"
    }, timeout=10)
    assert r.status_code == 200
    did = r.json()["id"]

    r = requests.post(f"{API}/disputes/{did}/resolve", headers=_h(atok),
                      json={"resolution": "refund_buyer"}, timeout=10)
    assert r.status_code == 200, r.text

    avail_post = requests.get(f"{API}/wallet", headers=_h(btok), timeout=10).json()["wallet"]["available"]
    # Buyer should have escrow refunded back; net change ~ 0 (paid total then refunded total)
    assert round(avail_post, 2) == round(avail_pre, 2)


# -------- Admin --------
def test_admin_overview(tokens):
    r = requests.get(f"{API}/admin/overview", headers=_h(tokens["admin"]), timeout=10)
    assert r.status_code == 200
    assert "users" in r.json()


def test_admin_users(tokens):
    r = requests.get(f"{API}/admin/users", headers=_h(tokens["admin"]), timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_overview_403_for_buyer(tokens):
    btok, _ = tokens["buyer"]
    r = requests.get(f"{API}/admin/overview", headers=_h(btok), timeout=10)
    assert r.status_code == 403


def test_admin_verify_user(tokens):
    atok = tokens["admin"]
    # create user to verify
    em = f"TEST_v_{uuid.uuid4().hex[:6]}@x.com"
    s = requests.post(f"{API}/auth/signup", json={
        "email": em, "password": "Pass1234", "full_name": "ToVerify", "role": "farmer"
    }, timeout=10).json()
    uid = s["user"]["id"]
    r = requests.post(f"{API}/admin/users/{uid}/verify", headers=_h(atok), timeout=10)
    assert r.status_code == 200


# -------- AI --------
def test_ai_price(tokens):
    tok, _ = tokens["farmer"]
    r = requests.post(f"{API}/ai/price-recommendation", headers=_h(tok), json={
        "crop": "Tomato", "region": "Lagos", "grade": "A", "quantity_kg": 100
    }, timeout=60)
    assert r.status_code == 200
    txt = r.json().get("recommendation", "")
    assert isinstance(txt, str) and len(txt) > 20


def test_ai_video(tokens):
    tok, _ = tokens["farmer"]
    r = requests.post(f"{API}/ai/video-script", headers=_h(tok), json={
        "crop": "Yam", "quantity_kg": 100, "price_per_kg": 1200, "location": "Benue", "grade": "A"
    }, timeout=60)
    assert r.status_code == 200
    assert len(r.json().get("script", "")) > 20
