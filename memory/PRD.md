# AgriFlow — Product Requirements Document

## Vision
Africa's agricultural financial infrastructure. Marketplace + wallet + escrow + logistics + AI + loans + analytics, launched Nigeria-first.
Tagline: **From Farm to Money.**

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

## Key business logic
- **Commission**: 5% of order total (env `COMMISSION_PCT`)
- **Loan interest**: set per-approval by admin (default 10%)
- **Referral bonus**: ₦5,000 each side on first completed order after referral signup
- **Max upload**: 5MB; allowed MIME: jpeg/png/webp/gif/pdf

## Demo credentials
See `/app/memory/test_credentials.md`.

## Deferred (Phase 3 backlog)

### P1
- Paystack / Flutterwave real payment rails
- Twilio phone OTP
- Transporter earnings / performance dashboard
- Real weather provider (currently mocked structure)
- WhatsApp onboarding deep links

### P2
- Insurance products + premium buyer subscriptions
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
