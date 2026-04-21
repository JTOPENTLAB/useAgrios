"""
Phase D tests — /api/config, richer digest payload, subject rotation,
role-specific WhatsApp text, plain-text alternate logging.
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


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
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


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ------------- /api/config -------------

class TestConfig:
    def test_config_unauth_ok(self):
        r = requests.get(f"{API}/config", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # app
        assert d["app"]["name"] == "AGRIOS"
        assert "env" in d["app"] and "site_url" in d["app"] and "support_email" in d["app"]
        # country
        assert d["country"]["default"] == "NG"
        assert set(d["country"]["supported"]) == {"NG", "GH", "KE", "CI"}
        assert set(d["country"]["currencies"]) == {"NGN", "GHS", "KES", "XOF"}
        # providers
        assert d["providers"]["email"]["configured"] == "mock"
        assert d["providers"]["email"]["effective"] == "mock"
        assert d["providers"]["whatsapp"]["configured"] == "share_only"
        assert d["providers"]["payment"]["effective"] == "mock"
        # features
        for flag in ("market_pulse", "whatsapp_share", "email_digest", "real_payments",
                     "real_whatsapp_push", "loans", "escrow", "video_promotion", "hot_demand"):
            assert flag in d["features"], f"missing flag {flag}"
        # market_pulse
        assert "timezone" in d["market_pulse"]
        assert "cron_hour_utc" in d["market_pulse"]
        assert d["market_pulse"]["dormant_days"] == 30


# ------------- digest preview richer payload -------------

class TestDigestPreviewRich:
    def test_buyer_payload_shape(self, buyer_token):
        r = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        required = {"subject", "html", "text", "regional_snapshot", "new_suppliers",
                    "price_guidance_delta", "active_buyers", "is_dormant", "whatsapp_text"}
        missing = required - set(d.keys())
        assert not missing, f"missing keys: {missing}"
        assert isinstance(d["subject"], str) and len(d["subject"]) > 0
        assert len(d["html"]) > 2000
        assert "AGRIOS" in d["html"]
        assert len(d["text"]) > 200
        assert isinstance(d["regional_snapshot"], list)
        assert isinstance(d["new_suppliers"], list)
        assert isinstance(d["price_guidance_delta"], list)
        assert isinstance(d["active_buyers"], int)
        assert d["is_dormant"] is False  # fresh test user
        assert "AGRIOS Market Pulse" in d["whatsapp_text"]

    def test_regional_snapshot_entries_shape(self, buyer_token):
        d = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()
        for r in d["regional_snapshot"]:
            for k in ("region", "crop", "price_min", "price_max", "currency", "listings"):
                assert k in r, f"missing {k} in regional snapshot entry"

    def test_new_suppliers_entries_shape(self, buyer_token):
        d = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()
        for s in d["new_suppliers"]:
            for k in ("id", "name", "location", "listings", "crops", "headline_crop"):
                assert k in s, f"missing {k} in supplier entry"


# ------------- subject rotation determinism -------------

class TestSubjectRotation:
    def test_subject_stable_per_user(self, buyer_token):
        s1 = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()["subject"]
        s2 = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()["subject"]
        assert s1 == s2, f"subject not stable: {s1} vs {s2}"

    def test_subject_variant_one_of_three(self, buyer_token, farmer_token):
        bs = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()["subject"]
        fs = requests.get(f"{API}/digest/preview", headers=_h(farmer_token), timeout=30).json()["subject"]
        # buyer variants
        buyer_match = any(p in bs for p in (
            "AGRIOS Market Pulse", "This Week's AGRIOS Market Pulse", "Top Demand This Week"
        ))
        farmer_match = any(p in fs for p in (
            "AGRIOS Market Pulse", "This Week's AGRIOS Market Pulse", "Your Market Pulse"
        ))
        assert buyer_match, f"buyer subject unexpected: {bs}"
        assert farmer_match, f"farmer subject unexpected: {fs}"


# ------------- role-specific whatsapp text -------------

class TestWhatsAppRoleVariants:
    def test_buyer_wa_text(self, buyer_token):
        d = requests.get(f"{API}/digest/preview", headers=_h(buyer_token), timeout=30).json()
        txt = d["whatsapp_text"]
        assert any(p in txt for p in ("demand is up", "new verified suppliers posted", "trending at")), \
            f"buyer wa missing expected phrase: {txt}"
        assert txt.rstrip().endswith("— AGRIOS, Operating System for Agricultural Trade")

    def test_farmer_wa_text(self, farmer_token):
        d = requests.get(f"{API}/digest/preview", headers=_h(farmer_token), timeout=30).json()
        txt = d["whatsapp_text"]
        assert any(p in txt for p in ("List ", "guidance is up", "verified buyers were active")), \
            f"farmer wa missing expected phrase: {txt}"
        assert txt.rstrip().endswith("— AGRIOS, Operating System for Agricultural Trade")


# ------------- send-me-now + log text_bytes -------------

class TestSendMeNowTextBytes:
    def test_send_me_now_logs_text_bytes(self, buyer_token, admin_token):
        r = requests.post(f"{API}/digest/send-me-now", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        rows = requests.get(f"{API}/digest/log?limit=5", headers=_h(admin_token), timeout=30).json()
        assert isinstance(rows, list) and len(rows) > 0
        latest = rows[0]
        assert "text_bytes" in latest, f"log missing text_bytes: {latest}"
        assert isinstance(latest["text_bytes"], int)
        assert latest["text_bytes"] > 200


# ------------- admin trigger still works -------------

class TestAdminTriggerStillWorks:
    def test_trigger_admin(self, admin_token):
        r = requests.post(f"{API}/digest/trigger", headers=_h(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("sent", "failed", "total_users"):
            assert k in d
        assert d["sent"] + d["failed"] == d["total_users"]


# ------------- regression smoke -------------

class TestRegressionSmoke:
    def test_hot_demand(self, buyer_token):
        r = requests.get(f"{API}/insights/hot-demand", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200

    def test_featured_suppliers(self, buyer_token):
        r = requests.get(f"{API}/insights/featured-suppliers", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200

    def test_rec_for_farmer(self, farmer_token):
        r = requests.get(f"{API}/recommendations/for-farmer", headers=_h(farmer_token), timeout=30)
        assert r.status_code == 200

    def test_rec_for_buyer(self, buyer_token):
        r = requests.get(f"{API}/recommendations/for-buyer", headers=_h(buyer_token), timeout=30)
        assert r.status_code == 200

    def test_rec_for_product(self, buyer_token):
        # find any active listing id first
        r = requests.get(f"{API}/listings", timeout=30)
        assert r.status_code == 200
        listings = r.json()
        if not listings:
            pytest.skip("no listings seeded")
        lid = listings[0].get("id")
        r2 = requests.get(f"{API}/recommendations/product/{lid}", headers=_h(buyer_token), timeout=30)
        assert r2.status_code == 200
