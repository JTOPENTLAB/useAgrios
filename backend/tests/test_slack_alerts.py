"""AGRIOS — Real-time Slack alerts tests.

Covers:
  • /api/admin/slack-alerts/test (admin-only)
  • /api/admin/slack-alerts/log shape
  • Event emission: signup → wallet.fund → kyc.upgrade → first investment
  • Rollup batching: 3 small investments ⇒ 1 aggregate alert when force-flushed
  • Inactivity sweep shape
  • Unconfigured webhook ⇒ status='skipped' (never 'failed')
"""
from __future__ import annotations

import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@agriflow.ng", "password": "Admin@12345"}
INVESTOR = {"email": "investor@agriflow.ng", "password": "Invest@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _signup(email, name="Launch Tester", role="investor"):
    r = requests.post(f"{API}/auth/signup", json={
        "email": email, "password": "Test@12345",
        "full_name": name, "role": role, "country": "NG",
    }, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def investor_token():
    return _login(INVESTOR)


# ─── Basic admin controls ─────────────────────────────────────────────────

def test_slack_alerts_test_endpoint(admin_token):
    r = requests.post(
        f"{API}/admin/slack-alerts/test",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    # Webhook not configured in CI → status must be 'skipped', never 'failed'
    assert body["delivery"]["status"] in ("sent", "skipped")
    assert body["delivery"]["provider"] == "slack"
    assert "webhook_configured" in body


def test_slack_alerts_test_forbidden_for_investor(investor_token):
    r = requests.post(
        f"{API}/admin/slack-alerts/test",
        headers={"Authorization": f"Bearer {investor_token}"},
        timeout=15,
    )
    assert r.status_code == 403


def test_slack_alerts_log_shape(admin_token):
    r = requests.get(
        f"{API}/admin/slack-alerts/log?limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert "rows" in body
    assert "webhook_configured" in body
    assert "cooldown_rollup_seconds" in body
    assert "inactivity_hours" in body
    for row in body["rows"]:
        assert row.get("meta", {}).get("kind") == "slack_alert"
        assert row["status"] in ("sent", "skipped", "failed", "logged")


# ─── Event emission ───────────────────────────────────────────────────────

def _find_alert(admin_token, reason_substr, name_substr=None, limit=30):
    r = requests.get(
        f"{API}/admin/slack-alerts/log?limit={limit}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    for row in r.json()["rows"]:
        if reason_substr in (row.get("meta", {}).get("reason") or ""):
            if name_substr is None or name_substr in (row.get("subject") or ""):
                return row
    return None


def test_signup_fires_slack_alert(admin_token):
    email = f"slack-test-{int(time.time())}@example.com"
    _signup(email, name="Sarah Adegoke")
    # Give the async hook a tick to write the log row
    time.sleep(0.5)
    alert = _find_alert(admin_token, "user.signup", name_substr="Sarah A.")
    assert alert is not None, "No user.signup alert found for Sarah A."
    assert "New signup" in alert["subject"]
    # PII masking: surname reduced to first initial + dot
    assert "Sarah A." in alert["subject"]
    assert "Adegoke" not in alert["subject"]


def test_wallet_fund_fires_first_deposit_alert(admin_token):
    email = f"slack-fund-{int(time.time())}@example.com"
    token = _signup(email, name="Tunde Laleye")
    r = requests.post(
        f"{API}/wallet/fund",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 25000},
        timeout=15,
    )
    assert r.status_code == 200
    time.sleep(0.5)
    alert = _find_alert(admin_token, "wallet.funded", name_substr="Tunde L.")
    assert alert is not None
    # First deposit gets a special moneybag icon + 'First deposit' label
    assert "First deposit" in alert["subject"]
    assert "25,000" in alert["subject"]


def test_first_investment_alert_immediate(admin_token):
    """First investment must fire immediately (not go through rollup)."""
    email = f"slack-firstinv-{int(time.time())}@example.com"
    token = _signup(email, name="Ngozi Uche")
    # Fund + upgrade KYC
    requests.post(f"{API}/wallet/fund",
                  headers={"Authorization": f"Bearer {token}"},
                  json={"amount": 50000}, timeout=15)
    requests.post(f"{API}/investor/kyc-upgrade",
                  headers={"Authorization": f"Bearer {token}"},
                  json={"requested_tier": "bronze",
                        "full_legal_name": "Ngozi Uche",
                        "id_number": "NIN-00000"}, timeout=15)
    # Find an open opportunity with room
    opps = requests.get(f"{API}/opportunities", timeout=15).json()
    opp = next(
        (o for o in opps
         if o.get("status") == "open"
         and (o.get("funding_target", 0) - o.get("funding_raised", 0)) > 20000),
        None,
    )
    assert opp is not None, "No open opportunity with room available"
    r = requests.post(
        f"{API}/opportunities/{opp['id']}/invest",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 10000},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    time.sleep(0.5)
    alert = _find_alert(admin_token, "investment.first", name_substr="Ngozi U.")
    assert alert is not None, "No investment.first alert for Ngozi U."
    assert "First investment" in alert["subject"]
    assert "10,000" in alert["subject"]


def test_investment_rollup_aggregates_burst(admin_token, investor_token):
    """3 small investments from an existing investor on the same opp should
    produce 1 aggregate alert when force-flushed (not 3 individual alerts)."""
    # Pick an opp with capacity
    opps = requests.get(f"{API}/opportunities", timeout=15).json()
    opp = next(
        (o for o in opps
         if o.get("status") == "open"
         and (o.get("funding_target", 0) - o.get("funding_raised", 0)) > 50000),
        None,
    )
    assert opp is not None
    # Snapshot log size
    before = requests.get(
        f"{API}/admin/slack-alerts/log?limit=50",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    ).json()
    before_count = len(before["rows"])
    # Fire 3 small investments (min ticket is ₦5k)
    for _ in range(3):
        r = requests.post(
            f"{API}/opportunities/{opp['id']}/invest",
            headers={"Authorization": f"Bearer {investor_token}"},
            json={"amount": 5000},
            timeout=15,
        )
        assert r.status_code == 200, r.text
    # Force flush
    flush = requests.post(
        f"{API}/admin/slack-alerts/flush-rollups?force=true",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    ).json()
    # flushed may be 0 if the scheduler already flushed it; either way the
    # aggregate must be present in the log
    time.sleep(0.3)
    after = requests.get(
        f"{API}/admin/slack-alerts/log?limit=50",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    ).json()
    # Find the most-recent investment.created alert
    agg = next(
        (r for r in after["rows"]
         if r.get("meta", {}).get("reason") == "investment.created"),
        None,
    )
    assert agg is not None, f"No aggregate alert after burst; flush={flush}"
    # Must be a roll-up — meta.count >= 2 OR 'investors' in subject
    count = agg.get("meta", {}).get("count")
    assert (count and count >= 2) or ("investors" in agg["subject"]), \
        f"Expected aggregated alert, got: {agg['subject']} count={count}"


# ─── Inactivity sweep ─────────────────────────────────────────────────────

def test_inactivity_sweep_shape(admin_token):
    r = requests.post(
        f"{API}/admin/slack-alerts/inactivity-sweep",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    body = r.json()
    assert "alerts_fired" in body
    assert isinstance(body["alerts_fired"], int)
    assert body["alerts_fired"] >= 0


def test_inactivity_sweep_forbidden_for_investor(investor_token):
    r = requests.post(
        f"{API}/admin/slack-alerts/inactivity-sweep",
        headers={"Authorization": f"Bearer {investor_token}"},
        timeout=15,
    )
    assert r.status_code == 403
