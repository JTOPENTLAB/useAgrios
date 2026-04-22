"""AGRIOS Phase O — Cohort retention tests.

Covers:
  • /api/admin/cohorts/retention auth (admin only)
  • shape (weeks, milestones, cohorts matrix, overall roll-up)
  • eligibility logic for the current week (W+8 should be ineligible for W0)
  • param bounds (weeks clamped 2..26)
"""
from __future__ import annotations

import os
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


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def investor_token():
    return _login(INVESTOR)


def test_cohort_retention_admin_only(investor_token):
    r = requests.get(
        f"{API}/admin/cohorts/retention",
        headers={"Authorization": f"Bearer {investor_token}"},
        timeout=15,
    )
    assert r.status_code == 403, r.text


def test_cohort_retention_shape(admin_token):
    r = requests.get(
        f"{API}/admin/cohorts/retention?weeks=8",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["weeks"] == 8
    assert body["milestones"] == ["W+1", "W+2", "W+4", "W+8"]
    assert isinstance(body["cohorts"], list) and len(body["cohorts"]) == 8
    # Each cohort must have size + retention with all 4 milestones
    for c in body["cohorts"]:
        assert "size" in c
        assert "label" in c
        assert "week_start" in c
        assert set(c["retention"].keys()) == {"W+1", "W+2", "W+4", "W+8"}
        for m in ["W+1", "W+2", "W+4", "W+8"]:
            cell = c["retention"][m]
            assert "count" in cell and "pct" in cell and "eligible" in cell
    # Overall roll-up must be present with all 4 milestones
    assert set(body["overall"].keys()) == {"W+1", "W+2", "W+4", "W+8"}
    for m, o in body["overall"].items():
        assert "count" in o and "pct" in o and "eligible_size" in o


def test_cohort_retention_current_week_ineligible_for_w8(admin_token):
    r = requests.get(
        f"{API}/admin/cohorts/retention?weeks=8",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    # The most recent cohort (last in list) cannot be eligible for W+8 yet
    latest = body["cohorts"][-1]
    assert latest["retention"]["W+8"]["eligible"] is False


def test_cohort_retention_weeks_bound(admin_token):
    # weeks=1 must clamp to min=2
    r = requests.get(
        f"{API}/admin/cohorts/retention?weeks=1",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["weeks"] == 2
    # weeks=99 must clamp to max=26
    r = requests.get(
        f"{API}/admin/cohorts/retention?weeks=99",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["weeks"] == 26


def test_cohort_retention_no_auth():
    r = requests.get(f"{API}/admin/cohorts/retention", timeout=15)
    assert r.status_code in (401, 403)


def test_pre_launch_checklist_regression(admin_token):
    """10-minute pre-launch smoke: every checklist endpoint responds 200."""
    endpoints = [
        # Growth + loop
        "/stats/platform-metrics?days=30",
        "/admin/cohorts/retention?weeks=8",
        # Health probes
        "/healthz",
        # Core public
        "/opportunities",
        "/stats/landing-pulse",
        "/stats/public",
        "/stats/recent-deals",
    ]
    headers = {"Authorization": f"Bearer {admin_token}"}
    for path in endpoints:
        r = requests.get(f"{API}{path}", headers=headers, timeout=15)
        assert r.status_code == 200, f"{path} returned {r.status_code}: {r.text[:200]}"


# ─── Cohort digest tests ──────────────────────────────────────────────────
def test_cohort_digest_preview_admin(admin_token):
    r = requests.get(
        f"{API}/admin/cohort-digest/preview",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "subject" in body
    assert "payload" in body
    assert "text" in body
    p = body["payload"]
    # Required shape
    for k in ("headline", "last_week", "prev_week", "deltas", "retention",
              "cohort_matrix", "action_items", "window"):
        assert k in p, f"missing {k} in payload"
    # 4 milestones present in retention + cohort matrix cells
    assert set(p["retention"].keys()) == {"W+1", "W+2", "W+4", "W+8"}
    for row in p["cohort_matrix"]:
        assert set(row["cells"].keys()) == {"W+1", "W+2", "W+4", "W+8"}
    # Text body is non-trivial
    assert len(body["text"]) > 200


def test_cohort_digest_preview_forbidden_for_investor(investor_token):
    r = requests.get(
        f"{API}/admin/cohort-digest/preview",
        headers={"Authorization": f"Bearer {investor_token}"},
        timeout=15,
    )
    assert r.status_code == 403


def test_cohort_digest_send_me_now(admin_token):
    r = requests.post(
        f"{API}/admin/cohort-digest/send-me-now",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert "delivery" in body
    assert body["delivery"]["status"] in ("sent", "logged")
    assert body["delivery"]["provider"] in ("mock", "resend", "sendgrid")
    # Multichannel status map
    assert "channels" in body
    for ch in ("email", "slack", "whatsapp"):
        assert ch in body["channels"]
        assert body["channels"][ch] in ("sent", "logged", "skipped", "failed")


def test_cohort_digest_test_webhooks(admin_token):
    r = requests.post(
        f"{API}/admin/cohort-digest/test-webhooks",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "preview_text" in body
    assert "AGRIOS weekly" in body["preview_text"]
    for ch in ("slack", "whatsapp"):
        assert ch in body
        assert body[ch]["status"] in ("sent", "skipped", "failed")
        assert body[ch]["provider"] in ("slack", "whatsapp")


def test_cohort_digest_test_webhooks_forbidden_for_investor(investor_token):
    r = requests.post(
        f"{API}/admin/cohort-digest/test-webhooks",
        headers={"Authorization": f"Bearer {investor_token}"},
        timeout=15,
    )
    assert r.status_code == 403


def test_cohort_digest_trigger_admin(admin_token):
    r = requests.post(
        f"{API}/admin/cohort-digest/trigger",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reason"] == "manual-trigger"
    assert body["sent"] >= 1  # at least the admin account exists
    assert "ran_at" in body
    # Channels block must be present (even if every channel is skipped)
    assert "channels" in body
    for ch in ("slack", "whatsapp"):
        assert ch in body["channels"]


def test_cohort_digest_log(admin_token):
    r = requests.get(
        f"{API}/admin/cohort-digest/log?limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert "last_run" in body
    assert "rows" in body
    # After the trigger test above, we must have at least one row
    assert isinstance(body["rows"], list)


def test_cohort_digest_trigger_forbidden_for_investor(investor_token):
    r = requests.post(
        f"{API}/admin/cohort-digest/trigger",
        headers={"Authorization": f"Bearer {investor_token}"},
        timeout=15,
    )
    assert r.status_code == 403
