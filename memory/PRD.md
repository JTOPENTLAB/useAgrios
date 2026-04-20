# AgriFlow — Product Requirements Document

## Vision
Africa's agricultural financial infrastructure. Marketplace + wallet + escrow + logistics + AI, launched Nigeria-first.
Tagline: **From Farm to Money.**

## Core user roles
- **Farmer**: list produce, receive offers, get paid via escrow release.
- **Buyer**: browse marketplace, make offers / buy now, fund escrow.
- **Logistics partner**: accept pickup jobs, update status, earn payout.
- **Admin**: verify users, resolve disputes, monitor platform health.

## What's implemented (Feb 20, 2026) — Phase 1 MVP

### Backend (FastAPI + MongoDB, all under `/api`)
- JWT auth (signup/login/me), role-gated routes
- Listings CRUD + public browse with filters (q/crop/location/grade)
- Offers (create/list/accept/reject)
- Orders (create, fund-escrow, confirm-delivery) with escrow + commission logic
- Wallet + ledger (fund, payout, escrow_lock, escrow_release, refund, commission)
- Logistics jobs (auto-created on escrow fund; accept → picked_up → in_transit → delivered)
- Reviews (basic)
- Disputes (create + admin resolve: release/refund/split)
- Admin (overview metrics, users, verify, disputes)
- AI: price recommendation + video script (Claude Sonnet 4.5 via Emergent key)
- Seed: admin, demo farmer (with 3 listings), demo buyer (₦5M balance), demo logistics

### Frontend (React + Tailwind + shadcn)
- Landing page (hero, stats, features, how-it-works, CTA)
- Login with demo-account quick-pick
- Signup with role selector (farmer/buyer/logistics)
- AppShell with role-aware sidebar
- Farmer: dashboard, listings, new listing (with AI price), offers inbox, AI tools
- Buyer: marketplace (search+filters), product detail with buy-now/make-offer, orders
- Order detail: escrow timeline, activity, financials, dispute raise, confirm delivery
- Wallet: available/escrow/pending, fund, payout, full ledger table
- Logistics: jobs board with stage-change buttons
- Admin: overview (GMV, commission, metrics), users (verify), disputes (resolve)

### Design system
- Forest Green #0F5132, Gold #F59E0B, Charcoal #18181B on #FAFAFA
- Fonts: Cabinet Grotesk (headings) + Manrope (body)
- Rounded-2xl cards, soft shadows, staggered fade-up animations

## Key business logic
- Commission: 5% (configurable via env)
- Escrow: buyer → escrow (locked) → delivery → buyer confirms → farmer wallet (minus commission)
- Dispute resolutions: release_to_farmer | refund_buyer | split

## Demo credentials
See `/app/memory/test_credentials.md`.

## Prioritised backlog

### P1 — nice follow-ups
- Real payment gateway (Paystack/Flutterwave)
- OTP phone auth (Twilio)
- Image upload (object storage instead of URL)
- Ratings/reviews surfacing on profiles
- Push / email notifications

### P2 — Phase 2
- Loan applications + credit scoring
- Premium buyer subscriptions
- Demand forecasting dashboard
- Fraud monitoring

### P3 — Phase 3
- Crop insurance
- Multi-currency / cross-border
- Export workflows + warehousing
- USSD / SMS fallback
