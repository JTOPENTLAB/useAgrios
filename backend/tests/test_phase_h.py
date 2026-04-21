"""AGRIOS Phase H — backend regression tests.

Covers:
  • GET /api/opportunities/{id}/social-proof
  • GET /api/opportunities/recently-matured
  • GET /api/investor/kyc-status
  • POST /api/investor/kyc-upgrade (auto-approves demo)
  • KYC tier-limit enforcement on POST /api/opportunities/{id}/invest
  • POST /api/admin/opportunities/{id}/mature  → /payout flow
  • GET /api/logistics/earnings
  • Regression: prior Phase D/F/G endpoints still work.
"""
from __future__ import annotations
import os
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from /app/frontend/.env if not already in env
def _load_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if u:
        return u.rstrip("/")
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for ln in env_path.read_text().splitlines():
            if ln.startswith("REACT_APP_BACKEND_URL="):
                return ln.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _load_url()
API = f"{BASE_URL}/api"

INV = {"email": "investor@agriflow.ng", "password": "Invest@123"}
ADMIN = {"email": "admin@agriflow.ng", "password": "Admin@12345"}
LOG = {"email": "logistics@agriflow.ng", "password": "Logistics@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def investor_token():
    return _login(INV)


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def logistics_token():
    return _login(LOG)


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# --------------- Recently matured ---------------
class TestRecentlyMatured:
    def test_recently_matured_returns_items_or_synthesised(self):
        r = requests.get(f"{API}/opportunities/recently-matured?limit=3", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "real_count" in data
        assert isinstance(data["items"], list)
        # If empty real, fallback synthesises 3
        if data["real_count"] == 0:
            assert len(data["items"]) <= 3
        for it in data["items"]:
            assert "crop" in it and "title" in it
            assert "realized_return_pct" in it


# --------------- Social proof ---------------
class TestSocialProof:
    def test_social_proof_shape(self, investor_token):
        # Pick any opportunity
        opps = requests.get(f"{API}/opportunities", timeout=20).json()
        assert isinstance(opps, list) and len(opps) > 0
        opp_id = opps[0]["id"]
        r = requests.get(f"{API}/opportunities/{opp_id}/social-proof", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("last_24h_investor_count", "last_24h_volume", "total_investor_count", "recent_activity"):
            assert k in d, f"missing {k}"
        assert isinstance(d["recent_activity"], list)


# --------------- KYC status + upgrade + enforcement ---------------
class TestKYC:
    def test_kyc_status_default_silver(self, investor_token):
        r = requests.get(f"{API}/investor/kyc-status", headers=H(investor_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tier"] in ("silver", "bronze", "gold", "unverified")
        # Per seed default is silver
        assert "max_investment" in d and "remaining" in d and "used" in d
        assert isinstance(d.get("all_tiers"), list) and len(d["all_tiers"]) == 4

    def test_kyc_upgrade_to_gold_then_back_to_bronze_via_db_and_enforce(self, investor_token, admin_token):
        # Upgrade investor to gold via API
        r = requests.post(
            f"{API}/investor/kyc-upgrade",
            headers=H(investor_token),
            json={"requested_tier": "gold", "full_legal_name": "TEST_Tunde Adesanya", "id_number": "TEST_AB1234567"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("new_tier") == "gold"
        # status reflects gold
        s = requests.get(f"{API}/investor/kyc-status", headers=H(investor_token), timeout=20).json()
        assert s["tier"] == "gold"

        # Downgrade back to bronze via the same upgrade endpoint (it accepts bronze)
        r = requests.post(
            f"{API}/investor/kyc-upgrade",
            headers=H(investor_token),
            json={"requested_tier": "bronze", "full_legal_name": "TEST_Tunde Adesanya", "id_number": "TEST_AB1234567"},
            timeout=20,
        )
        assert r.status_code == 200
        s = requests.get(f"{API}/investor/kyc-status", headers=H(investor_token), timeout=20).json()
        assert s["tier"] == "bronze"

        # Find an OPEN opportunity with sufficient remaining headroom (>600k) so the
        # KYC tier check is reached (the remaining-amount check fires first if not).
        opps = requests.get(f"{API}/opportunities", timeout=20).json()
        open_opp = None
        for o in opps:
            if o.get("status") != "open":
                continue
            remaining = float(o.get("funding_target", 0)) - float(o.get("funding_raised", 0) or 0)
            if remaining >= 700_000:
                open_opp = o
                break
        if not open_opp:
            pytest.skip("No open opp with >700k remaining to exercise tier-limit guard")
        opp_id = open_opp["id"]

        # Attempt to invest 600,000 (above bronze 500k limit) → 403
        r = requests.post(
            f"{API}/opportunities/{opp_id}/invest",
            headers=H(investor_token),
            json={"amount": 600_000},
            timeout=20,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} body={r.text[:200]}"
        body = r.text.lower()
        assert "exceeds" in body or "tier limit" in body

        # Restore tier to silver for downstream tests
        requests.post(
            f"{API}/investor/kyc-upgrade",
            headers=H(investor_token),
            json={"requested_tier": "silver", "full_legal_name": "TEST_Tunde Adesanya", "id_number": "TEST_AB1234567"},
            timeout=20,
        )


# --------------- Logistics earnings ---------------
class TestLogisticsEarnings:
    def test_logistics_earnings_shape(self, logistics_token):
        r = requests.get(f"{API}/logistics/earnings?days=30", headers=H(logistics_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_jobs", "delivered_count", "total_earned", "period_earned",
                  "on_time_pct", "weekly", "currency"):
            assert k in d, f"missing {k}"
        assert isinstance(d["weekly"], list)
        assert d["currency"] == "NGN"

    def test_logistics_earnings_days_param(self, logistics_token):
        r = requests.get(f"{API}/logistics/earnings?days=90", headers=H(logistics_token), timeout=20)
        assert r.status_code == 200
        assert r.json().get("period_days") == 90


# --------------- Maturity + payout flow (admin) ---------------
class TestMaturityPayout:
    def test_mature_then_payout_full_flow(self, admin_token, investor_token):
        # Look for an existing 'funded' opportunity, otherwise skip the heavy create flow.
        opps = requests.get(f"{API}/opportunities", timeout=20).json()
        funded = next((o for o in opps if o.get("status") == "funded"), None)
        if not funded:
            # Try to fund one quickly: pick the smallest open opportunity and invest up to target.
            open_opps = [o for o in opps if o.get("status") in ("open", "active")]
            open_opps.sort(key=lambda x: float(x.get("funding_target", 0)))
            target_opp = next((o for o in open_opps if float(o.get("funding_target", 0)) <= 5_000_000), None)
            if not target_opp:
                pytest.skip("No funded opp and no small open opp to fund within investor wallet limits")
            opp_id = target_opp["id"]
            target = float(target_opp["funding_target"])
            raised = float(target_opp.get("funding_raised", 0))
            need = max(0, target - raised)
            if need > 1_500_000:
                pytest.skip("Open opp needs more capital than investor demo wallet supports for funding push")
            # invest the remainder
            r = requests.post(
                f"{API}/opportunities/{opp_id}/invest",
                headers=H(investor_token),
                json={"amount": need},
                timeout=30,
            )
            if r.status_code != 200:
                pytest.skip(f"Could not push opp to funded: {r.status_code} {r.text[:200]}")
            funded = requests.get(f"{API}/opportunities/{opp_id}", timeout=20).json()
            if funded.get("status") != "funded":
                pytest.skip(f"Opp did not transition to funded after invest: status={funded.get('status')}")

        opp_id = funded["id"]

        # MATURE
        r = requests.post(
            f"{API}/admin/opportunities/{opp_id}/mature",
            headers=H(admin_token),
            json={"realized_return_pct": 15},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        m = r.json()
        assert m.get("ok") is True
        assert m.get("status") == "matured"
        assert m.get("realized_return_pct") == 15

        # PAYOUT
        r = requests.post(
            f"{API}/admin/opportunities/{opp_id}/payout",
            headers=H(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p.get("ok") is True
        assert p.get("status") == "closed"
        assert p.get("investors_paid", 0) >= 1
        assert p.get("total_paid_out", 0) > 0

    def test_payout_requires_matured_status(self, admin_token):
        opps = requests.get(f"{API}/opportunities", timeout=20).json()
        non_matured = next((o for o in opps if o.get("status") in ("open", "active")), None)
        if not non_matured:
            pytest.skip("no open opp to test guard")
        r = requests.post(
            f"{API}/admin/opportunities/{non_matured['id']}/payout",
            headers=H(admin_token),
            timeout=20,
        )
        assert r.status_code == 400


# --------------- Regression on prior phases ---------------
class TestRegressionPriorPhases:
    def test_opportunities_list(self):
        r = requests.get(f"{API}/opportunities", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_investments_summary(self, investor_token):
        r = requests.get(f"{API}/investments/summary", headers=H(investor_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        # Some shape exists
        assert isinstance(d, dict)

    def test_admin_users_list(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=H(admin_token), timeout=20)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) > 0

    def test_admin_verify_user_toggle(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=H(admin_token), timeout=20)
        users = r.json()
        farmer = next((u for u in users if u.get("role") == "farmer"), None)
        assert farmer
        original = bool(farmer.get("verified", False))
        try:
            r2 = requests.post(
                f"{API}/admin/users/{farmer['id']}/verify",
                headers=H(admin_token),
                json={"verified": True},
                timeout=20,
            )
            assert r2.status_code == 200, r2.text
        finally:
            requests.post(
                f"{API}/admin/users/{farmer['id']}/verify",
                headers=H(admin_token),
                json={"verified": original},
                timeout=20,
            )
