"""Phase G — Health probes, opportunity hydration, admin verify, regression."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
INTERNAL = "http://localhost:8001"

INVESTOR = {"email": "investor@agriflow.ng", "password": "Invest@123"}
ADMIN = {"email": "admin@agriflow.ng", "password": "Admin@12345"}
FARMER = {"email": "farmer@agriflow.ng", "password": "Farmer@123"}


def _login(creds):
    r = requests.post(f"{BASE}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def investor_token():
    return _login(INVESTOR)


# === Health probes ===
class TestHealth:
    def test_healthz_internal(self):
        r = requests.get(f"{INTERNAL}/healthz", timeout=5)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert d.get("service") == "agrios-api"

    def test_health_internal(self):
        r = requests.get(f"{INTERNAL}/health", timeout=5)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert d.get("service") == "agrios-api"

    def test_api_health(self):
        r = requests.get(f"{BASE}/api/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert "ts" in d or "timestamp" in d


# === Opportunity hydration ===
class TestOpportunityHydration:
    def test_list_opportunities(self):
        r = requests.get(f"{BASE}/api/opportunities", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("opportunities") or []
        assert len(items) > 0, f"no opportunities seeded: {data}"
        TestOpportunityHydration.first_id = items[0].get("id") or items[0].get("_id")
        assert TestOpportunityHydration.first_id

    def test_get_opportunity_hydrated(self):
        opp_id = TestOpportunityHydration.first_id
        r = requests.get(f"{BASE}/api/opportunities/{opp_id}", timeout=15)
        assert r.status_code == 200, r.text
        opp = r.json()
        # Hydrated fields
        assert "farm_updates" in opp, f"missing farm_updates: keys={list(opp.keys())}"
        assert isinstance(opp["farm_updates"], list)
        assert "risk_factors" in opp
        assert isinstance(opp["risk_factors"], list)
        if opp["risk_factors"]:
            rf = opp["risk_factors"][0]
            # must contain at least one expected key
            assert any(k in rf for k in ("type", "level", "note", "label", "severity"))
        assert "use_of_funds_breakdown" in opp
        assert isinstance(opp["use_of_funds_breakdown"], list)
        if opp["use_of_funds_breakdown"]:
            uf = opp["use_of_funds_breakdown"][0]
            assert any(k in uf for k in ("label", "amount", "name", "value"))


# === Admin verify endpoint ===
class TestAdminVerify:
    def test_verify_farmer_toggle(self, admin_token):
        # find a farmer user
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE}/api/admin/users", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        users = data if isinstance(data, list) else data.get("items") or data.get("users") or []
        farmers = [u for u in users if u.get("role") == "farmer"]
        assert farmers, "no farmer users found"
        target = farmers[0]
        uid = target.get("id") or target.get("_id")
        # set verified=true
        r1 = requests.post(
            f"{BASE}/api/admin/users/{uid}/verify",
            headers=headers,
            json={"verified": True},
            timeout=15,
        )
        assert r1.status_code in (200, 204), f"verify=true: {r1.status_code} {r1.text}"
        # set verified=false
        r2 = requests.post(
            f"{BASE}/api/admin/users/{uid}/verify",
            headers=headers,
            json={"verified": False},
            timeout=15,
        )
        assert r2.status_code in (200, 204), f"verify=false: {r2.status_code} {r2.text}"
        # confirm via list
        r3 = requests.get(f"{BASE}/api/admin/users", headers=headers, timeout=15)
        users3 = r3.json() if isinstance(r3.json(), list) else r3.json().get("items") or r3.json().get("users") or []
        match = next((u for u in users3 if (u.get("id") or u.get("_id")) == uid), None)
        assert match is not None
        assert match.get("verified") is False
        # restore to true for downstream tests
        requests.post(
            f"{BASE}/api/admin/users/{uid}/verify",
            headers=headers,
            json={"verified": True},
            timeout=15,
        )


# === Regression Phase D/F endpoints ===
class TestRegression:
    def test_get_opportunities(self):
        r = requests.get(f"{BASE}/api/opportunities", timeout=15)
        assert r.status_code == 200

    def test_investments_summary(self, investor_token):
        h = {"Authorization": f"Bearer {investor_token}"}
        r = requests.get(f"{BASE}/api/investments/summary", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, dict)

    def test_market_price_trend(self):
        r = requests.get(f"{BASE}/api/market/price-trend", params={"crop": "Tomato"}, timeout=15)
        assert r.status_code == 200

    def test_liquidity_listing(self):
        # find a listing id
        r = requests.get(f"{BASE}/api/listings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("listings") or []
        if not items:
            pytest.skip("no listings seeded")
        lid = items[0].get("id") or items[0].get("_id")
        r2 = requests.get(f"{BASE}/api/liquidity/listing/{lid}", timeout=15)
        assert r2.status_code == 200, r2.text
