"""AGRIOS Phase I — Google OAuth session + Onboarding state endpoints.

Covers:
- POST /api/auth/signup creates user with onboarding_step=1 (via subsequent /auth/me + onboarding/state)
- GET /api/onboarding/state (authenticated) returns shape {step,total_steps,percent,role,profile,kyc_status,verified}
- PATCH /api/onboarding/profile bumps step 1 -> 2 and persists fields
- POST /api/onboarding/advance bumps step by 1, caps at 5
- POST /api/onboarding/complete sets step=5
- POST /api/auth/google/session rejects bad session_id with 401
- POST /api/auth/logout returns {ok:true}
- Regression: admin login + /auth/me still work, no onboarding redirect (step==0/missing)
"""
import os
import uuid
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    # Try env first
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v
    # Fallback: parse frontend/.env
    envf = Path("/app/frontend/.env")
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return ""


BASE_URL = _load_backend_url().rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"


# ---------------- helpers ----------------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def new_investor(api_client):
    """Create a fresh investor via /auth/signup; return (token, user, email)."""
    email = f"test_phase_i_{uuid.uuid4().hex[:10]}@agritest.com"
    payload = {
        "email": email,
        "password": "Invest@123",
        "full_name": "Phase I Tester",
        "role": "investor",
        "phone": "+2348000000000",
        "country": "NG",
    }
    r = api_client.post(f"{API}/auth/signup", json=payload)
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"signup returned no token: {data}"
    return {"token": token, "user": data.get("user") or {}, "email": email}


@pytest.fixture(scope="module")
def auth_headers(new_investor):
    return {"Authorization": f"Bearer {new_investor['token']}"}


@pytest.fixture(scope="module")
def admin_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": "admin@agriflow.ng", "password": "Admin@12345"
    })
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code}")
    return r.json().get("token")


# ---------------- signup onboarding_step ----------------
class TestSignupOnboardingStep:
    def test_signup_sets_onboarding_step_1_via_state(self, api_client, auth_headers):
        r = api_client.get(f"{API}/onboarding/state", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["step"] == 1, f"new signup should start at step 1, got {data}"
        assert data["total_steps"] == 5
        assert data["role"] == "investor"
        assert "profile" in data
        assert "kyc_status" in data
        assert "verified" in data
        assert data["percent"] == 20


# ---------------- onboarding profile ----------------
class TestOnboardingProfile:
    def test_patch_profile_returns_saved_and_bumps_step(self, api_client, auth_headers):
        r = api_client.patch(
            f"{API}/onboarding/profile",
            headers=auth_headers,
            json={"investment_goal": "passive_income", "risk_preference": "medium"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "saved" in data
        assert "investment_goal" in data["saved"]
        assert "risk_preference" in data["saved"]

        # Verify step bumped to 2 and fields persisted
        r2 = api_client.get(f"{API}/onboarding/state", headers=auth_headers)
        assert r2.status_code == 200
        st = r2.json()
        assert st["step"] == 2
        assert st["profile"]["investment_goal"] == "passive_income"
        assert st["profile"]["risk_preference"] == "medium"


# ---------------- onboarding advance ----------------
class TestOnboardingAdvance:
    def test_advance_bumps_step(self, api_client, auth_headers):
        # currently at step 2
        r = api_client.post(f"{API}/onboarding/advance", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == {"ok": True, "step": 3}

        r = api_client.post(f"{API}/onboarding/advance", headers=auth_headers)
        assert r.json()["step"] == 4
        r = api_client.post(f"{API}/onboarding/advance", headers=auth_headers)
        assert r.json()["step"] == 5
        # Caps at 5
        r = api_client.post(f"{API}/onboarding/advance", headers=auth_headers)
        assert r.json()["step"] == 5


# ---------------- onboarding complete ----------------
class TestOnboardingComplete:
    def test_complete_sets_step_5(self, api_client, auth_headers):
        r = api_client.post(f"{API}/onboarding/complete", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == {"ok": True, "step": 5}

        # Verify state
        r2 = api_client.get(f"{API}/onboarding/state", headers=auth_headers)
        assert r2.json()["step"] == 5
        assert r2.json()["percent"] == 100


# ---------------- Google OAuth session rejection ----------------
class TestGoogleOAuth:
    def test_invalid_session_id_returns_401(self, api_client):
        r = api_client.post(
            f"{API}/auth/google/session",
            json={"session_id": "invalid_fake_session_id_xxxxxxx", "role": "investor"},
        )
        # Could be 401 (invalid) or 502 if provider unreachable; doc says 401
        assert r.status_code in (401, 502), f"got {r.status_code}: {r.text}"
        if r.status_code == 401:
            body = r.json()
            detail = body.get("detail", "")
            assert "Invalid" in detail or "expired" in detail or "Google" in detail

    def test_logout_returns_ok(self, api_client):
        r = api_client.post(f"{API}/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------------- Regression: existing admin unaffected ----------------
class TestAdminRegression:
    def test_admin_me_works(self, api_client, admin_token):
        r = api_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        me = r.json()
        assert me.get("email") == "admin@agriflow.ng"
        assert me.get("role") == "admin"

    def test_admin_onboarding_state_step_is_zero_or_missing(self, api_client, admin_token):
        r = api_client.get(
            f"{API}/onboarding/state",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        st = r.json()
        # Existing admin has no onboarding_step field → endpoint defaults to 0
        assert st["step"] == 0, f"admin should not be redirected to onboarding: {st}"

    def test_investor_login_still_works(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": "investor@agriflow.ng", "password": "Invest@123"
        })
        assert r.status_code == 200
        assert r.json().get("token")
