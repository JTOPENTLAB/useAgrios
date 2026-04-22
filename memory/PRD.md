# AGRIOS — Product Requirements Document

## Vision
Africa's agricultural financial infrastructure. Marketplace + wallet + escrow + logistics + AI + loans + analytics, launched Nigeria-first.
Tagline: **From Farm to Money.**

> Rebranded from AgriFlow → AGRIOS on Feb 2026. Seeded demo account emails intentionally retain the legacy `@agriflow.ng` domain for DB-seed idempotency (see `/app/memory/test_credentials.md`).

## Core user roles
- **Farmer** — list produce, receive offers, get paid, borrow.
- **Buyer** — source produce, fund escrow, track orders.
- **Logistics partner** — accept jobs, deliver, earn.
- **Admin** — verify users, resolve disputes, approve & disburse loans, monitor platform.

---

## What's implemented

### Phase 1 (Feb 20, 2026)
- JWT auth + role-gated routes + 4 seeded demo accounts
- Marketplace: listings CRUD, browse with filters (q/crop/location/grade)
- Offers: create/list/accept/reject
- Orders + escrow: buy-now → fund-escrow → delivery confirm → 5% commission split
- Wallet + immutable ledger (fund, escrow_lock, escrow_release, payout, commission, refund)
- Logistics jobs with state machine (pending → accepted → picked_up → in_transit → delivered)
- Reviews + disputes (release / refund / split resolutions)
- Admin: overview metrics, users, verify, disputes
- AI (Claude Sonnet 4.5 via Emergent key): price recommendation + video script
- Landing / Login / Signup with role selector
- Design system: forest green #0F5132 + gold #F59E0B + charcoal; Cabinet Grotesk + Manrope; rounded-2xl cards

### Phase 2 (Feb 20, 2026 — same day)
- **Object storage** (Emergent `objstore`): `/api/uploads` + `/api/files/{path:path}` — image upload in NewListing page
- **Loans**: full lifecycle — apply → credit-score → approve/reject → disburse → repay → schedule
  - Credit scoring (300–850, bands A–D): farm size, listings, completed orders, GMV, previous repayments, defaults, verification, disputes
- **Notifications system**: `/api/notifications` (+ bell in app header with unread badge). Auto-fires on: new offer, order funded, order completed, loan decisions, disbursement, repayment, referral bonus
- **Referral engine**: every user gets `AF-XXXXXX` code. Referred buyer's first completed order credits ₦5,000 to both sides + ledger entries + notifications
- **Analytics dashboard** (`/app/analytics`): Recharts bars for average price/kg and demand GMV per crop; mocked regional weather strip with alerts
- **Video script library** (`/app/farmer/videos`): 20 pre-baked templates with copy-to-clipboard
- **Landing upgrades**: "This is for you if…" persona grid + testimonials strip
- **Signup upgrades**: farm_size_hectares (farmer) + referral_code fields

### Design tokens
- Forest green `#0F5132`, Gold `#F59E0B`, Charcoal `#18181B` on `#FAFAFA`
- Fonts: Cabinet Grotesk (headings) · Manrope (body)
- Fixed: global `@keyframes fade-up` for af-stagger entry animation

---

### Phase H — Elite UI polish + stability (Feb 21, 2026)
- **FIXED P0 blocker**: `OpportunityDetail.jsx` was failing to compile due to duplicate `RISK_LABEL` identifier at line 460. Renamed the inner one to `RISK_TYPE_LABEL`. The whole React app was blank/timeout because of this one crash. `/trust` now renders in <3s.
- **Backend health probes**: Added `@app.get("/healthz")` + `@app.get("/health")` root routes + `@app.get("/api/healthz")` alias for ingress-based probes. All return `{ok:true, service:"agrios-api"}`.
- **Admin verify endpoint**: `POST /api/admin/users/{id}/verify` now accepts optional body `{verified: bool}` so admins can toggle OFF (revoke) as well as ON. Backward compatible (empty body ⇒ verify=true).
- **Opportunity detail hydration**: `GET /api/opportunities/{id}` now auto-hydrates `farm_updates` (real from `opportunity_updates`, or synthesised from age-based template), `risk_factors` (typed list: weather/market/execution/reporting w/ level by band), and `use_of_funds_breakdown` (4-bucket default — inputs 45%, labour 25%, logistics 15%, fee+buffer 15%). Tz-aware datetime normalization handled.
- **Public pages**:
  - **`/how-it-works`** (new `HowItWorks.jsx`) — 3 tabs (Farmer/Buyer/Investor), 4 steps per track, trust-strip, CTA. Linked from Landing nav (`nav-how-link`).
- **Authenticated pages**:
  - **`/app/admin/trust`** (new `AdminTrustOps.jsx`) — farmer verification board. Live trust-score % per farmer (6-badge composite), inline Verify/Revoke button per row, search filter, legend. Added to admin nav as "Trust ops".
  - **`/app/portfolio`** (rewritten `InvestorPortfolio.jsx`) — Risk allocation donut (A/B/C with legend) + Upcoming payouts strip (5 nearest-maturity rows with days-to-maturity countdown) alongside the existing KPI row + investments list.
- **Tests**: `/app/backend/tests/test_phase_g.py` — 10/10 pytest pass (health probes, opportunity hydration shape, admin verify toggle, tz-safe datetime handling).


## Key business logic
- **Commission**: 5% of order total (env `COMMISSION_PCT`)

### Phase I — Social proof · Maturity automation · KYC tiers · Logistics earnings (Feb 21, 2026)
- **New module** `/app/backend/routes/phase_h.py` (register() pattern, registered BEFORE phase_f so phase_f can consume KYC helpers).
- **Investor social proof**:
  - `GET /api/opportunities/{id}/social-proof` — last-24h investor count, volume, masked activity pills.
  - `GET /api/opportunities/recently-matured?limit=N` — public carousel; real matured/closed opportunities first, 3-entry synthesised fallback when none exist (real_count=0 flag surfaced).
  - Frontend: `<SocialProofStrip/>` on `OpportunityDetail` (emerald pulse strip with 3 masked amount·when pills), `<RecentlyMaturedCarousel/>` on `OpportunityMarketplace` and `InvestorHome`.
- **Maturity + payout automation** (admin):
  - `POST /api/admin/opportunities/{id}/mature` — flips opp + all active investments to `matured`, computes `realized_payout`, notifies each investor.
  - `POST /api/admin/opportunities/{id}/payout` — credits every matured investment to its investor's wallet, writes `investment_payout` ledger entries, flips opp to `closed`.
  - Frontend: `AdminOpportunities` page gains 2 new tabs (Matured · Closed), `mature-{id}` button on funded rows (prompts realized %), `payout-{id}` button on matured rows.
- **Investor KYC tier limits**:
  - `KYC_TIERS` config (unverified=₦0, bronze=₦500k, silver=₦5M, gold=₦100M).
  - `GET /api/investor/kyc-status` — current tier, used/remaining capacity, full tier ladder.
  - `POST /api/investor/kyc-upgrade` — auto-approved DEMO (no real KYC backend). Writes `kyc_upgrades` record + flips `users.kyc_tier`.
  - Enforcement in `POST /api/opportunities/{id}/invest` — tier check runs BEFORE remaining-target check for actionable error messaging.
  - Frontend: `<KycTierCard/>` on `InvestorPortfolio` with badge, usage bar, upgrade CTA (prompts for legal name + ID), 4-tier ladder.
  - Demo investor now seeded at `kyc_tier='silver'` so they can place meaningful investments out of the box.
- **Logistics partner earnings**:
  - `GET /api/logistics/earnings?days=30|90|180` — returns total_earned, period_earned, delivered_count, active_count, on_time_pct (2-day heuristic), weekly bucketed series.
  - Frontend: `/app/logistics/earnings` (new `LogisticsEarnings.jsx`) with KPI tiles + weekly bars + range toggles. Added to logistics nav sidebar.

### Phase J — Landing page social proof amplifier (Feb 21, 2026)
- **Backend** `GET /api/stats/landing-pulse` (public, no auth) — returns live aggregates with display floors (early-rollout feel): `invested_this_week`, `new_investors_this_week`, `new_investors_24h`, `gmv_this_week`, `cycles_closing_soon`, `active_cycles`, plus a `display_floor_applied` flag showing whether any real value was below its floor. Auto-refresh every 45s from the client.
- **`<LandingPulseTicker/>`** (new `/components/LandingPulseTicker.jsx`) — 4-cell live strip under the hero with pulsing green Live dot + icon-per-metric (₦ invested · new investors · cycles closing · GMV). Fetches `/api/stats/landing-pulse` directly (public). `data-testid="landing-pulse-ticker"` + per-cell testids (`pulse-invested`, `pulse-investors`, `pulse-closing`, `pulse-gmv`).
- **`<TestimonialsRail/>`** (new `/components/TestimonialsRail.jsx`) — 4 curated verified quotes (Farmer Bola, Investor Tunde, Buyer Ngozi, Farmer Segun) with role-colored chips, giant quote mark watermark, "track record" footer metric per card. Placed between `RecentDealsFeed` and the "What AGRIOS does" platform section.
- **Lint**: clean. Pages smoke-tested live on preview — pulse ticker renders ₦4.2M · 14 · 3 · ₦18.5M with pulsing "LIVE" dot; all 4 testimonial cards (`testimonial-q1..q4`) render on scroll.

- **Tests**: `/app/backend/tests/test_phase_h.py` — 12/12 pytest pass (social-proof shape, recently-matured fallback, KYC status+upgrade, KYC 403 enforcement, full mature→payout flow, logistics earnings shape, 4 regression endpoints).
- **Architecture decision**: Preferred extending via new `routes/phase_h.py` (register-pattern) instead of wholesale `server.py` refactor — zero risk to existing flows, fast to test. Full server.py split remains in P1 backlog.

- **Loan interest**: set per-approval by admin (default 10%)

### Phase K — High-conversion onboarding system + Google OAuth (Feb 21, 2026)
- **New `/app/backend/routes/phase_i.py`** module registered via register-pattern. Adds:
  - `POST /api/auth/google/session` — exchanges Emergent OAuth `session_id` for user profile via `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`, creates/updates user, sets httpOnly `session_token` cookie AND returns a JWT for existing flows. Stamps `onboarding_step=1` on new Google users, `5` on returning.
  - `POST /api/auth/logout` — clears cookie + purges `auth_sessions`.
  - `GET /api/onboarding/state` — `{step, total_steps:5, percent, role, profile, kyc_status, verified}`.
  - `PATCH /api/onboarding/profile` — merges role-specific profile fields (investor goal+risk, farmer farm_type+location+funding range, buyer commodity+volume). Auto-bumps step 1→2.
  - `POST /api/onboarding/advance` — increments step, caps at 5.
  - `POST /api/onboarding/complete` — sets step=5.
  - Existing `/api/auth/signup` now stamps `onboarding_step=1` on new password users too.
- **Rebuilt `/signup` page**:
  - URL params: `?role=investor|farmer|buyer|logistics` preselects card. `?next=/app/...` preserved through signup + Google OAuth.
  - Left column: dynamic subtext per role, 4 role cards (icon + desc), **primary full-width "Continue with Google"** button, divider, email form (name/email/password/country/referral), "Continue as [Role]" CTA, "Takes less than 60 seconds" + "Your data is secure and encrypted" trust notes.
  - Right column: sticky contextual gradient panel per role showing 3 context pills (avg allocation, cycle duration, transparent tracking for investor, etc.), Trust Center link.
  - **LinkedIn button** below form with "Investors" chip; click shows tooltip "LinkedIn sign-in is enabled for verified investor accounts. Full rollout coming soon."
- **New `/auth/callback` route** (`AuthCallback.jsx`) processes `#session_id=...` hash synchronously during render, POSTs to `/api/auth/google/session`, preserves `role` + `next` query params, navigates to `next` or `/onboarding/profile` for new users / `/app` for returning.
- **`AuthContext` hardened** to skip `/auth/me` check when `session_id` is in the URL hash (prevents race with AuthCallback). Added `applyGoogleSession()` helper.
- **New `/onboarding/*` route tree**:
  - `OnboardingShell` — sticky header with progress bar (5 gradient step chips), percent indicator, logout.
  - `OnboardingProfile` (step 1) — role-based: investor (goal + risk), farmer (farm type + location + funding range), buyer (commodity + volume). Minimal, instant save.
  - `OnboardingKYC` (step 2) — ID upload with camera capture on mobile, 5MB limit, **Skip** button, encrypted-at-rest reassurance.
  - `OnboardingWallet` (step 3) — gradient balance card, bank/card method toggle, quick-amount chips (₦5k/25k/100k/500k), fund via `/wallet/fund`, Skip button.
  - `OnboardingInvest` (step 4) — 3 featured opportunities from `/opportunities`, "Most investors start with ₦50,000" callout for investor role, Skip/Explore/Finish CTAs.
  - `OnboardingSuccess` (step 5) — celebratory state with CSS confetti, Go-to-dashboard + Browse-opportunities CTAs.
- **Deferred signup**:
  - New **public route `/opportunities/:id`** reuses `OpportunityDetail` (backend `/api/opportunities/{id}` is already public).
  - Unauthenticated "Invest" click → `/signup?role=investor&next=/app/opportunities/:id` with copy "Sign up to back this opportunity — takes under 60 seconds."
- **Auth playbook** saved at `/app/auth_testing.md` per integration playbook requirement.
- **Tests**: `/app/backend/tests/test_phase_i.py` — 9/9 pytest pass (signup → state, profile patch + step bump, advance cap, complete, google 401, logout, admin regression, investor regression).
- **Testing agent iteration 13**: 100% backend + 100% frontend. Full 5-step E2E walkthrough as new investor completed cleanly. All 12 signup testids verified. LinkedIn tooltip verified.

- **Referral bonus**: ₦5,000 each side on first completed order after referral signup
- **Max upload**: 5MB; allowed MIME: jpeg/png/webp/gif/pdf

## Demo credentials
See `/app/memory/test_credentials.md`.

### Phase 2d — Africa-first foundation + Social proof (Feb 21, 2026)
- **Country config registry** — Nigeria 🇳🇬 · Ghana 🇬🇭 · Kenya 🇰🇪 · Côte d'Ivoire 🇨🇮 with `code`, `currency` (NGN/GHS/KES/XOF), `symbol`, `phone_prefix`, `timezone`, `languages`, `flag`
- **Public `GET /api/countries`** endpoint
- **Country field** added to User, Wallet, Listing, Order (auto-inherited: signup→user, user→wallet, user→listing, listing→order). Defaults to `NG` for existing data.
- **Country picker** on signup (4 pill buttons with flags + currency code)
- **`fmtMoney(amount, currency)` helper** in `lib/api.js` (ready for future multi-currency rendering)
- **Live social-proof strip** on landing — pulsing LIVE dot + "Moved this week / Orders / Farmers onboarded / Countries live" backed by `GET /api/stats/public`. Animated count-up. Auto-refresh every 60s.

### Still pending (awaiting user keys)
- Paystack and/or Flutterwave (for card-based auto-renewal)
- Twilio OTP phone verification
- `server.py` split into `/routes/*` (deferred — ~2,000 lines now; next dedicated iteration)

### Phase 2e — FOMO + velocity signals (Feb 21, 2026)
- **Views counter** — `GET /api/listings/{id}` auto-increments `views`
- **Bookmark system** — `POST /api/listings/{id}/save` (buyer) toggles save; mirrors on user's `saved_listings[]` + listing's `saves` counter
- **Endpoints**: `GET /api/listings/trending` (top 6 by views) · `GET /api/listings/saved` (buyer's shortlist)
- **Sort options** on `GET /api/listings?sort=`: newest (default), trending (most viewed), price_low, price_high
- **Frontend**:
  - 🔥 "Trending now" strip at top of Marketplace with 6 thumbs + view overlay chips
  - Bookmark (save) button on every product card — filled green when saved
  - Social-proof strip on Product Detail: "👁 N views · 🔖 N saved · 🔥 Trending" (fires >5 views)
  - "Save for later" button in checkout panel
  - New `/app/buyer/saved` page + "Saved" nav tab
  - Sort dropdown on marketplace filter bar

### Phase 2f — One-click reorder (Feb 21, 2026)
- `POST /api/orders/{id}/reorder` — buyer-only; clones listing + qty + delivery address from past order, re-prices to current listing price, caps qty at available, creates new order, **auto-funds escrow if wallet has balance**, spawns logistics job, notifies farmer ("Repeat order received 🔁")
- Edge cases: sold-out / paused listings return 400; partial stock is auto-capped to available
- New orders carry `reorder_of: {original_order_id}` for analytics
- Frontend: green "Reorder" button on every completed order row + on Order Detail header — one tap navigates to the new order
- Tested: reorder of completed order #64749405 → new order #7cee0c3e auto-funded ₦850, escrow locked, logistics job spawned

### Phase 2g — Living deal feed (Feb 21, 2026)
- `GET /api/stats/recent-deals` — public; last 20 orders (escrow_funded+), anonymised: crop · qty · farmer initials (A.O.) · origin city · destination (first segment) · currency · status · seconds_ago
- Landing marquee: pulsing LIVE dot + horizontal infinite-scroll cards below hero, edge mask gradient, 40s loop, pause-on-hover
- Country flag emoji per deal; status icon (green ✓ for paid/delivered, blue truck for in-transit)
- Auto-refresh every 45s — feed stays alive even if a user idles

### Phase 2h — Hero-CTA escrow reassurance chip (Feb 21, 2026)
- Extended `/api/stats/public` with `escrow_locked_amount` (sum of all `wallets.escrow_held`) + `escrow_locked_count` (orders in `escrow_status: funded`)
- New `EscrowLockedBadge` component inline under the hero CTA row: pulsing shield icon + animated count-up of locked amount + order count
- Refreshes every 30s — concrete, live proof that real money is secured on-platform right at the decision point

### Phase 2i — First-order-free onboarding bonus (Feb 21, 2026)
- Buyer auto-credit on signup, per country: NG ₦5,000 · GH ₵50 · KE KSh 500 · CI CFA 3,000
- Stored as `signup_bonus_given: true` + `signup_bonus_amount` on user doc to prevent double-credit
- Ledger entry `signup_bonus` + welcome notification "₦5,000 added to your wallet"
- Gold banner on signup page when role=buyer selected, dynamic currency + amount per country pick
- Landing hero teaser chip "🎁 Buyers get ₦5,000 on signup" under the CTA

### Phase 2j — SEO, OpenGraph, Twitter cards, structured data (Feb 21, 2026)
- Comprehensive meta tags in `public/index.html`: title, description, keywords, canonical URL
- **OpenGraph** suite — `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (1200×630), `og:image:width/height`, `og:image:alt`, `og:locale` + `og:locale:alternate` for en_NG / en_GH / en_KE / fr_CI
- **Twitter Card** — `twitter:card=summary_large_image`, title, description, image, site, creator
- **JSON-LD structured data** — Organization schema + WebSite schema with SearchAction (Google Sitelinks search box)
- `/public/manifest.json` with brand theme color, standalone display, categories (business/finance/food)
- `/public/robots.txt` + `/public/sitemap.xml` (3 public routes)
- `useDocumentMeta` hook — updates `<title>` + description per route (Landing / Login / Signup all have unique titles now)
- Verified: WhatsApp/Twitter/LinkedIn scraper previews will now show the AgriFlow brand, tagline "From Farm to Money", and a farmer hero image

### Phase 2k — AgriFlow → AGRIOS rebrand + Public `/explore` (Feb 2026)
- **Rebrand** — all user-facing strings "AgriFlow" → "AGRIOS" across `Landing`, `Login`, `Signup`, `AppShell`, `Explore`, `RecentDealsFeed`, `FarmerListings`, `Wallet`, `BuyerPlans`, `ProductDetail`, `public/index.html` (OG + JSON-LD + title + meta), `public/manifest.json`. Backend `FastAPI` title + logger name updated to AGRIOS.
- **LocalStorage keys** (`agriflow_token`/`agriflow_user`) intentionally preserved to avoid forcing existing users to re-login.
- **Seeded demo emails** (`admin@agriflow.ng`, etc.) intentionally preserved for DB seed idempotency — documented in `test_credentials.md`.
- **Public `/explore` page** (`frontend/src/pages/Explore.jsx` + route in `App.js`) — unauthenticated users see 12 latest listings from `GET /api/listings`, country flags per card, search input with `?q=` filter, every card + CTA links to `/signup?ref=explore` for attribution. Added to `sitemap.xml` (priority 0.95, changefreq=hourly).
- **Landing nav** — new "Explore" link added as first nav item.
- **`/api/stats/recent-deals` hardening** — now excludes `TEST_`-prefixed crops from the public social-proof feed (prevents test data leakage into production marquee).

### Phase 2l — Per-listing OG social cards + shareable public pages (Feb 2026)
- **Backend `GET /api/p/{listing_id}`** — returns full OG-tagged HTML scraped by WhatsApp/Twitter/Facebook/Slack/LinkedIn. Includes `og:type=product`, `og:title` (crop + price), `og:description`, `og:image` (1200×630), `og:url`, Twitter Card `summary_large_image`, `product:price:amount` + `product:price:currency`, and JSON-LD `Product` schema with `offers.price` + `offers.priceCurrency`. Humans get `<meta http-equiv="refresh">` + `window.location.replace()` auto-redirect to the SPA listing page.
- **Backend `GET /api/sitemap-listings.xml`** — dynamic sitemap of all active listings for Google/Bing crawl. Cached 15 min. Referenced from `robots.txt`.
- **Frontend `/listing/:id`** (new `PublicListing.jsx`) — public, unauthenticated listing detail page: hero image, country flag chip, crop title, price, qty, farmer info, view/save counts, trust rail (escrow/logistics/wallet), "Sign up to place order" CTA (`?ref=listing-{id}`), "I already have an account" login CTA (`?next=/app/marketplace/{id}`), native `navigator.share` with clipboard fallback ("Link copied"), dynamic `document.title` per listing.
- **`/explore` cards** — now link to `/listing/:id` (not `/signup`) so people landing from a shared link see full detail. Top/bottom CTAs still funnel to signup with `?ref=explore` attribution.
- **New env**: `PUBLIC_SITE_URL` in `backend/.env` (used for canonical URLs in OG tags; falls back to incoming Host header).
- **Tests**: `/app/backend/tests/test_social_share.py` — 9/9 pytest cases pass. Frontend tested via Playwright, 100% pass.

### Phase A — Premium Africa-first repositioning (Feb 2026)
- **Repositioning**: Landing, `index.html` meta, OG, Twitter cards, app tagline, and footer copy all updated to **"The Operating System for Agricultural Trade"** (with subtext "Powering agricultural trade and money flow across Africa"). Replaces the older "From Farm to Money" line everywhere user-visible.
- **BuyerHome** (new `/app/home` — now the default buyer landing route, AppShell nav updated): stat cards (Total Spend · Active Orders · Saved Suppliers), Hot Demand strip, Featured Verified Suppliers carousel, marketplace feed, trending + demand-signals cards, recent orders teaser.
- **Farmer dashboard reorder**: new hero — large gradient **Wallet + Escrow** card on top with big balance, "Funds protected until delivery is confirmed", In-escrow / Pending-payout / Lifetime tiles, CTA buttons. Then Earnings-this-week / Active-orders / Pending-offers stats. Then "Sell crop" CTA + active listings list. Then Hot Demand + Smart suggestions + Market insights + Notifications + quick-action inbox.
- **Wallet redesign** (bank-grade): gradient balance card with big currency-aware balance, prominent Deposit / Withdraw action buttons, escrow-held / pending-payout / total-capacity strip, trust rail (Protected transactions · Fast payouts · Immutable ledger), deposit drawer (quick-amount chips), withdraw drawer (bank account + amount), escrow status card, immutable transaction history.
- **Product Card upgrade** (new shared `ProductCard.jsx`) — used on Marketplace, Explore, BuyerHome, SavedListings: image, country flag, crop + grade, verified badge, **RatingPill (★ 4.X (N))**, **DeliveryBadge (🚚 2–3 days)**, large bold price, qty, farmer pill, optional bookmark toggle.
- **TrustStrip** (new reusable) — "Protected by AGRIOS escrow · Funds are held securely until delivery is confirmed" banner; rendered on BuyerHome, Marketplace, ProductDetail, Wallet, FarmerDashboard (compact variant).
- **Promote with Video** — farmer listings page adds a per-listing CTA that deep-links to `/app/farmer/videos?crop=<crop>&listing_id=<id>`. VideoScripts page now shows a prefill banner, reorders templates to surface crop-relevant ones, and the copy-to-clipboard text swaps `[crop]` placeholders with the real crop name.

### Phase B — Intelligence, discovery & growth loops (Feb 2026)
- **Live Hot Demand** (`GET /api/insights/hot-demand`) — aggregates orders over last 30 days with WoW % change; enriches each crop with active-listings price range; TEST_ crops filtered. Wired into BuyerHome, FarmerDashboard, and Marketplace (compact variant). Graceful fallback to top-viewed listings if no order history.
- **Featured Verified Suppliers** (`GET /api/insights/featured-suppliers`) — verified farmers ranked by completed_orders + rating (real reviews when present, deterministic placeholder when not). Horizontal snap-scroll cards on BuyerHome.
- **Recommendations** — `GET /api/recommendations/product/{id}` (same-crop + same-region), `GET /api/recommendations/for-farmer` (price guidance vs market median/p75 + hot-crops-not-yet-listed), `GET /api/recommendations/for-buyer` (popular-in-region + buyers-like-you). Rendered on ProductDetail + FarmerDashboard.
- **Recently Viewed** (`components/RecentlyViewed.jsx`) — localStorage-backed, zero network. Push happens on every visit to `/app/marketplace/:id` and `/listing/:id`. Rendered on BuyerHome.
- **Seed hardening** — all seeded listings now carry `country_code='NG'` + `currency='NGN'`; backfill migration added on startup for any legacy rows.
- **Marketplace** gets a live Hot Demand banner above filters + compact trust strip.
- **Tests** — `/app/backend/tests/test_phaseab.py` 17/17 pytest cases pass. Iteration 6 frontend regression test 100% green (/explore + FarmerDashboard + BuyerHome + Wallet + Promote-with-Video flow + ProductRecommendations).

### Phase C — AGRIOS Market Pulse (weekly digest engine) (Feb 2026)
- **Composer** (`/app/backend/services/digest.py`) — per-user personalized payload: top hot crops (30-day velocity + WoW % + price range), featured verified suppliers (buyers) or price-guidance vs market median/P75 + hot-crops-not-listed (farmers), new listings in user's country this week, smart headline + CTA, WhatsApp share text, full branded HTML email template.
- **Pluggable sender**: default writes to `digest_log` collection + console log (MOCK). Flip to real Resend by setting `RESEND_API_KEY` + optional `RESEND_FROM` env vars — zero code change required. `httpx` calls Resend on-demand; failures captured in the log entry.
- **Endpoints** (all `/api/digest/*`):
  - `GET /preview` — authenticated user previews their own next digest
  - `GET /prefs` + `PUT /prefs` — opt-in/out toggles (`{email, frequency}`)
  - `POST /send-me-now` — self-test; writes to log + returns WhatsApp share URL
  - `POST /trigger` — admin-only blast to all opted-in buyers + farmers
  - `GET /log` — admin-only audit trail
- **Scheduler** — asyncio background loop inside FastAPI; fires blast once every Monday 08:00 UTC (09:00 WAT), guarded by `system.digest_last_run` doc so a restart doesn't double-send.
- **Frontend** (`/app/digest` route, nav item "Market Pulse" for farmer + buyer): delivery preference toggle, live preview of headline + hot crops + suppliers + WhatsApp text, Send-me-a-test, Share-via-WhatsApp (`wa.me`), Copy-text, mock-mode notice. BuyerHome has a promo card linking to the digest page.
- **Tests**: `/app/backend/tests/test_phase_c_digest.py` — 12/12 pytest cases pass. Iteration 7 frontend 6/6 pass. Zero open issues.

### Phase D — Config layer + richer Market Pulse templates (Feb 2026)
- **Env expansion** — `.env` now structured into APP · EMAIL · WHATSAPP · PAYMENT · CRON · SUPPORT · FEATURE_FLAGS · COUNTRY sections. New provider switches: `EMAIL_PROVIDER=mock|resend|sendgrid`, `WHATSAPP_PROVIDER=share_only|twilio`, `PAYMENT_PROVIDER=mock|flutterwave|paystack`. 9 feature flags (FEATURE_MARKET_PULSE, FEATURE_WHATSAPP_SHARE, FEATURE_EMAIL_DIGEST, FEATURE_LOANS, FEATURE_ESCROW, FEATURE_VIDEO_PROMOTION, FEATURE_HOT_DEMAND, FEATURE_REAL_PAYMENTS, FEATURE_REAL_WHATSAPP_PUSH). Stack is Python/FastAPI + MongoDB + React/CRA so Node-ism keys like `NODE_ENV` → `APP_ENV`, `DATABASE_URL` → kept as `MONGO_URL` (protected), `NEXT_PUBLIC_*` → exposed via new `/api/config` endpoint.
- **Config service** (`/app/backend/services/config.py`) — typed settings reader, computes "effective" provider (fallback to `mock` when API key missing), exposes `public_config()` for frontend.
- **`GET /api/config`** — unauthenticated endpoint returning app meta + country/currency list + provider states + feature flags + market-pulse schedule. Frontend reads this on the Digest page to show live provider badges.
- **Richer digest composer** (`services/digest.py` rewritten) now includes:
  - `regional_price_snapshot[]` — top region per hot crop with price range + listing count
  - `new_verified_suppliers[]` — verified farmers who posted listings this week (count + crops)
  - `price_guidance_delta[]` — week-over-week median price change per hot crop
  - `active_buyers` — count of distinct buyers who ordered in last 7d
  - Three-variant **subject line rotation** keyed by `md5(user_id) % 3` for stable A/B bucketing
  - **Role-specific email HTML** matching the user's spec (Top Signal · Top 5 Crops · Regional Snapshot · New Suppliers · Price Guidance Delta · Verified Buyer Activity · CTA)
  - **Plain-text alternate** for RFC 8058 deliverability
  - **Dormant-user reactivation** template — users with `last_login_at > 30d` get a softer re-engagement headline + WA text
- **WhatsApp 3 variants** — buyer / farmer / dormant, auto-selected by role + dormancy. Farmer fallback ensures ≥2 bullets so messages never feel thin.
- **Pluggable sender** — `send_email()` now dispatches via `EMAIL_PROVIDER` switch; Resend + SendGrid both implemented; plain-text + html multipart. Missing API key auto-degrades to mock + logs a hint in the audit row.
- **Scheduler hardening** — respects `ENABLE_CRON` + `FEATURE_MARKET_PULSE` flag + configurable `MARKET_PULSE_CRON_HOUR_UTC`.
- **Tests**: 15/15 pytest + 100% frontend (iteration 8). One minor projection fix (text_bytes missing from /api/digest/log) caught + fixed in-iteration.

### Phase D — Scale + Moat (Feb 2026)
- **Liquidity signals** — `GET /api/liquidity/listing/{id}` + `<LiquiditySignals/>` block on ProductDetail + inline "viewing" pulse on ProductCard. Surfaces recent_viewers / orders_this_week / active_suppliers / same-country suppliers to drive urgency.
- **Supplier performance score** — `GET /api/suppliers/{id}/performance` (composite 0–100 · band A–D · badges: verified_pro · top_supplier · rising_star · trusted_by_buyers · metrics: completed_orders, gmv, unique_buyers, repeat_buyer_count, active_listings, avg_rating, on_time_pct, disputes, best_crops). New `<SupplierScoreCard/>` rendered on FarmerDashboard.
- **Farmer earnings intelligence** — new `/app/farmer/earnings` page (`FarmerEarnings.jsx`). Weekly GMV line chart, top 5 crops bar chart, top regions ranking, repeat-buyers grid. Backed by `GET /api/farmer/earnings?days=30|90|180`. Nav added under Farmer.
- **Price alerts** — buyer CRUD at `POST/GET/DELETE /api/alerts/price` + new `/app/buyer/alerts` page. Alerts match on crop + country + max_price + min_qty; auto-fire notification on `POST /api/listings` through `_check_alerts_for_listing(doc)` hook. Uses `re.escape()` to guard against regex metachars in crop names.
- **Market Intelligence v2** — new `/app/market` page (`MarketIntel.jsx`). Daily median price-trend area chart, region×crop demand heatmap (darker cells = more GMV), hot-crops strip. Backed by `GET /api/market/price-trend` (series + snapshot + wow_pct) and `GET /api/market/demand-heatmap` (rows × cells matrix). Accessible to buyer + farmer + admin.
- **Growth invite** — `GET /api/growth/invite` returns user's referral code, signup link (with `?ref=`), referred count, and pre-baked WhatsApp text.
- **Admin KPIs** — `GET /api/admin/kpis` (admin-only) returns gmv_7d/30d, escrow_locked, active_farmers/buyers_7d, repeat_buyers, loan_volume, price_alerts_active. New KPI row added to AdminDashboard.
- **Architecture** — new `/app/backend/routes/phase_d.py` module attached via `register(api, db, ...)` pattern to avoid further bloating server.py.
- **Tests**: `/app/backend/tests/test_phase_d.py` — 20/20 pytest pass. Iteration 10 frontend 95%.

### Phase E — Engineering Polish (Feb 2026)
- Real `recent_viewers` from `listing_views` collection (10-min TTL) — replaces heuristic; `GET /api/listings/{id}` logs view event per X-Forwarded-For.
- Supplier score history — `supplier_score_history` collection captures daily snapshots; response adds `score_version: 1` + `score_delta_30d`; new `GET /api/suppliers/{id}/score-history`.
- `<Skeleton>` / `<CardSkeleton>` / `<ChartSkeleton>` primitives wired into MarketIntel (trend bars + heatmap) and FarmerEarnings (weekly chart).
- SupplierScoreCard renders "+N/-N · 30d" pill when delta available.

### Phase F — Investor Marketplace (Feb 2026)
- New user role `investor` + `/app/backend/routes/phase_f.py` module.
- Endpoints: `POST /opportunities` (farmer) · `GET /opportunities` (public) · `GET /opportunities/mine` (farmer) · `GET /opportunities/{id}` · `POST /opportunities/{id}/approve|reject` (admin) · `POST /opportunities/{id}/invest` (investor) · `GET /investments/mine` · `GET /investments/summary`.
- Status lifecycle: opportunity `review → open → funded → active → closed` · investment `active → matured → paid`.
- Frontend: `InvestorHome`, `OpportunityMarketplace`, `OpportunityDetail`, `InvestorPortfolio`.
- Signup now offers 4 role cards; landing adds a 3rd "For Investors" section.
- Seed: `investor@agriflow.ng / Invest@123` (₦2M wallet) + 3 demo opportunities.
- Tests: `test_phase_f.py` (4/4 pass).

### Phase G — Marketplace loop closure (Feb 2026)

- **New user role: `investor`** added to `Role = Literal[...]`. Signup page now offers 4 role cards: Farmer · Buyer · Investor · Logistics.
- **Admin Opportunity Review UI** — `/app/admin/opportunities` (`AdminOpportunities.jsx`). Tabbed queue (Pending review / Open / Funded / Rejected) with Approve + Reject buttons calling existing `/api/opportunities/{id}/approve|reject`. Notifications fire to farmer automatically.
- **Farmer "Raise Funding" form** — `/app/farmer/fund` (`FarmerRaiseFunding.jsx`). Full form: title · crop · region · duration · funding target · min ticket · target return % · risk-band picker (A/B/C) · use-of-funds. POSTs to `/api/opportunities`, redirects to `/app/farmer/funding-requests`.
- **Farmer Funding Requests list** — `/app/farmer/funding-requests` (`FarmerFundingRequests.jsx`). Uses `GET /api/opportunities/mine`. Status pills · raise progress bar · investor count · empty-state CTA.
- **Investor Risk Acknowledgement modal** — `<RiskAcknowledgementModal/>` gate on first invest. Stores `agrios_investor_ack_v1` in localStorage. 3 protection points + 2 required checkboxes. Modal mounted in `OpportunityDetail.jsx`; blocks first invest, then calls `doInvest()` on confirm.
- **Nav wiring** — Farmer "Raise funding" → `/app/farmer/funding-requests`. Admin "Opportunities" → `/app/admin/opportunities`.
- **Lint**: clean. No new pytest (endpoints already tested in `test_phase_f.py`).

- **New module** `/app/backend/routes/phase_f.py` attached via register() pattern — no bloat to server.py.
- **Opportunities lifecycle** — farmer creates (status=review) → admin approve/reject → open → funded. Endpoints: `POST /api/opportunities` (farmer), `GET /api/opportunities` (public, excludes review/rejected), `GET /api/opportunities/mine` (farmer), `GET /api/opportunities/{id}` (hydrates investments sample), `POST /api/opportunities/{id}/approve|reject` (admin).
- **Investment flow** — `POST /api/opportunities/{id}/invest` (investor) debits wallet, creates investment doc, updates opportunity counters, flips to `funded` when fully raised, fires notifications for both farmer + investor. Status lifecycle on investment: active → matured → paid.
- **Portfolio** — `GET /api/investments/mine` (hydrates opportunity title/crop/region/status) · `GET /api/investments/summary` (total_invested, expected_returns, realized_returns, active/matured/paid counts, by_risk_band breakdown).
- **Frontend pages** (under `/app/frontend/src/pages/investor/`):
  - `InvestorHome.jsx` — Portfolio hero (dark brand gradient with N0 until investments placed), Risk-mix mini-bars, Investable wallet tile, Featured open opportunities grid. Route: `/app/investor`.
  - `OpportunityMarketplace.jsx` — Search + risk filter (A/B/C/All) + card grid. Route: `/app/opportunities`. Accessible to investor + admin + farmer + buyer (farmers use to "Raise funding").
  - `OpportunityDetail.jsx` — Left column: description, metrics (return/duration/min ticket), funding progress bar, risk disclosure callout, use of funds, farmer card. Right column: sticky Invest panel with quick-amount chips + expected-payout preview + "Invest from wallet" CTA. Route: `/app/opportunities/:id`.
  - `InvestorPortfolio.jsx` — 4 KPI tiles + investments list with status pill, expected payout, maturity date. Route: `/app/portfolio`.
  - Shared `OpportunityCard` exported from InvestorHome (reused in marketplace).
- **Landing page** — added 3rd role card "For Investors" (emerald border-left) alongside Farmer + Buyer with `investor-cta` testid + heading rewritten to "Built for farmers, buyers, and investors."
- **Nav** — AppShell adds `investor` role array (Home · Opportunities · Portfolio · Wallet · Market Pulse). Farmer nav gets "Raise funding" entry (links to /app/opportunities). Admin gets "Opportunities" entry (review queue).
- **RoleHome** routes investor role → `/app/investor`.
- **Seed data** — demo investor (`investor@agriflow.ng` / `Invest@123`, ₦2M wallet balance) + 3 demo opportunities (Cassava · Tomato · Rice — risk A/B/C, various durations) seeded on startup if no opportunities exist.
- **Tests** — `/app/backend/tests/test_phase_f.py` (4/4 pass) · aggregate suite 28/28 pass.


- **Landing page fully rewritten** (see above) — global infrastructure positioning, 13-section structure.
- **Real `recent_viewers`** — new `listing_views` collection with 10-min TTL index. `GET /api/listings/{id}` now logs a view event keyed by `X-Forwarded-For` (first hop) or User-Agent hash. `/api/liquidity/listing/{id}` returns `distinct(viewer_id)` within last 10 min instead of the previous deterministic `views // 8` heuristic. Note: `at` field MUST be a real `datetime` (not `utcnow()` string) so `$gte` queries + TTL work correctly.
- **Supplier score history** — new `supplier_score_history` collection. Every call to `/api/suppliers/{id}/performance` snapshots `{supplier_id, captured_at, score, band, completed_orders, gmv, avg_rating, score_version}`. Response now includes `score_version: 1` + `score_delta_30d` (difference vs snapshot ≥30 days ago, `null` on cold start). New `GET /api/suppliers/{id}/score-history?days=7..365` returns per-day series for trend charts.
- **SupplierScoreCard UI** — shows "+N / 30d" pill in emerald/red next to score when delta available (data-testid="score-delta-30d").
- **Loading skeletons** — new `/app/frontend/src/components/Skeleton.jsx` (Skeleton, CardSkeleton, ChartSkeleton). Wired into MarketIntel (price-trend bar skeleton + heatmap row skeleton) and FarmerEarnings (weekly-chart skeleton). No more "Loading…" text.
- **Tests**: `/app/backend/tests/test_phase_e.py` — 4/4 pytest pass (real viewer count, score_version/delta field, score-history endpoint shape, 404 on liquidity).

 — `GET /api/liquidity/listing/{id}` + `<LiquiditySignals/>` block on ProductDetail + inline "viewing" pulse on ProductCard. Surfaces recent_viewers / orders_this_week / active_suppliers / same-country suppliers to drive urgency.
- **Supplier performance score** — `GET /api/suppliers/{id}/performance` (composite 0–100 · band A–D · badges: verified_pro · top_supplier · rising_star · trusted_by_buyers · metrics: completed_orders, gmv, unique_buyers, repeat_buyer_count, active_listings, avg_rating, on_time_pct, disputes, best_crops). New `<SupplierScoreCard/>` rendered on FarmerDashboard.
- **Farmer earnings intelligence** — new `/app/farmer/earnings` page (`FarmerEarnings.jsx`). Weekly GMV line chart, top 5 crops bar chart, top regions ranking, repeat-buyers grid. Backed by `GET /api/farmer/earnings?days=30|90|180`. Nav added under Farmer.
- **Price alerts** — buyer CRUD at `POST/GET/DELETE /api/alerts/price` + new `/app/buyer/alerts` page. Alerts match on crop + country + max_price + min_qty; auto-fire notification on `POST /api/listings` through `_check_alerts_for_listing(doc)` hook. Uses `re.escape()` to guard against regex metachars in crop names.
- **Market Intelligence v2** — new `/app/market` page (`MarketIntel.jsx`). Daily median price-trend area chart, region×crop demand heatmap (darker cells = more GMV), hot-crops strip. Backed by `GET /api/market/price-trend` (series + snapshot + wow_pct) and `GET /api/market/demand-heatmap` (rows × cells matrix). Accessible to buyer + farmer + admin.
- **Growth invite** — `GET /api/growth/invite` returns user's referral code, signup link (with `?ref=`), referred count, and pre-baked WhatsApp text.
- **Admin KPIs** — `GET /api/admin/kpis` (admin-only) returns gmv_7d/30d, escrow_locked, active_farmers/buyers_7d, repeat_buyers, loan_volume, price_alerts_active. New KPI row added to AdminDashboard.
- **Navigation** — AppShell adds: Earnings (farmer), Market intel (farmer+buyer), Price alerts (buyer). BuyerHome gains two discovery promos (Price alerts + Market intel).
- **Architecture** — new `/app/backend/routes/phase_d.py` module attached via `register(api, db, ...)` pattern to avoid further bloating server.py.
- **Tests**: `/app/backend/tests/test_phase_d.py` — 20/20 pytest pass. Iteration 10 frontend 95% (minor testid cosmetic gaps fixed post-iteration). Price-alert auto-trigger end-to-end verified: buyer alert → farmer listing → notification fired + triggered_count incremented.

## Phase D still open / backlog
### P1
- Upgrade recent_viewers from heuristic (views//8) to real ephemeral view-events with TTL index
- Persist supplier score snapshots for trend analysis ("Your score improved +12 this month")
- Loading skeletons on MarketIntel + FarmerEarnings

### P2
- Buyer bulk-order templates (save cart: crop + qty + cadence)
- Supplier comparison view (side-by-side)
- Buyer pay-later / invoice financing
- Contract orders / volume discounts (enterprise B2B layer)
- Country switcher UI (backend multi-country already ready)



### P1
- Paystack / Flutterwave real payment rails
- Twilio phone OTP
- Transporter earnings / performance dashboard
- Real weather provider (currently mocked structure)
- WhatsApp onboarding deep links

### P2
- Insurance products + premium buyer subscriptions
## Deferred (Phase 3 backlog)

- Demand forecasting ML model
- Admin fraud flags + watchlist
- Signed URLs for sensitive uploads (currently `/api/files/{path}` is public-by-obscurity)
- Multi-language support (Yoruba, Hausa, Igbo, French, Swahili)

### P3
- Cross-border payments + multi-currency
- Export readiness workflows
- Warehousing / cold-chain integrations
- USSD / SMS / feature-phone fallback
- Split server.py into routers (/routes/loans, /routes/uploads, /routes/analytics)

## Pitch deck
See `/app/docs/pitch.md`.

### Phase 2c — Retention + Compliance + Real Weather (Feb 21, 2026)
- **Auto-renewal reminder** — `/api/auth/me` checks subscription expiry; if ≤3 days, fires a one-time notification per expiry date (idempotent via `ref=renew:{tier}:{expiry_date}`)
- **Signed URLs for sensitive uploads** — PDFs auto-tagged `sensitive: true`, stored under `agriflow/uploads/private/...`. Download requires `?sig=<hmac>&exp=<ts>` query params (1h TTL). Public images under `agriflow/uploads/public/...` unchanged. New endpoint `POST /api/files/{path}/sign` for owners/admins to mint fresh URLs.
- **Live weather** via Open-Meteo (free, no key) — Ogun, Benue, Oyo, Kano, Kaduna. 30-min DB cache. Real temp + rainfall + humidity + alerts (low rainfall, heavy rain, heat stress). Frontend badge: "Live · Open-Meteo".

### Still pending (awaiting user keys)
- Paystack and/or Flutterwave (for card-based auto-renewal)
- Twilio OTP phone verification
- `server.py` split into `/routes/*` (deferred — 1,946 lines now; next dedicated iteration)
- `/api/subscriptions/plans` (Basic free · Professional ₦25k · Enterprise ₦100k)
- `/api/subscriptions/me` · `/api/subscriptions/subscribe` · `/api/subscriptions/cancel`
- Wallet-backed billing: debits wallet on subscribe, ledger entry `subscription_fee` + platform `subscription_revenue`, 30-day expiry
- `/api/auth/me` surfaces `subscription_tier` + `subscription_expires_at`
- New page `/app/buyer/plans` with 3-tier pricing cards
- Marketplace header: "Upgrade to Pro" CTA for basic users · Pro/Enterprise badge for subscribers
- Nav: "Plans" tab for buyer
