"""Phase F — Investor marketplace regression.

Run: pytest /app/backend/tests/test_phase_f.py -v
"""
import os
import uuid

import httpx

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001") + "/api"


def _login(email, password):
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_signup_investor_role():
    email = f"inv_{uuid.uuid4().hex[:8]}@example.com"
    r = httpx.post(
        f"{BASE}/auth/signup",
        json={
            "full_name": "Test Investor",
            "email": email,
            "password": "Pass@1234",
            "role": "investor",
            "country": "NG",
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "investor"


def test_farmer_creates_opportunity_and_admin_approves():
    ftoken = _login("farmer@agriflow.ng", "Farmer@123")
    atoken = _login("admin@agriflow.ng", "Admin@12345")

    r = httpx.post(
        f"{BASE}/opportunities",
        json={
            "title": "pytest opp " + uuid.uuid4().hex[:6],
            "crop": "Maize",
            "summary": "Test opportunity summary content 1234567890.",
            "region": "Kaduna",
            "duration_months": 4,
            "funding_target": 100000,
            "min_ticket": 5000,
            "target_return_pct": 12,
            "risk_band": "A",
        },
        headers=_auth(ftoken),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    opp_id = r.json()["id"]
    assert r.json()["status"] == "review"

    # Public listing should not include review-status
    listed = httpx.get(f"{BASE}/opportunities", timeout=15).json()
    assert all(o.get("status") in ("open", "funded", "active") for o in listed)

    # Approve
    r2 = httpx.post(f"{BASE}/opportunities/{opp_id}/approve", headers=_auth(atoken), timeout=15)
    assert r2.status_code == 200
    assert r2.json()["status"] == "open"


def test_investor_cannot_create_opportunity():
    email = f"inv_{uuid.uuid4().hex[:8]}@example.com"
    sig = httpx.post(
        f"{BASE}/auth/signup",
        json={"full_name": "X", "email": email, "password": "Pass@1234", "role": "investor", "country": "NG"},
        timeout=15,
    ).json()
    t = sig["token"]
    r = httpx.post(
        f"{BASE}/opportunities",
        json={"title": "bad opp", "crop": "X", "summary": "not allowed aaaaaaaaaaa", "region": "Lagos",
              "duration_months": 3, "funding_target": 1000, "min_ticket": 100, "target_return_pct": 10, "risk_band": "A"},
        headers=_auth(t),
        timeout=15,
    )
    assert r.status_code == 403


def test_investor_invest_flow_and_portfolio_summary():
    # Use demo investor (seeded with 2M balance)
    token = _login("investor@agriflow.ng", "Invest@123")

    # Find an open opportunity
    opps = httpx.get(f"{BASE}/opportunities", timeout=15).json()
    assert opps, "need at least one open opp"
    open_opp = next((o for o in opps if o["status"] == "open" and (o["funding_target"] - o["funding_raised"]) > o["min_ticket"]), None)
    if not open_opp:
        import pytest
        pytest.skip("no capacity in any open opportunity")

    r = httpx.post(
        f"{BASE}/opportunities/{open_opp['id']}/invest",
        json={"amount": open_opp["min_ticket"]},
        headers=_auth(token),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["amount"] == open_opp["min_ticket"]
    assert inv["expected_payout"] > inv["amount"]

    summary = httpx.get(f"{BASE}/investments/summary", headers=_auth(token), timeout=15).json()
    assert summary["total_invested"] >= open_opp["min_ticket"]
    assert summary["active_count"] >= 1
