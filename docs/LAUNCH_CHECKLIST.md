# AGRIOS Production Launch Checklist (Nigeria-first)

> Nigeria is the first live market. Architecture stays Africa-ready (GH · KE · CI).

Go through every section top-to-bottom. Check the box when verified against the staging or production preview.

---

## 1. Environment variables (`/app/backend/.env`)

### Core
- [ ] `APP_ENV=production`
- [ ] `PUBLIC_SITE_URL=https://app.agrios.africa` (or your real domain)
- [ ] `JWT_SECRET` rotated (32+ chars, cryptographically random)
- [ ] `MONGO_URL` points at managed MongoDB with daily backups
- [ ] `CORS_ORIGINS` locked to your production domains (not `*`)

### Payments
- [ ] `PAYMENT_PROVIDER=flutterwave` (or `paystack`)
- [ ] `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_PUBLIC_KEY` set
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET` matches the `secret_hash` configured in the Flutterwave dashboard
- [ ] Webhook URL registered with provider: `https://api.agrios.africa/api/payments/flutterwave/webhook`
- [ ] Test-mode keys verified end-to-end, then switched to live keys
- [ ] `FEATURE_REAL_PAYMENTS=true` (only after all above verified)

### Email
- [ ] `EMAIL_PROVIDER=resend` (or `sendgrid`)
- [ ] `RESEND_API_KEY` set
- [ ] `RESEND_FROM` uses your own verified domain (e.g. `AGRIOS <no-reply@agrios.africa>`)
- [ ] DKIM + SPF + DMARC records published for `agrios.africa`
- [ ] `EMAIL_REPLY_TO` goes to a monitored inbox
- [ ] Test digest send delivered to real inbox with good deliverability score

### Market Pulse cron
- [ ] `ENABLE_CRON=true`
- [ ] `FEATURE_MARKET_PULSE=true`
- [ ] `MARKET_PULSE_CRON_HOUR_UTC=8` (= 09:00 Africa/Lagos)
- [ ] Admin triggered one `POST /api/digest/trigger` successfully in staging

### Observability
- [ ] `SENTRY_DSN` populated (when wired; currently env-reserved only)
- [ ] `LOG_LEVEL=info`
- [ ] Backend logs shipped to centralized store

### Feature flags
- [ ] `FEATURE_MARKET_PULSE=true`
- [ ] `FEATURE_WHATSAPP_SHARE=true`
- [ ] `FEATURE_EMAIL_DIGEST=true`
- [ ] `FEATURE_ESCROW=true`
- [ ] `FEATURE_LOANS=true` (or `false` if you launch without loans)
- [ ] `FEATURE_REAL_WHATSAPP_PUSH=false` (keep `share_only` until Meta approval)

---

## 2. Admin account

- [ ] Production admin user created (NOT the seeded `admin@agriflow.ng`)
- [ ] Strong password stored in team password manager
- [ ] MFA enabled at email-provider level (since we haven't added in-app MFA yet — documented in roadmap)
- [ ] `/app/memory/test_credentials.md` deleted or replaced with staging-only creds
- [ ] Seed script does not run against production DB

---

## 3. Payment flow — end-to-end dry run

Run against **live provider keys** with a real test card provided by Flutterwave/Paystack.

- [ ] `POST /api/payments/initialize` returns `authorization_url`
- [ ] Hosted checkout loads
- [ ] After successful test card → `GET /api/payments/verify/{ref}` returns `status: success`
- [ ] Wallet balance credited (verify in ledger: `kind=wallet_funding`, `direction=credit`)
- [ ] Webhook received; `webhook_events` collection shows `status=processed`
- [ ] **Webhook replay** — replay the same event, verify `{duplicate:true}` response; no double-credit
- [ ] Invalid signature test → 401 + `status=signature_rejected` in `webhook_events`

---

## 4. Escrow state machine

- [ ] Create test order → `escrow_status=pending`
- [ ] Fund escrow via `POST /api/orders/{id}/fund-escrow` → `escrow_status=funded` + ledger `escrow_lock` entry
- [ ] Admin release via `POST /api/admin/escrow/{order_id}/transition` with `{to:"released", reason:"Delivery confirmed"}` → `admin_audit` row inserted
- [ ] Invalid transition (`released → funded`) returns 400
- [ ] Dispute path: `funded → disputed → refunded` tested
- [ ] Partially-released path: `held → partially_released → released` tested

---

## 5. Payout flow

- [ ] Farmer requests payout via `POST /api/wallet/payout`
- [ ] Payout row created with `status=pending`
- [ ] Admin can mark payout `processing` / `success` / `failed` (manual ops workflow until auto-payouts land)
- [ ] Each status change writes an `admin_audit` row
- [ ] Stale-payout reconciliation bucket catches requests > 24h

---

## 6. Email — Market Pulse dry run

- [ ] `GET /api/digest/preview` returns richer payload (html > 2KB, text alt, 3-variant subject)
- [ ] `POST /api/digest/send-me-now` delivers to real inbox; Resend dashboard shows `sent`
- [ ] Plain-text part renders correctly (view source in Gmail)
- [ ] Link to `cta_url` opens correct page on production domain
- [ ] Unsubscribe / preferences link opens `/app/digest`
- [ ] `POST /api/digest/trigger` (admin) blasts to all opted-in users; logs to `digest_log`; no 5xx from provider

---

## 7. Admin reconciliation

- [ ] `/app/admin/reconcile` loads for the admin role
- [ ] All 4 buckets show zero (or low) counts after a clean day
- [ ] `/api/health` and `/api/ready` return 200 (from inside and outside the cluster)
- [ ] `/api/admin/audit` returns the expected admin action trail
- [ ] `/api/admin/webhook-events` shows recent provider events

---

## 8. Security

- [ ] All provider secrets live in `.env` — none in frontend bundle (`grep -r "secret" /app/frontend/build`)
- [ ] CORS locked to production domain
- [ ] JWT expiry ≤ 168h, rotation policy documented
- [ ] Admin endpoints require `role=admin` (verified via 403 tests in iteration 7 + 8)
- [ ] Webhook signature verification required in non-mock mode
- [ ] No `_id` ObjectId leaking to clients (verified in all `find(..., {"_id": 0})` queries)
- [ ] File-upload paths validate MIME + size; signed URLs expire
- [ ] Bcrypt password hashes (cost ≥ 12)
- [ ] Rate-limit middleware added on `/api/auth/*` before launch (TODO — 20 LOC with slowapi)

---

## 9. Monitoring & alerts

- [ ] `/api/health` pinged by uptime monitor (Better Stack, Uptime Robot, etc.) every 60s
- [ ] `/api/ready` pinged (returns 503 if mongo unreachable) — alert on 503
- [ ] Sentry error tracking wired (optional for soft launch)
- [ ] Alert on `webhook_events.status=signature_rejected` > 5 per hour
- [ ] Alert on reconciliation `escrow_orphans > 0`

---

## 10. Data & backups

- [ ] Mongo daily snapshots enabled
- [ ] Object storage (uploads) has retention + backup policy
- [ ] Manual restore runbook tested once on staging
- [ ] Seeded demo accounts NOT present in production DB

---

## 11. Rollback plan

- [ ] Previous stable commit SHA recorded
- [ ] One-command rollback to prior image documented
- [ ] Database migrations are additive-only (no destructive schema changes yet)
- [ ] Feature flags allow turning off Market Pulse, Hot Demand, Video Promotion without redeploy

---

## 12. Launch-day drill

Run this 24h before go-live:

1. Create a real customer (buyer) on production
2. Fund wallet with ₦5,000 using a live card (smallest possible)
3. Place order on a real farmer listing
4. Simulate delivery + confirm → escrow releases → ledger balances
5. Farmer requests payout → admin approves → logs trail
6. Trigger one Market Pulse blast manually
7. Check all reconcile buckets = 0
8. Monitor `/api/ready` + logs for 1 hour

If any step fails → **do not launch**. File an incident and re-drill.

---

## 13. Post-launch (Week 1)

- [ ] Daily reconciliation review (≤ 10 min/day)
- [ ] Daily digest delivery rate > 95%
- [ ] Support-email SLA ≤ 8 business hours
- [ ] Weekly financial close — sum of `ledger` entries reconciles with provider dashboard totals
- [ ] A/B subject-line conversion tracked (see PRD roadmap `/api/digest/metrics`)

---

**Owner**: AGRIOS ops · **Last updated**: Feb 2026 · **Related**: `/app/memory/PRD.md`, `/app/test_reports/iteration_*.json`
