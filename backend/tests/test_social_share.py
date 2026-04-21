"""Tests for the per-listing OG share endpoint and dynamic sitemap.

Covers:
- GET /api/p/{listing_id}  (OG card HTML)
- GET /api/sitemap-listings.xml
"""
import json
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agri-fintech-ng.preview.emergentagent.com").rstrip("/")
PUBLIC_SITE_URL = "https://agri-fintech-ng.preview.emergentagent.com"


@pytest.fixture(scope="module")
def active_listing_id():
    r = requests.get(f"{BASE_URL}/api/listings", timeout=30)
    assert r.status_code == 200, f"/api/listings failed: {r.status_code}"
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "No listings returned"
    # prefer an active one
    for l in data:
        if l.get("status") == "active":
            return l["id"]
    return data[0]["id"]


# --- OG endpoint ---
class TestOGShare:
    def test_valid_listing_returns_200_html(self, active_listing_id):
        r = requests.get(f"{BASE_URL}/api/p/{active_listing_id}", timeout=30)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert "<!doctype html>" in r.text.lower()

    def test_required_og_tags(self, active_listing_id):
        r = requests.get(f"{BASE_URL}/api/p/{active_listing_id}", timeout=30)
        html = r.text

        required_meta = [
            ('property="og:type"', 'content="product"'),
            ('property="og:site_name"', 'content="AGRIOS"'),
            ('property="og:title"', None),
            ('property="og:description"', None),
            ('property="og:url"', None),
            ('property="og:image"', None),
            ('property="og:image:width"', 'content="1200"'),
            ('property="og:image:height"', 'content="630"'),
            ('name="twitter:card"', 'content="summary_large_image"'),
            ('name="twitter:title"', None),
            ('name="twitter:image"', None),
            ('property="product:price:amount"', None),
            ('property="product:price:currency"', None),
        ]
        for attr, content in required_meta:
            assert attr in html, f"Missing meta attribute: {attr}"
            if content:
                assert content in html, f"Missing expected content for {attr}: {content}"

        # og:url must use PUBLIC_SITE_URL
        og_url = re.search(r'property="og:url"\s+content="([^"]+)"', html)
        assert og_url, "og:url meta not found"
        assert og_url.group(1).startswith(PUBLIC_SITE_URL), f"og:url doesn't use PUBLIC_SITE_URL: {og_url.group(1)}"
        assert f"/listing/{active_listing_id}" in og_url.group(1)

    def test_og_title_includes_crop_and_price(self, active_listing_id):
        # fetch listing for crop/price
        l = requests.get(f"{BASE_URL}/api/listings/{active_listing_id}", timeout=30).json()
        r = requests.get(f"{BASE_URL}/api/p/{active_listing_id}", timeout=30)
        html = r.text
        og_title = re.search(r'property="og:title"\s+content="([^"]+)"', html)
        assert og_title, "og:title missing"
        title_val = og_title.group(1)
        assert l["crop"] in title_val, f"Crop '{l['crop']}' not in og:title: {title_val}"
        # price digits should appear
        price_digits = f"{int(l.get('price_per_kg') or 0):,}"
        assert price_digits in title_val or str(int(l.get("price_per_kg") or 0)) in title_val, \
            f"Price not in og:title: {title_val}"

    def test_json_ld_product_valid(self, active_listing_id):
        r = requests.get(f"{BASE_URL}/api/p/{active_listing_id}", timeout=30)
        m = re.search(
            r'<script type="application/ld\+json">\s*(.+?)\s*</script>',
            r.text,
            re.DOTALL,
        )
        assert m, "JSON-LD script tag not found"
        data = json.loads(m.group(1))
        assert data.get("@context") == "https://schema.org/"
        assert data.get("@type") == "Product"
        assert "offers" in data
        assert "priceCurrency" in data["offers"]
        assert "price" in data["offers"]

    def test_redirect_hints_present(self, active_listing_id):
        r = requests.get(f"{BASE_URL}/api/p/{active_listing_id}", timeout=30)
        html = r.text
        assert re.search(r'<meta\s+http-equiv="refresh"', html, re.IGNORECASE), \
            "meta http-equiv=refresh missing"
        assert "window.location.replace(" in html, "window.location.replace redirect missing"
        assert f"/listing/{active_listing_id}" in html

    def test_nonexistent_listing_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/p/nonexistent-id-xyz-123", timeout=30)
        assert r.status_code == 404
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert "<" in r.text  # some HTML body


# --- Sitemap ---
class TestSitemapListings:
    def test_returns_200_xml(self):
        r = requests.get(f"{BASE_URL}/api/sitemap-listings.xml", timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "").lower()
        assert "application/xml" in ct or "text/xml" in ct, f"Bad content-type: {ct}"

    def test_contains_url_entries(self):
        r = requests.get(f"{BASE_URL}/api/sitemap-listings.xml", timeout=30)
        body = r.text
        assert "<urlset" in body
        assert "<url>" in body
        # At least one <loc> with /listing/
        locs = re.findall(r"<loc>([^<]+)</loc>", body)
        assert len(locs) > 0, "No <loc> entries in sitemap"
        matching = [u for u in locs if "/listing/" in u and u.startswith(PUBLIC_SITE_URL)]
        assert len(matching) > 0, f"No absolute /listing/ locs with PUBLIC_SITE_URL. Sample: {locs[:3]}"


# --- robots.txt ---
class TestRobots:
    def test_robots_lists_both_sitemaps(self):
        r = requests.get(f"{PUBLIC_SITE_URL}/robots.txt", timeout=30)
        assert r.status_code == 200
        body = r.text
        assert "sitemap.xml" in body.lower()
        assert "api/sitemap-listings.xml" in body.lower()
