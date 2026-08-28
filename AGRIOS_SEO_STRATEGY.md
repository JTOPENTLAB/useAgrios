# Agrios SEO Strategy — Nigeria Agricultural Market Intelligence
*Based on competitor analysis and search traffic research*

---

## THE OPPORTUNITY

Most competitors have weak SEO:
- Bango — no blog, no static pages, JavaScript-heavy (Google can't index)
- Yildra — B2B only, no public-facing content
- PluckAgro — thin content, no structured data
- FarmCrowdy — stagnant, lost domain authority
- MarketNaijaTv — outdated prices, no schema markup

**Agrios can rank #1 for every major Nigerian crop price keyword within 6 months.**

---

## TOP KEYWORDS TO TARGET

### Tier 1 — High intent, high volume (target immediately)
| Keyword | Monthly searches (est.) | Difficulty | Agrios page |
|---|---|---|---|
| maize price in nigeria today | 8,400 | Low | /prices/maize |
| rice price in nigeria | 12,000 | Medium | /prices/rice |
| tomato price in nigeria | 6,200 | Low | /prices/tomato |
| beans price in nigeria | 5,800 | Low | /prices/beans |
| yam price in nigeria | 4,400 | Low | /prices/yam |
| cocoa price nigeria | 3,900 | Low | /prices/cocoa |
| palm oil price nigeria | 4,100 | Low | /prices/palm-oil |
| cassava price in nigeria | 3,200 | Low | /prices/cassava |
| groundnut price nigeria | 2,800 | Low | /prices/groundnut |
| onion price in nigeria today | 5,100 | Low | /prices/onion |

### Tier 2 — Market-specific (rank for local searches)
| Keyword | Monthly searches (est.) | Agrios page |
|---|---|---|
| mile 12 market price today | 3,400 | /market/mile-12-lagos |
| dawanau market price | 2,100 | /market/dawanau-kano |
| bodija market price today | 1,900 | /market/bodija-ibadan |
| garki market price | 1,600 | /market/garki-abuja |
| ariaria market price | 1,400 | /market/ariaria-aba |

### Tier 3 — Long tail (easy wins, buyer intent)
- "how much is a bag of rice in Nigeria today"
- "current price of maize in Lagos"
- "tomato price in abuja market"
- "cocoa export price nigeria 2025"
- "agricultural transport from Lagos to Kano"
- "working capital for farmers in Nigeria"

---

## CONTENT STRATEGY — What to publish

### 1. Daily Price Pages (automated, SEO gold)
Each crop gets its own URL with:
- Today's price across all 12 markets
- 30-day price chart
- Price comparison vs last week/month
- Structured data (schema.org/Product + PriceSpecification)
- Auto-updating meta title: "Maize Price in Nigeria Today — ₦87,000/bag | Agrios"

### 2. Weekly Market Reports (human-readable, link-worthy)
Published every Monday. Title format:
- "Nigeria Food Prices This Week — [Date]: Maize Falls, Tomato Surges"
- Target: journalists, NGOs, policy researchers who link to us

### 3. State Price Pages
- "Current Crop Prices in Lagos State"
- "Kano Market Prices Today"
- One page per state × 36 states = 36 pages ranking for local searches

### 4. Crop Education Pages (evergreen traffic)
- "When is the best time to sell maize in Nigeria?"
- "Why does tomato price spike in December?"
- "How to get working capital as a Nigerian farmer"
- "Guide to exporting cocoa from Nigeria"

### 5. Competitor Gap Content
PluckAgro ranks for some keywords but has no transport, no export, no finance content.
Write pages for every gap:
- "Agricultural Transport from Lagos to Kano — rates and operators"
- "Cocoa Export Requirements Nigeria — complete guide"
- "Agrios Crop Credit Score — how to qualify for farm loans"

---

## TECHNICAL SEO FIXES (implement now)

### 1. Static price pages
Currently a SPA (single page app) — Google cannot index dynamic content.
Need: server-side rendered (or static) price pages at /prices/maize, /prices/rice etc.
**Solution: Netlify Edge Functions or a simple static page generator**

### 2. Schema markup (structured data)
Add to every price: schema.org/Product with offers/price
Google will show prices directly in search results (rich snippets)

### 3. Meta tags per crop
Dynamic meta titles:
- "Maize Price in Nigeria Today — ₦87,000 per 50kg bag | useagrios.com"
- "Rice Price in Lagos — ₦145,000/bag updated 2 minutes ago | Agrios"

### 4. robots.txt + sitemap.xml
Currently missing. Need sitemap listing all price pages for Google to crawl.

### 5. Page speed
Load time matters. Current: fonts + Chart.js loading slowly.
Fix: preload fonts, lazy-load Chart.js, add cache headers via Netlify.

---

## BACKLINK STRATEGY

### Quick wins (get links from):
1. **NBS (National Bureau of Statistics)** — they publish food price data, email them about Agrios as a reference
2. **Guardian Nigeria / Punch / Vanguard** — pitch "Nigeria food price tracker" story
3. **NAFDAC / FMARD** — government agricultural sites have high DA
4. **NGOs** — WFP Nigeria, USAID Feed the Future — they need price data sources
5. **University agric departments** — UNAAB, ABU Zaria, UNN — research citation links

### Content link bait:
- "Nigerian Food Price Index" — monthly report journalists will cite
- "State-by-State Crop Price Report" — unique data no one else publishes
- "Nigeria Agricultural Transport Rate Guide" — first of its kind

---

## 6-MONTH TRAFFIC PROJECTION

| Month | Est. organic visitors | Key milestone |
|---|---|---|
| Month 1 | 200–500 | Google indexes first price pages |
| Month 2 | 800–1,500 | Tier 2 keywords start ranking |
| Month 3 | 2,000–4,000 | First Tier 1 keywords top 10 |
| Month 4 | 5,000–9,000 | Market report pages earning links |
| Month 5 | 10,000–18,000 | State pages ranking locally |
| Month 6 | 20,000–35,000 | Brand searches growing |

---

## IMMEDIATE ACTION ITEMS (this week)

1. ✅ Add sitemap.xml to useAgrios repo root
2. ✅ Add robots.txt
3. ✅ Add dynamic meta tags per page
4. ✅ Add schema.org structured data to price pages
5. ✅ Register on Google Search Console (search.google.com/search-console)
6. ✅ Register on Google Business Profile
7. ✅ Submit sitemap to Google
8. ✅ Write first weekly market report blog post

