"""AGRIOS Phase D pytest suite — scale + moat endpoints.

Covers: liquidity signals, supplier performance, farmer earnings, price alerts
(+auto-trigger), market intel v2, growth invite, admin KPIs and regression.
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "buyer": {"email": "buyer@agriflow.ng", "password": "Buyer@123"},
    "farmer": {"email": "farmer@agriflow.ng", "password": "Farmer@123"},
    "admin": {"email": "admin@agriflow.ng", "password": "Admin@12345"},
}


def _login(role: str) -> str:
    r = requests.post(f"{API}/auth/login", json=CREDS[role], timeout=30)
    assert r.status_code == 200, f"{role} login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def tokens():
    return {r: _login(r) for r in ("buyer", "farmer", "admin")}


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- Regression ----------------

class TestRegression:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200

    def test_config_public(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "providers" in d or "app" in d

    def test_listings_public(self):
        r = requests.get(f"{API}/listings", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_admin_reconcile_still_works(self, tokens):
        r = requests.get(f"{API}/admin/reconcile", headers=_h(tokens["admin"]), timeout=30)
        assert r.status_code == 200

    def test_admin_reconcile_forbidden_for_buyer(self, tokens):
        r = requests.get(f"{API}/admin/reconcile", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 403


# ---------------- 1. Liquidity Signals ----------------

class TestLiquiditySignals:
    def test_liquidity_for_seeded_listing(self):
        lst = requests.get(f"{API}/listings", timeout=15).json()
        items = lst if isinstance(lst, list) else lst.get("items", [])
        assert items, "Need at least one seeded listing"
        lid = items[0]["id"]
        r = requests.get(f"{API}/liquidity/listing/{lid}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("recent_viewers", "views_total", "saves_total",
                  "orders_completed_this_week", "active_suppliers", "suppliers_in_country"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["recent_viewers"], int)
        assert d["recent_viewers"] >= 1

    def test_liquidity_missing_404(self):
        r = requests.get(f"{API}/liquidity/listing/does-not-exist-xyz", timeout=15)
        assert r.status_code == 404


# ---------------- 2. Supplier Performance ----------------

class TestSupplierPerformance:
    def test_farmer_score(self, tokens):
        me = requests.get(f"{API}/auth/me", headers=_h(tokens["farmer"]), timeout=15).json()
        fid = me.get("id") or me.get("user", {}).get("id")
        assert fid, me
        r = requests.get(f"{API}/suppliers/{fid}/performance", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert 0 <= d["score"] <= 100
        assert d["band"] in ("A", "B", "C", "D")
        assert isinstance(d["badges"], list)
        assert isinstance(d["metrics"], dict)
        assert isinstance(d["best_crops"], list)

    def test_non_farmer_404(self, tokens):
        me = requests.get(f"{API}/auth/me", headers=_h(tokens["buyer"]), timeout=15).json()
        bid = me.get("id") or me.get("user", {}).get("id")
        r = requests.get(f"{API}/suppliers/{bid}/performance", timeout=15)
        assert r.status_code == 404


# ---------------- 3. Farmer Earnings ----------------

class TestFarmerEarnings:
    def test_earnings_farmer(self, tokens):
        r = requests.get(f"{API}/farmer/earnings", headers=_h(tokens["farmer"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("weekly_series", "best_crops", "best_regions",
                  "repeat_buyers", "total_gmv", "period_days"):
            assert k in d, f"missing {k}"
        assert isinstance(d["weekly_series"], list)
        assert isinstance(d["best_crops"], list)

    def test_earnings_buyer_forbidden(self, tokens):
        r = requests.get(f"{API}/farmer/earnings", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 403


# ---------------- 4. Price Alerts ----------------

class TestPriceAlerts:
    created_ids: list[str] = []

    def test_farmer_create_forbidden(self, tokens):
        payload = {"crop": "TEST_Cassava", "max_price_per_kg": 100}
        r = requests.post(f"{API}/alerts/price", headers=_h(tokens["farmer"]), json=payload, timeout=15)
        assert r.status_code == 403

    def test_buyer_create_list_delete(self, tokens):
        payload = {"crop": "TEST_Yam", "country": "NG", "max_price_per_kg": 1234,
                   "min_quantity_kg": 10, "notify_channel": "in_app"}
        r = requests.post(f"{API}/alerts/price", headers=_h(tokens["buyer"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["crop"] == "TEST_Yam"
        assert d["active"] is True
        aid = d["id"]
        TestPriceAlerts.created_ids.append(aid)

        # list
        r = requests.get(f"{API}/alerts/price", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert aid in ids

        # delete
        r = requests.delete(f"{API}/alerts/price/{aid}", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # delete again -> 404
        r = requests.delete(f"{API}/alerts/price/{aid}", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 404

    def test_alert_auto_triggers_on_matching_listing(self, tokens):
        # Create a buyer alert for Tomato with very high max price
        unique_crop = "Tomato"
        payload = {"crop": unique_crop, "country": "NG",
                   "max_price_per_kg": 9999, "min_quantity_kg": 0}
        r = requests.post(f"{API}/alerts/price", headers=_h(tokens["buyer"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        alert = r.json()
        aid = alert["id"]
        TestPriceAlerts.created_ids.append(aid)

        # Snapshot notifications count BEFORE
        notif_before = requests.get(f"{API}/notifications", headers=_h(tokens["buyer"]), timeout=15)
        assert notif_before.status_code == 200
        before = notif_before.json()
        before_list = before if isinstance(before, list) else before.get("items", [])
        before_price_alerts = [n for n in before_list if n.get("kind") == "price_alert"]

        # Farmer posts a Tomato listing at price < 9999
        unique = uuid.uuid4().hex[:8]
        listing_payload = {
            "crop": unique_crop,
            "variety": "Roma",
            "price_per_kg": 500,
            "qty_available_kg": 200,
            "quantity_kg": 200,
            "country": "NG",
            "location": f"Lagos TEST_{unique}",
            "description": f"Phase D test {unique}",
            "unit": "kg",
        }
        r = requests.post(f"{API}/listings", headers=_h(tokens["farmer"]), json=listing_payload, timeout=30)
        assert r.status_code in (200, 201), f"create listing failed: {r.status_code} {r.text}"
        new_listing = r.json()
        new_lid = new_listing.get("id")
        assert new_lid

        # Give the async notify a moment
        time.sleep(1.0)

        # Check notifications AFTER
        notif_after = requests.get(f"{API}/notifications", headers=_h(tokens["buyer"]), timeout=15)
        assert notif_after.status_code == 200
        after = notif_after.json()
        after_list = after if isinstance(after, list) else after.get("items", [])
        after_price_alerts = [n for n in after_list if n.get("kind") == "price_alert"]
        assert len(after_price_alerts) > len(before_price_alerts), (
            f"Expected a new price_alert notification. before={len(before_price_alerts)} after={len(after_price_alerts)}"
        )

        # Verify alert.triggered_count incremented
        alerts = requests.get(f"{API}/alerts/price", headers=_h(tokens["buyer"]), timeout=15).json()
        mine = next((a for a in alerts if a["id"] == aid), None)
        assert mine, "alert disappeared"
        assert mine.get("triggered_count", 0) >= 1, f"triggered_count not incremented: {mine}"

        # cleanup alert
        requests.delete(f"{API}/alerts/price/{aid}", headers=_h(tokens["buyer"]), timeout=15)


# ---------------- 5. Market Intel v2 ----------------

class TestMarketIntel:
    def test_price_trend(self):
        r = requests.get(f"{API}/market/price-trend", params={"crop": "Tomato", "days": 90}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "series" in d and isinstance(d["series"], list)
        assert "snapshot" in d and isinstance(d["snapshot"], dict)
        assert "wow_pct" in d  # may be None for old seed data

    def test_demand_heatmap(self):
        r = requests.get(f"{API}/market/demand-heatmap", params={"days": 60}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("rows", "crops", "regions", "max_gmv"):
            assert k in d, f"missing {k}"
        assert isinstance(d["rows"], list)
        assert isinstance(d["crops"], list)
        assert isinstance(d["regions"], list)


# ---------------- 6. Growth + Admin KPIs ----------------

class TestGrowthAndKpis:
    def test_invite_buyer(self, tokens):
        r = requests.get(f"{API}/growth/invite", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("code", "link", "referred_count", "whatsapp_text"):
            assert k in d

    def test_invite_farmer(self, tokens):
        r = requests.get(f"{API}/growth/invite", headers=_h(tokens["farmer"]), timeout=15)
        assert r.status_code == 200

    def test_admin_kpis(self, tokens):
        r = requests.get(f"{API}/admin/kpis", headers=_h(tokens["admin"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("gmv_7d", "gmv_30d", "escrow_locked", "repeat_buyers",
                  "loan_volume", "price_alerts_active"):
            assert k in d, f"missing {k}"

    def test_admin_kpis_forbidden_for_buyer(self, tokens):
        r = requests.get(f"{API}/admin/kpis", headers=_h(tokens["buyer"]), timeout=15)
        assert r.status_code == 403
