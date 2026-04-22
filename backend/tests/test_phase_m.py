"""Phase M — Retention & reinvestment backend tests.
Covers: /investments/mine/feed, /investor/milestones, /investments/{id}/reinvest
Regression: /investments/mine, /investments/summary
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
INVESTOR_EMAIL = "investor@agriflow.ng"
INVESTOR_PASSWORD = "Invest@123"


@pytest.fixture(scope="module")
def investor_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": INVESTOR_EMAIL, "password": INVESTOR_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def investor_headers(investor_token):
    return {"Authorization": f"Bearer {investor_token}"}


@pytest.fixture(scope="module")
def investor_investments(investor_headers):
    r = requests.get(f"{BASE_URL}/api/investments/mine", headers=investor_headers)
    assert r.status_code == 200
    return r.json()


class TestPhaseMFeed:
    def test_feed_returns_items(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/investments/mine/feed", headers=investor_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) <= 50

    def test_feed_items_shape_and_sort(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/investments/mine/feed", headers=investor_headers)
        items = r.json()["items"]
        assert len(items) > 0, "Expected non-empty feed (demo investor has active cycles)"
        for it in items:
            assert "opportunity_id" in it
            assert "opportunity_title" in it
            assert "stage" in it
            assert "text" in it
            assert "created_at" in it
            assert "verified" in it
        # DESC sort
        dates = [it["created_at"] for it in items]
        assert dates == sorted(dates, reverse=True), "Feed must be sorted DESC by created_at"

    def test_feed_requires_investor(self):
        r = requests.get(f"{BASE_URL}/api/investments/mine/feed")
        assert r.status_code in (401, 403)


class TestPhaseMMilestones:
    def test_milestones_shape(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/investor/milestones", headers=investor_headers)
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data and "badges" in data and "earned_count" in data
        totals = data["totals"]
        for k in ("investments", "invested_amount", "paid_out_count", "unique_cycles"):
            assert k in totals
        assert len(data["badges"]) == 7
        ids = {b["id"] for b in data["badges"]}
        expected = {"first_invest", "three_invests", "ten_invests", "hundred_k",
                    "million", "first_payout", "diversified"}
        assert ids == expected
        for b in data["badges"]:
            assert "id" in b and "label" in b and "icon" in b and "earned" in b and "rule" in b
            assert isinstance(b["earned"], bool)

    def test_milestones_earned_count_consistent(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/investor/milestones", headers=investor_headers)
        data = r.json()
        actual = sum(1 for b in data["badges"] if b["earned"])
        assert data["earned_count"] == actual


class TestPhaseMReinvest:
    def test_reinvest_valid(self, investor_headers, investor_investments):
        # Pick any investment - prefer paid
        paid = [i for i in investor_investments if i.get("status") == "paid"]
        inv = paid[0] if paid else investor_investments[0]
        r = requests.post(f"{BASE_URL}/api/investments/{inv['id']}/reinvest",
                          headers=investor_headers, json={})
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        assert data["ok"] is True
        assert "suggested_opportunity_id" in data
        assert data["suggested_opportunity_id"]
        assert "suggested_amount" in data
        assert "note" in data
        # Defaults to inv.amount when body amount omitted
        assert float(data["suggested_amount"]) == float(inv["amount"])

    def test_reinvest_custom_amount(self, investor_headers, investor_investments):
        inv = investor_investments[0]
        r = requests.post(f"{BASE_URL}/api/investments/{inv['id']}/reinvest",
                          headers=investor_headers, json={"amount": 25000})
        assert r.status_code == 200
        data = r.json()
        assert data["suggested_amount"] == 25000

    def test_reinvest_unknown_investment_404(self, investor_headers):
        r = requests.post(f"{BASE_URL}/api/investments/nonexistent-id-xyz/reinvest",
                          headers=investor_headers, json={})
        assert r.status_code == 404

    def test_reinvest_paid_inv_returns_valid_opp(self, investor_headers, investor_investments):
        paid = [i for i in investor_investments if i.get("status") == "paid"]
        if not paid:
            pytest.skip("No paid investments to test")
        inv = paid[0]
        r = requests.post(f"{BASE_URL}/api/investments/{inv['id']}/reinvest",
                          headers=investor_headers, json={})
        assert r.status_code == 200
        sid = r.json()["suggested_opportunity_id"]
        # Verify the suggested opportunity exists and is investable
        rr = requests.get(f"{BASE_URL}/api/opportunities/{sid}")
        assert rr.status_code == 200


class TestPhaseMRegression:
    def test_investments_mine_works(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/investments/mine", headers=investor_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_investments_summary_works(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/investments/summary", headers=investor_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_invested" in data

    def test_wallet_works(self, investor_headers):
        r = requests.get(f"{BASE_URL}/api/wallet", headers=investor_headers)
        assert r.status_code == 200
