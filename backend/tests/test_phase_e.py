"""Phase E regression: real recent_viewers + supplier score history + score_delta_30d.

Run standalone: `pytest /app/backend/tests/test_phase_e.py -v`
"""
import os
import time

import httpx

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001") + "/api"


def _login(email: str, password: str) -> str:
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def test_recent_viewers_counts_distinct_ips():
    listings = httpx.get(f"{BASE}/listings", timeout=15).json()
    assert listings, "need at least one seeded listing"
    lid = listings[0]["id"]

    # Bump with 3 distinct viewer IPs
    for ip in ["172.0.0.1", "172.0.0.2", "172.0.0.3"]:
        httpx.get(f"{BASE}/listings/{lid}", headers={"X-Forwarded-For": ip}, timeout=15).raise_for_status()

    time.sleep(0.3)
    data = httpx.get(f"{BASE}/liquidity/listing/{lid}", timeout=15).json()
    assert data["recent_viewers"] >= 3, f"expected ≥3 recent viewers, got {data['recent_viewers']}"


def test_supplier_performance_returns_score_version_and_delta_field():
    listings = httpx.get(f"{BASE}/listings", timeout=15).json()
    farmer_id = listings[0]["farmer_id"]
    r = httpx.get(f"{BASE}/suppliers/{farmer_id}/performance", timeout=15)
    r.raise_for_status()
    d = r.json()
    assert d.get("score_version") == 1
    assert "score_delta_30d" in d  # may be None on first capture


def test_supplier_score_history_endpoint_returns_series():
    listings = httpx.get(f"{BASE}/listings", timeout=15).json()
    farmer_id = listings[0]["farmer_id"]
    # Trigger a capture
    httpx.get(f"{BASE}/suppliers/{farmer_id}/performance", timeout=15).raise_for_status()
    r = httpx.get(f"{BASE}/suppliers/{farmer_id}/score-history?days=30", timeout=15)
    r.raise_for_status()
    data = r.json()
    assert "series" in data
    assert isinstance(data["series"], list)
    if data["series"]:
        row = data["series"][0]
        assert "date" in row and "score" in row and "band" in row


def test_liquidity_404_for_missing_listing():
    r = httpx.get(f"{BASE}/liquidity/listing/does-not-exist", timeout=15)
    assert r.status_code == 404
