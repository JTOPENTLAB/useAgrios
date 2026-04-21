"""
Phase A + Phase B regression tests — AGRIOS iteration 5.
Covers:
  /api/insights/hot-demand
  /api/insights/featured-suppliers
  /api/recommendations/product/{id}
  /api/recommendations/for-farmer  (farmer auth)
  /api/recommendations/for-buyer   (buyer auth)
  Landing headline / meta title
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

BUYER = ("buyer@agriflow.ng", "Buyer@123")
FARMER = ("farmer@agriflow.ng", "Farmer@123")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def buyer_token():
    return _login(*BUYER)


@pytest.fixture(scope="session")
def farmer_token():
    return _login(*FARMER)


@pytest.fixture(scope="session")
def any_listing_id():
    r = requests.get(f"{API}/listings", timeout=20)
    assert r.status_code == 200
    listings = r.json()
    assert len(listings) > 0
    # pick one that is not TEST_ prefixed
    for l in listings:
        if not l.get("crop", "").upper().startswith("TEST_"):
            return l["id"]
    return listings[0]["id"]


# ---------- /api/insights/hot-demand ----------
class TestHotDemand:
    def test_hot_demand_status(self):
        r = requests.get(f"{API}/insights/hot-demand", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "hot-demand should return at least one tile (fallback to listings)"

    def test_hot_demand_schema(self):
        data = requests.get(f"{API}/insights/hot-demand", timeout=20).json()
        required = {"crop", "orders", "gmv", "currency", "pct_change", "price_min", "price_max", "signal"}
        for item in data:
            missing = required - set(item.keys())
            assert not missing, f"Missing keys {missing} in item {item}"
            assert item["signal"] in ("high", "moderate"), f"bad signal: {item['signal']}"

    def test_hot_demand_filters_test_crops(self):
        data = requests.get(f"{API}/insights/hot-demand", timeout=20).json()
        for item in data:
            assert not item["crop"].upper().startswith("TEST_"), f"TEST_ crop leaked: {item['crop']}"


# ---------- /api/insights/featured-suppliers ----------
class TestFeaturedSuppliers:
    def test_status_and_structure(self):
        r = requests.get(f"{API}/insights/featured-suppliers", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # At least the seeded farmer should be verified
        assert len(data) >= 1

    def test_supplier_schema(self):
        data = requests.get(f"{API}/insights/featured-suppliers", timeout=20).json()
        required = {"id", "name", "location", "country", "verified",
                    "completed_orders", "rating", "rating_count", "featured_crop"}
        for s in data:
            missing = required - set(s.keys())
            assert not missing, f"Missing keys {missing}"
            assert s["verified"] is True
            if s.get("featured_crop"):
                assert not s["featured_crop"].upper().startswith("TEST_"), \
                    f"TEST_ crop leaked as featured_crop: {s['featured_crop']}"

    def test_sorted_by_completed_then_rating(self):
        data = requests.get(f"{API}/insights/featured-suppliers", timeout=20).json()
        if len(data) < 2:
            pytest.skip("Need >=2 suppliers to check sort order")
        for i in range(len(data) - 1):
            a, b = data[i], data[i + 1]
            assert (a["completed_orders"], a["rating"]) >= (b["completed_orders"], b["rating"]), \
                f"Sort order violated at index {i}: {a} vs {b}"


# ---------- /api/recommendations/product/{id} ----------
class TestProductRecommendations:
    def test_valid_id_returns_shape(self, any_listing_id):
        r = requests.get(f"{API}/recommendations/product/{any_listing_id}", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "same_crop" in data and "same_region" in data
        assert isinstance(data["same_crop"], list)
        assert isinstance(data["same_region"], list)

    def test_excludes_original_listing(self, any_listing_id):
        data = requests.get(f"{API}/recommendations/product/{any_listing_id}", timeout=20).json()
        ids = {l["id"] for l in data["same_crop"]} | {l["id"] for l in data["same_region"]}
        assert any_listing_id not in ids

    def test_invalid_id_404(self):
        r = requests.get(f"{API}/recommendations/product/does-not-exist-xyz", timeout=20)
        assert r.status_code == 404


# ---------- /api/recommendations/for-farmer ----------
class TestFarmerRecs:
    def test_requires_auth(self):
        r = requests.get(f"{API}/recommendations/for-farmer", timeout=20)
        assert r.status_code in (401, 403)

    def test_buyer_token_forbidden(self, buyer_token):
        r = requests.get(f"{API}/recommendations/for-farmer",
                         headers={"Authorization": f"Bearer {buyer_token}"}, timeout=20)
        assert r.status_code in (401, 403)

    def test_farmer_ok(self, farmer_token):
        r = requests.get(f"{API}/recommendations/for-farmer",
                         headers={"Authorization": f"Bearer {farmer_token}"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "suggest_crops" in data and "price_guidance" in data
        assert isinstance(data["suggest_crops"], list)
        assert isinstance(data["price_guidance"], list)

    def test_price_guidance_schema(self, farmer_token):
        data = requests.get(f"{API}/recommendations/for-farmer",
                            headers={"Authorization": f"Bearer {farmer_token}"}, timeout=20).json()
        for g in data["price_guidance"]:
            for k in ("crop", "your_price", "market_median", "market_p75", "suggestion"):
                assert k in g, f"Missing {k} in {g}"
            assert g["suggestion"] in ("lower", "raise", "fair")


# ---------- /api/recommendations/for-buyer ----------
class TestBuyerRecs:
    def test_requires_auth(self):
        r = requests.get(f"{API}/recommendations/for-buyer", timeout=20)
        assert r.status_code in (401, 403)

    def test_farmer_token_forbidden(self, farmer_token):
        r = requests.get(f"{API}/recommendations/for-buyer",
                         headers={"Authorization": f"Bearer {farmer_token}"}, timeout=20)
        assert r.status_code in (401, 403)

    def test_buyer_ok(self, buyer_token):
        r = requests.get(f"{API}/recommendations/for-buyer",
                         headers={"Authorization": f"Bearer {buyer_token}"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "region" in data and "similar_buyers" in data
        assert isinstance(data["region"], list)
        assert isinstance(data["similar_buyers"], list)


# ---------- Landing copy / meta ----------
class TestLandingCopy:
    def test_meta_title(self):
        r = requests.get(f"{BASE_URL}/", timeout=20)
        assert r.status_code == 200
        # meta title is in index.html (static)
        m = re.search(r"<title>(.*?)</title>", r.text, re.IGNORECASE | re.DOTALL)
        assert m, "No <title> in HTML"
        assert "Operating System for Agricultural Trade" in m.group(1), \
            f"Unexpected title: {m.group(1)!r}"
