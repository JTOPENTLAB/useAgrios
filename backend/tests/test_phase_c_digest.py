"""
Phase C regression tests — AGRIOS Market Pulse (weekly digest).
Covers:
  GET /api/digest/preview (buyer + farmer)
  GET /api/digest/prefs
  PUT /api/digest/prefs
  POST /api/digest/send-me-now
  POST /api/digest/trigger (admin only, 403 for non-admin)
  GET /api/digest/log (admin only)
  TEST_ crop exclusion in hot_crops/suppliers/new_listings
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

BUYER = ("buyer@agriflow.ng", "Buyer@123")
FARMER = ("farmer@agriflow.ng", "Farmer@123")
ADMIN = ("admin@agriflow.ng", "Admin@12345")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def buyer_token():
    return _login(*BUYER)


@pytest.fixture(scope="session")
def farmer_token():
    return _login(*FARMER)


@pytest.fixture(scope="session")
def admin_token():
    return _login(*ADMIN)


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- digest/preview ----------------

class TestDigestPreview:
    REQUIRED_KEYS = {
        "user_id", "role", "country", "currency", "name", "period",
        "generated_at", "headline", "cta_text", "cta_url",
        "hot_crops", "suppliers", "price_guidance", "suggest_crops",
        "new_listings", "whatsapp_text", "html",
    }

    def test_preview_requires_auth(self):
        r = requests.get(f"{API}/digest/preview", timeout=30)
        assert r.status_code in (401, 403), f"expected auth required, got {r.status_code}"

    def test_preview_buyer_shape(self, buyer_token):
        r = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        missing = self.REQUIRED_KEYS - set(data.keys())
        assert not missing, f"missing keys: {missing}"

        # period shape
        for k in ("start", "end", "label"):
            assert k in data["period"], f"period missing {k}"

        # types
        assert isinstance(data["headline"], str) and len(data["headline"]) > 0
        assert isinstance(data["whatsapp_text"], str) and len(data["whatsapp_text"]) > 0
        assert isinstance(data["html"], str)
        assert len(data["html"]) > 1000, f"html too small: {len(data['html'])}"
        assert "AGRIOS" in data["html"]
        assert data["role"] == "buyer"

    def test_preview_farmer_shape(self, farmer_token):
        r = requests.get(f"{API}/digest/preview", headers=_h(farmer_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "farmer"
        assert isinstance(data["suggest_crops"], list)
        assert isinstance(data["price_guidance"], list)
        assert "AGRIOS" in data["html"]

    def test_headline_differs_by_role(self, buyer_token, farmer_token):
        b = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()
        f = requests.get(f"{API}/digest/preview", headers=_h(farmer_token), timeout=30).json()
        buyer_expected = any(p in b["headline"] for p in ("Lock in", "Your weekly market pulse"))
        farmer_expected = any(
            p in f["headline"]
            for p in ("List ", "room to raise", "Weekly pulse", "hungry for")
        )
        assert buyer_expected, f"buyer headline unexpected: {b['headline']}"
        assert farmer_expected, f"farmer headline unexpected: {f['headline']}"

    def test_excludes_test_prefixed_crops(self, buyer_token):
        r = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30)
        data = r.json()
        for h in data.get("hot_crops", []):
            assert not h["crop"].upper().startswith("TEST_"), f"TEST_ crop leaked: {h['crop']}"
        for s in data.get("suppliers", []):
            assert not str(s.get("latest_crop", "")).upper().startswith("TEST_")
        for n in data.get("new_listings", []):
            assert not n["crop"].upper().startswith("TEST_")


# ---------------- digest/prefs ----------------

class TestDigestPrefs:
    def test_get_prefs_default(self, buyer_token):
        r = requests.get(f"{API}/digest/prefs", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "email" in data and isinstance(data["email"], bool)
        assert data.get("frequency") == "weekly"

    def test_put_prefs_persists(self, buyer_token):
        # Disable
        r = requests.put(
            f"{API}/digest/prefs",
            headers=_h(buyer_token),
            json={"email": False},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["email"] is False

        r2 = requests.get(f"{API}/digest/prefs", headers=_h(buyer_token), timeout=30)
        assert r2.json()["email"] is False

        # Restore to true
        r3 = requests.put(
            f"{API}/digest/prefs",
            headers=_h(buyer_token),
            json={"email": True},
            timeout=30,
        )
        assert r3.status_code == 200
        assert r3.json()["email"] is True


# ---------------- digest/send-me-now ----------------

class TestSendMeNow:
    def test_send_me_now_mock(self, buyer_token):
        r = requests.post(f"{API}/digest/send-me-now", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "dispatch" in data
        assert data["dispatch"]["provider"] in ("mock", "resend")
        if data["dispatch"]["provider"] == "mock":
            assert data["dispatch"]["status"] == "logged"
        assert isinstance(data.get("whatsapp_text"), str)
        assert data.get("whatsapp_url", "").startswith("https://wa.me/?text=")

    def test_send_me_now_log_entry(self, buyer_token, admin_token):
        # write a log entry
        requests.post(f"{API}/digest/send-me-now", headers=_h(buyer_token), timeout=30)
        r = requests.get(f"{API}/digest/log?limit=10", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        # verify sort desc by sent_at
        if len(rows) >= 2:
            assert rows[0]["sent_at"] >= rows[1]["sent_at"]
        entry = rows[0]
        for k in ("to", "subject", "html_bytes", "sent_at", "provider", "status", "meta"):
            assert k in entry, f"log entry missing {k}"


# ---------------- digest/trigger admin ----------------

class TestDigestTrigger:
    def test_trigger_non_admin_forbidden(self, buyer_token):
        r = requests.post(f"{API}/digest/trigger", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_trigger_admin_success(self, admin_token):
        r = requests.post(f"{API}/digest/trigger", headers=_h(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("sent", "failed", "total_users", "reason", "ran_at"):
            assert k in data
        assert data["reason"] == "admin-trigger"
        # ran_at ISO
        assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", data["ran_at"])
        # mock path: sent should equal total_users (no real send fails)
        assert data["sent"] + data["failed"] == data["total_users"]
        # Since we have RESEND_API_KEY unset -> all mock -> sent == total
        assert data["failed"] == 0, f"unexpected failures: {data}"
        assert data["sent"] == data["total_users"], f"sent {data['sent']} != total {data['total_users']}"


# ---------------- digest/log access ----------------

class TestDigestLogAccess:
    def test_log_non_admin_forbidden(self, buyer_token):
        r = requests.get(f"{API}/digest/log", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 403
