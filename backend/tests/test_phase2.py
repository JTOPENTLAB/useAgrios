"""AgriFlow Phase 2 backend tests:
uploads/files, loans lifecycle, credit score, notifications,
referrals, analytics, video-templates, signup extensions.
"""
import io
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
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


@pytest.fixture(scope="module")
def tokens():
    a, au = _login(ADMIN)
    f, fu = _login(FARMER)
    b, bu = _login(BUYER)
    l, lu = _login(LOGI)
    return {"admin": (a, au), "farmer": (f, fu), "buyer": (b, bu), "logistics": (l, lu)}


# ---------- Signup extensions ----------
def test_signup_with_farm_size_and_referral(tokens):
    # Referrer: demo farmer with referral_code AF-DEMO01
    em = f"TEST_signup_{uuid.uuid4().hex[:8]}@x.com"
    r = requests.post(f"{API}/auth/signup", json={
        "email": em, "password": "Pass1234", "full_name": "Test Ref",
        "role": "farmer", "farm_size_hectares": 7.5, "referral_code": "AF-DEMO01"
    }, timeout=15)
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["farm_size_hectares"] == 7.5
    assert user.get("referral_code", "").startswith("AF-")


# ---------- Uploads ----------
def _tiny_png():
    # 1x1 PNG bytes
    import base64
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg=="
    )


def test_upload_image_ok(tokens):
    tok, _ = tokens["farmer"]
    files = {"file": ("t.png", _tiny_png(), "image/png")}
    r = requests.post(f"{API}/uploads", headers=_h(tok), files=files, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data and "path" in data and "url" in data
    assert data["url"].startswith("/api/files/")
    # fetch via public URL
    g = requests.get(f"{BASE_URL}{data['url']}", timeout=60)
    assert g.status_code == 200
    assert g.headers.get("content-type", "").startswith("image/")
    assert len(g.content) > 0


def test_upload_rejects_bad_mime(tokens):
    tok, _ = tokens["farmer"]
    files = {"file": ("t.txt", b"hello", "text/plain")}
    r = requests.post(f"{API}/uploads", headers=_h(tok), files=files, timeout=30)
    assert r.status_code == 400


# ---------- Loans ----------
def test_credit_score(tokens):
    tok, _ = tokens["farmer"]
    r = requests.get(f"{API}/loans/score", headers=_h(tok), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert 300 <= data["score"] <= 850
    assert data["band"] in {"A", "B", "C", "D"}
    sig = data["signals"]
    for key in ("listings", "completed_orders", "gmv", "farm_size_hectares"):
        assert key in sig


def test_credit_score_non_farmer_forbidden(tokens):
    tok, _ = tokens["buyer"]
    r = requests.get(f"{API}/loans/score", headers=_h(tok), timeout=15)
    assert r.status_code == 403


def test_loans_mine_forbidden_for_admin(tokens):
    tok, _ = tokens["admin"]
    r = requests.get(f"{API}/loans/mine", headers=_h(tok), timeout=15)
    assert r.status_code == 403


def test_loans_admin_list_only(tokens):
    atok, _ = tokens["admin"]
    btok, _ = tokens["buyer"]
    r = requests.get(f"{API}/loans", headers=_h(atok), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    r2 = requests.get(f"{API}/loans", headers=_h(btok), timeout=15)
    assert r2.status_code == 403


@pytest.fixture(scope="module")
def approved_loan(tokens):
    """Apply, approve, disburse a loan for the demo farmer."""
    ftok, fu = tokens["farmer"]
    atok, _ = tokens["admin"]
    # Apply
    r = requests.post(f"{API}/loans/apply", headers=_h(ftok),
                      json={"amount": 100000, "purpose": "TEST seeds", "term_months": 3},
                      timeout=15)
    assert r.status_code == 200, r.text
    loan = r.json()
    assert loan["status"] == "pending"
    assert 300 <= loan["credit_score"] <= 850
    assert "credit_signals" in loan
    lid = loan["id"]
    # Notification created for farmer
    notes = requests.get(f"{API}/notifications", headers=_h(ftok), timeout=15).json()
    assert any(n.get("ref") == lid for n in notes["items"])
    # Approve
    r = requests.post(f"{API}/loans/{lid}/decision", headers=_h(atok),
                      json={"action": "approve", "interest_rate_pct": 10.0}, timeout=15)
    assert r.status_code == 200, r.text
    got = requests.get(f"{API}/loans/{lid}", headers=_h(atok), timeout=15).json()
    assert got["status"] == "approved"
    assert got["total_repayable"] == round(100000 * 1.10, 2)
    assert got["outstanding"] == got["total_repayable"]
    assert isinstance(got["schedule"], list) and len(got["schedule"]) == 3
    # Disburse
    wb = requests.get(f"{API}/wallet", headers=_h(ftok), timeout=15).json()["wallet"]["available"]
    r = requests.post(f"{API}/loans/{lid}/disburse", headers=_h(atok), timeout=15)
    assert r.status_code == 200, r.text
    wa = requests.get(f"{API}/wallet", headers=_h(ftok), timeout=15).json()["wallet"]["available"]
    assert round(wa - wb, 2) == 100000
    # Ledger has loan_disbursement
    entries = requests.get(f"{API}/wallet", headers=_h(ftok), timeout=15).json()["entries"]
    assert any(e["kind"] == "loan_disbursement" for e in entries)
    return lid


def test_loan_reject_flow(tokens):
    ftok, _ = tokens["farmer"]
    atok, _ = tokens["admin"]
    r = requests.post(f"{API}/loans/apply", headers=_h(ftok),
                      json={"amount": 50000, "purpose": "TEST reject", "term_months": 2},
                      timeout=15)
    lid = r.json()["id"]
    r = requests.post(f"{API}/loans/{lid}/decision", headers=_h(atok),
                      json={"action": "reject", "notes": "TEST"}, timeout=15)
    assert r.status_code == 200
    got = requests.get(f"{API}/loans/{lid}", headers=_h(atok), timeout=15).json()
    assert got["status"] == "rejected"


def test_loan_repay_partial_then_full(tokens, approved_loan):
    ftok, _ = tokens["farmer"]
    lid = approved_loan
    # Partial
    r = requests.post(f"{API}/loans/{lid}/repay", headers=_h(ftok),
                      json={"amount": 20000}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "partially_repaid"
    assert r.json()["outstanding"] > 0
    # Full remainder
    loan = requests.get(f"{API}/loans/{lid}", headers=_h(ftok), timeout=15).json()
    remaining = loan["outstanding"]
    # Fund wallet if needed
    w = requests.get(f"{API}/wallet", headers=_h(ftok), timeout=15).json()["wallet"]["available"]
    if w < remaining:
        requests.post(f"{API}/wallet/fund", headers=_h(ftok),
                      json={"amount": remaining - w + 100}, timeout=10)
    r = requests.post(f"{API}/loans/{lid}/repay", headers=_h(ftok),
                      json={"amount": remaining}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "repaid"
    assert r.json()["outstanding"] <= 0
    # Verify schedule rows all paid
    loan = requests.get(f"{API}/loans/{lid}", headers=_h(ftok), timeout=15).json()
    assert all(row["paid"] for row in loan["schedule"])


# ---------- Notifications ----------
def test_notifications_list_and_mark(tokens):
    ftok, _ = tokens["farmer"]
    r = requests.get(f"{API}/notifications", headers=_h(ftok), timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and "unread" in data
    if data["items"]:
        nid = data["items"][0]["id"]
        r = requests.post(f"{API}/notifications/{nid}/read", headers=_h(ftok), timeout=15)
        assert r.status_code == 200
    r = requests.post(f"{API}/notifications/read-all", headers=_h(ftok), timeout=15)
    assert r.status_code == 200
    data2 = requests.get(f"{API}/notifications", headers=_h(ftok), timeout=15).json()
    assert data2["unread"] == 0


# ---------- Analytics ----------
def test_analytics_prices(tokens):
    tok, _ = tokens["buyer"]
    r = requests.get(f"{API}/analytics/prices", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) > 0
    for row in arr:
        for k in ("crop", "avg_price", "min_price", "max_price", "total_qty_kg", "listings"):
            assert k in row


def test_analytics_demand(tokens):
    tok, _ = tokens["buyer"]
    r = requests.get(f"{API}/analytics/demand", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    for row in r.json():
        assert {"crop", "orders", "gmv"}.issubset(row.keys())


def test_analytics_weather(tokens):
    tok, _ = tokens["buyer"]
    r = requests.get(f"{API}/analytics/weather", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "regions" in d and len(d["regions"]) >= 3


# ---------- Video templates ----------
def test_video_templates(tokens):
    tok, _ = tokens["farmer"]
    r = requests.get(f"{API}/video-templates", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert len(arr) == 20
    for t in arr:
        assert {"id", "title", "hook", "beats"}.issubset(t.keys())
        assert isinstance(t["beats"], list)


# ---------- Referral end-to-end ----------
def test_referral_bonus_on_first_completed_order(tokens):
    """A (farmer_ref) referred B (buyer). B completes first order -> both get ₦5000."""
    # Create referrer (farmer)
    ra_email = f"TEST_refA_{uuid.uuid4().hex[:6]}@x.com"
    ra = requests.post(f"{API}/auth/signup", json={
        "email": ra_email, "password": "Pass1234", "full_name": "Ref A",
        "role": "farmer", "farm_size_hectares": 2.0
    }, timeout=15)
    assert ra.status_code == 200, ra.text
    a_user = ra.json()["user"]
    a_tok = ra.json()["token"]
    a_code = a_user["referral_code"]

    # Create referred buyer with A's code
    rb_email = f"TEST_refB_{uuid.uuid4().hex[:6]}@x.com"
    rb = requests.post(f"{API}/auth/signup", json={
        "email": rb_email, "password": "Pass1234", "full_name": "Ref B",
        "role": "buyer", "referral_code": a_code
    }, timeout=15)
    assert rb.status_code == 200, rb.text
    b_tok = rb.json()["token"]

    # Fund B wallet
    listings = requests.get(f"{API}/listings", timeout=15).json()
    lst = next(i for i in listings if i["quantity_kg"] >= 1)
    need = lst["price_per_kg"] * 1 + 1000
    requests.post(f"{API}/wallet/fund", headers=_h(b_tok),
                  json={"amount": need}, timeout=10)

    # Get A wallet baseline
    a_before = requests.get(f"{API}/wallet", headers=_h(a_tok), timeout=15).json()["wallet"]["available"]
    b_before = requests.get(f"{API}/wallet", headers=_h(b_tok), timeout=15).json()["wallet"]["available"]

    # B places order + funds escrow
    r = requests.post(f"{API}/orders", headers=_h(b_tok), json={
        "listing_id": lst["id"], "quantity_kg": 1, "delivery_address": "TEST_ref"
    }, timeout=15)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]
    r = requests.post(f"{API}/orders/{oid}/fund-escrow", headers=_h(b_tok), timeout=15)
    assert r.status_code == 200, r.text

    # Logistics accepts + delivers
    ltok, _ = tokens["logistics"]
    jobs = requests.get(f"{API}/logistics/jobs", headers=_h(ltok), timeout=15).json()
    job = next(j for j in jobs if j["order_id"] == oid)
    requests.post(f"{API}/logistics/jobs/{job['id']}/accept", headers=_h(ltok), timeout=15)
    for s in ("picked_up", "in_transit", "delivered"):
        requests.post(f"{API}/logistics/jobs/{job['id']}/status",
                      headers=_h(ltok), json={"status": s}, timeout=15)

    # B confirms delivery -> triggers referral bonus
    r = requests.post(f"{API}/orders/{oid}/confirm-delivery", headers=_h(b_tok), timeout=15)
    assert r.status_code == 200, r.text

    time.sleep(0.5)
    a_after = requests.get(f"{API}/wallet", headers=_h(a_tok), timeout=15).json()
    b_after = requests.get(f"{API}/wallet", headers=_h(b_tok), timeout=15).json()

    assert round(a_after["wallet"]["available"] - a_before, 2) == 5000.0, \
        f"Referrer A did not receive ₦5000 bonus"
    # Buyer B got 5000 bonus in addition to whatever refunds - should be +5000 vs pre-order
    # Let's assert ledger has referral_bonus entry
    assert any(e["kind"] == "referral_bonus" for e in a_after["entries"])
    assert any(e["kind"] == "referral_bonus" for e in b_after["entries"])

    # Notifications
    a_notes = requests.get(f"{API}/notifications", headers=_h(a_tok), timeout=15).json()
    b_notes = requests.get(f"{API}/notifications", headers=_h(b_tok), timeout=15).json()
    assert any(n["kind"] == "referral" for n in a_notes["items"])
    assert any(n["kind"] == "referral" for n in b_notes["items"])
