"""
Phase L backend tests:
- /api/opportunities/{id}/similar (NEW endpoint)
- Regression: /api/opportunities, /api/opportunities/{id},
  /api/investments/summary, /api/stats/landing-pulse
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
INVESTOR_EMAIL = "investor@agriflow.ng"
INVESTOR_PASSWORD = "Invest@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def investor_session(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": INVESTOR_EMAIL, "password": INVESTOR_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    # also propagate any cookie
    for c in session.cookies:
        s.cookies.set(c.name, c.value)
    return s


@pytest.fixture(scope="module")
def opportunities(session):
    r = session.get(f"{BASE_URL}/api/opportunities", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("items") if isinstance(body, dict) else body
    assert isinstance(items, list) and len(items) > 0, "no opportunities seeded"
    return items


# ---------- Regression ----------

class TestRegression:
    def test_opportunities_list(self, opportunities):
        first = opportunities[0]
        assert "id" in first
        assert "crop" in first
        assert "_id" not in first  # no Mongo ObjectId leak

    def test_opportunity_detail(self, session, opportunities):
        oid = opportunities[0]["id"]
        r = session.get(f"{BASE_URL}/api/opportunities/{oid}", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("id") == oid
        assert "_id" not in data

    def test_investments_summary(self, investor_session):
        r = investor_session.get(f"{BASE_URL}/api/investments/summary", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Common fields - investor demo has 1.25M invested
        assert isinstance(data, dict)
        # accept either total_invested or similar key naming
        assert any(k in data for k in ("total_invested", "totalInvested", "summary"))

    def test_landing_pulse(self, session):
        r = session.get(f"{BASE_URL}/api/stats/landing-pulse", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        # at least some pulse keys present
        assert len(data) > 0


# ---------- /opportunities/{id}/similar ----------

class TestSimilarOpportunities:
    def test_similar_returns_items(self, session, opportunities):
        oid = opportunities[0]["id"]
        r = session.get(f"{BASE_URL}/api/opportunities/{oid}/similar?limit=3", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)
        assert len(body["items"]) <= 3

    def test_similar_excludes_source_id(self, session, opportunities):
        oid = opportunities[0]["id"]
        r = session.get(f"{BASE_URL}/api/opportunities/{oid}/similar?limit=3", timeout=20)
        assert r.status_code == 200
        items = r.json().get("items", [])
        for it in items:
            assert it.get("id") != oid, "source opp must be excluded"
            assert "_id" not in it

    def test_similar_respects_limit(self, session, opportunities):
        oid = opportunities[0]["id"]
        r = session.get(f"{BASE_URL}/api/opportunities/{oid}/similar?limit=1", timeout=20)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) <= 1

    def test_similar_404_for_unknown_id(self, session):
        r = session.get(f"{BASE_URL}/api/opportunities/__nope__/similar", timeout=20)
        assert r.status_code == 404

    def test_similar_ranks_crop_match_first(self, session, opportunities):
        # Find an opp whose crop appears in at least one other opp
        from collections import Counter
        crops = Counter([o.get("crop") for o in opportunities if o.get("crop")])
        target = next(((o for o in opportunities if crops[o.get("crop")] > 1)), None)
        if not target:
            pytest.skip("No duplicate-crop opportunities to validate ranking")
        r = session.get(
            f"{BASE_URL}/api/opportunities/{target['id']}/similar?limit=3",
            timeout=20,
        )
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 1
        # First result should be crop OR region match (highest score)
        first = items[0]
        assert (
            first.get("crop") == target.get("crop")
            or first.get("region") == target.get("region")
        ), f"top similar should match crop/region, got {first.get('crop')}/{first.get('region')} vs {target.get('crop')}/{target.get('region')}"
