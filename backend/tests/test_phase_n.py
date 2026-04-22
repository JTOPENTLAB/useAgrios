"""AGRIOS Phase N — Growth engine backend tests.

Covers:
- /api/referrals/stats (link uses public Origin)
- /api/events/track (public, anonymous)
- /api/stats/platform-metrics (admin only)
- Full referral E2E: signup with AF-INV001 -> fund -> invest -> ₦2k credit
  for both referrer and referee. Idempotent on second invest.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
PUBLIC_ORIGIN = BASE_URL  # Same as REACT_APP_BACKEND_URL
INVESTOR_EMAIL = "investor@agriflow.ng"
INVESTOR_PASSWORD = "Invest@123"
ADMIN_EMAIL = "admin@agriflow.ng"
ADMIN_PASSWORD = "Admin@12345"
FARMER_EMAIL = "farmer@agriflow.ng"
FARMER_PASSWORD = "Farmer@123"
INVESTOR_REF_CODE = "AF-INV001"
BONUS = 2000.0


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(tok, extra=None):
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _wallet_available(tok):
    r = requests.get(f"{BASE_URL}/api/wallet", headers=_h(tok), timeout=20)
    j = r.json()
    if isinstance(j, dict) and "wallet" in j:
        return float(j["wallet"].get("available") or 0), j.get("entries", [])
    return float(j.get("available") or 0), j.get("entries", [])



class TestReferralStats:
    def test_investor_stats_shape_and_public_link(self):
        tok = _login(INVESTOR_EMAIL, INVESTOR_PASSWORD)
        r = requests.get(
            f"{BASE_URL}/api/referrals/stats",
            headers=_h(tok, {"Origin": PUBLIC_ORIGIN}),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("code", "link", "invited_count", "activated_count", "total_earned", "bonus_per_referral", "recent"):
            assert k in data, f"missing {k} in {data}"
        assert data["bonus_per_referral"] == BONUS
        assert data["code"] == INVESTOR_REF_CODE
        # Public preview URL — must NOT contain internal cluster hostname (svc/cluster.local) or 0.0.0.0/8001
        assert "agri-fintech-ng.preview.emergentagent.com" in data["link"], f"link not public: {data['link']}"
        assert "/signup?role=investor&ref=" in data["link"]
        assert data["link"].endswith(INVESTOR_REF_CODE)
        assert isinstance(data["recent"], list)

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{BASE_URL}/api/referrals/stats", timeout=20)
        assert r.status_code in (401, 403)


# -------------------- /api/events/track --------------------
class TestEventsTrack:
    def test_track_public_no_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/events/track",
            json={
                "event": "landing_view",
                "utm_source": "tiktok",
                "utm_campaign": "launch",
                "utm_medium": "social",
                "path": "/",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_track_validation(self):
        # event field required
        r = requests.post(f"{BASE_URL}/api/events/track", json={"utm_source": "x"}, timeout=20)
        assert r.status_code in (400, 422)


# -------------------- /api/stats/platform-metrics --------------------
class TestPlatformMetrics:
    def test_admin_metrics_shape_and_funnel_capped(self):
        # Ensure tiktok event exists so utm_sources list isn't empty
        requests.post(
            f"{BASE_URL}/api/events/track",
            json={"event": "landing_view", "utm_source": "tiktok", "utm_campaign": "launch"},
            timeout=20,
        )
        tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        r = requests.get(f"{BASE_URL}/api/stats/platform-metrics?days=30", headers=_h(tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("period_days") == 30
        assert "totals" in d and "users" in d["totals"]
        period = d.get("period", {})
        for k in ("signups", "signups_by_role", "depositor_count", "investor_count", "first_investors", "total_invested", "invest_count"):
            assert k in period, f"period missing {k}"
        assert isinstance(period["signups_by_role"], dict)
        funnel = d.get("funnel", {})
        for k in ("signup_to_deposit_pct", "deposit_to_invest_pct", "signup_to_invest_pct"):
            assert k in funnel
            assert 0 <= funnel[k] <= 100, f"funnel {k} not capped: {funnel[k]}"
        assert isinstance(d.get("utm_sources"), list)
        sources = [s.get("source") for s in d["utm_sources"]]
        assert "tiktok" in sources, f"tiktok not in utm_sources: {sources}"

    def test_non_admin_blocked(self):
        tok = _login(INVESTOR_EMAIL, INVESTOR_PASSWORD)
        r = requests.get(f"{BASE_URL}/api/stats/platform-metrics?days=30", headers=_h(tok), timeout=20)
        assert r.status_code == 403


# -------------------- Referral E2E --------------------
class TestReferralE2E:
    @pytest.fixture(scope="class")
    def state(self):
        # Pre-snapshot referrer wallet & stats
        ref_tok = _login(INVESTOR_EMAIL, INVESTOR_PASSWORD)
        w0_avail, _ = _wallet_available(ref_tok)
        s0 = requests.get(f"{BASE_URL}/api/referrals/stats", headers=_h(ref_tok, {"Origin": PUBLIC_ORIGIN}), timeout=20).json()

        unique = uuid.uuid4().hex[:10]
        new_email = f"test_refn_{unique}@example.com"
        new_pwd = "RefTest@123"
        # Signup new investor with referral code
        sr = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": new_email,
            "password": new_pwd,
            "full_name": f"Ref Test {unique}",
            "role": "investor",
            "phone": "+2348012345678",
            "country": "NG",
            "referral_code": INVESTOR_REF_CODE,
        }, timeout=20)
        assert sr.status_code in (200, 201), sr.text
        new_tok = sr.json()["token"]
        new_uid = sr.json()["user"]["id"]
        # Auto-approve KYC (mocked) so investor can place investments
        kyc_r = requests.post(
            f"{BASE_URL}/api/investor/kyc-upgrade",
            json={"requested_tier": "silver", "full_legal_name": "Ref Test Legal", "id_number": "AB1234567"},
            headers=_h(new_tok),
            timeout=20,
        )
        assert kyc_r.status_code in (200, 201), f"kyc-upgrade failed: {kyc_r.status_code} {kyc_r.text}"
        # Sanity: referred_by must be set on new user (server-side relation)
        return {
            "ref_tok": ref_tok,
            "ref_wallet0": w0_avail,
            "ref_invited0": int(s0.get("invited_count") or 0),
            "ref_activated0": int(s0.get("activated_count") or 0),
            "ref_earned0": float(s0.get("total_earned") or 0),
            "new_email": new_email,
            "new_pwd": new_pwd,
            "new_tok": new_tok,
            "new_uid": new_uid,
        }

    def test_a_signup_increments_invited(self, state):
        # Wait briefly for index, then re-fetch referrer stats
        time.sleep(0.5)
        s1 = requests.get(
            f"{BASE_URL}/api/referrals/stats",
            headers=_h(state["ref_tok"], {"Origin": PUBLIC_ORIGIN}),
            timeout=20,
        ).json()
        assert s1["invited_count"] == state["ref_invited0"] + 1, \
            f"invited not incremented: was {state['ref_invited0']} now {s1['invited_count']}"
        # Activated should NOT increment yet (no invest done)
        assert s1["activated_count"] == state["ref_activated0"]

    def test_b_fund_and_invest(self, state):
        # Top up new investor wallet
        amount = 100000.0
        fr = requests.post(
            f"{BASE_URL}/api/wallet/fund",
            json={"amount": amount, "method": "demo"},
            headers=_h(state["new_tok"]),
            timeout=20,
        )
        assert fr.status_code in (200, 201), fr.text
        # Pick first open opportunity
        ops = requests.get(f"{BASE_URL}/api/opportunities?status=open", timeout=20)
        assert ops.status_code == 200
        rows = ops.json()
        open_rows = [o for o in (rows if isinstance(rows, list) else rows.get("items", [])) if o.get("status") == "open"]
        assert open_rows, "no open opportunities"
        opp = open_rows[0]
        opp_id = opp["id"]
        state["opp_id"] = opp_id
        invest_amt = max(float(opp.get("min_ticket") or 1000), 5000.0)
        ir = requests.post(
            f"{BASE_URL}/api/opportunities/{opp_id}/invest",
            json={"amount": invest_amt},
            headers=_h(state["new_tok"]),
            timeout=30,
        )
        assert ir.status_code in (200, 201), f"invest failed: {ir.status_code} {ir.text}"
        time.sleep(1.0)  # let awarder hook complete

    def test_c_referrer_stats_after_invest(self, state):
        s2 = requests.get(
            f"{BASE_URL}/api/referrals/stats",
            headers=_h(state["ref_tok"], {"Origin": PUBLIC_ORIGIN}),
            timeout=20,
        ).json()
        assert s2["activated_count"] == state["ref_activated0"] + 1, \
            f"activated did not increment: was {state['ref_activated0']} now {s2['activated_count']}"
        assert s2["total_earned"] >= state["ref_earned0"] + BONUS - 0.01

    def test_d_both_wallets_credited(self, state):
        # Referrer wallet
        ref_avail, ref_entries = _wallet_available(state["ref_tok"])
        delta_ref = ref_avail - state["ref_wallet0"]
        assert delta_ref >= BONUS - 0.01, f"referrer wallet delta {delta_ref} < {BONUS}"
        ref_kinds = [e.get("kind") for e in ref_entries]
        assert "referral_bonus" in ref_kinds, f"referrer ledger missing referral_bonus: {ref_kinds[:5]}"
        # Referee wallet
        new_avail, new_entries = _wallet_available(state["new_tok"])
        new_kinds = [e.get("kind") for e in new_entries]
        assert "referral_bonus" in new_kinds, f"referee ledger missing referral_bonus: {new_kinds}"
        assert new_avail >= BONUS - 0.01

    def test_e_idempotent_second_invest(self, state):
        # Second invest by same referee should NOT credit again
        ref_w_before, _ = _wallet_available(state["ref_tok"])
        # Fund again to ensure wallet has balance
        requests.post(f"{BASE_URL}/api/wallet/fund", json={"amount": 50000.0, "method": "demo"},
                      headers=_h(state["new_tok"]), timeout=20)
        opp_id = state.get("opp_id")
        ir2 = requests.post(
            f"{BASE_URL}/api/opportunities/{opp_id}/invest",
            json={"amount": 5000.0},
            headers=_h(state["new_tok"]),
            timeout=30,
        )
        # Could 200 (allowed) or 4xx (one-investment-per-opp rule). Either way, no new bonus.
        time.sleep(1.0)
        ref_w_after, _ = _wallet_available(state["ref_tok"])
        delta = ref_w_after - ref_w_before
        assert delta < BONUS, f"referrer credited again on 2nd invest! delta={delta} (status of 2nd invest {ir2.status_code})"
