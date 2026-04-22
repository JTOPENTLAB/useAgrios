# AGRIOS — Auth Testing Playbook (Google OAuth via Emergent)

## Key facts
- Backend: FastAPI at `/api/*` (routed via k8s ingress).
- Existing JWT password login at `/api/auth/login` + `/api/auth/signup` — KEEP WORKING.
- Google OAuth added via Emergent-managed service at `https://auth.emergentagent.com`.
- Session cookie: `session_token` (httpOnly, secure, samesite=none, path=/).

## Backend endpoints
- `GET /api/auth/google/start` — returns redirect URL to Emergent Auth (stores `role` + `next` in signed state).
- `POST /api/auth/google/session` — exchanges `session_id` for user profile via Emergent `/session-data`, creates/updates user, sets httpOnly `session_token` cookie + returns our JWT token.
- `GET /api/auth/me` (existing, enhanced) — reads cookie first, then Authorization header.

## Frontend flow
1. User clicks "Continue with Google" on `/signup?role=investor`.
2. Frontend redirects to `https://auth.emergentagent.com/?redirect=<origin>/auth/callback?role=investor&next=/onboarding/profile`.
3. Google → Emergent → bounces back to `<origin>/auth/callback#session_id=XYZ&role=investor&next=/onboarding/profile`.
4. `<AuthCallback/>` reads `session_id` synchronously during render, POSTs to `/api/auth/google/session`, receives JWT + user data, stores token, navigates to `next` or `/onboarding/profile`.
5. New users created via Google OAuth default to `role=investor` unless query param says otherwise. `onboarding_step` starts at 1 (account done).

## Test identities
Google OAuth creates dynamic users — no persistent test password needed. For manual regression:
- Can log in via existing JWT demos: admin@agriflow.ng / Admin@12345 (see `/app/memory/test_credentials.md`).
- Google flow needs a real Gmail. Record any test gmails used here during QA.

## Manual regression checklist
- [ ] `/signup?role=investor` preselects Investor card
- [ ] `/signup?role=farmer&next=/app/marketplace/123` preselects Farmer + preserves `next`
- [ ] Clicking "Continue with Google" redirects to Emergent Auth
- [ ] On return from OAuth, `/auth/callback` processes session_id and routes to `next` or `/onboarding/profile`
- [ ] Existing Google user returning is logged in and sent to `/app` (not onboarding)
- [ ] Password signup still works end-to-end
- [ ] `GET /api/auth/me` returns current user when called with cookie OR Authorization header
- [ ] LinkedIn button shows tooltip "LinkedIn sign-in is enabled for verified investor accounts..." and does NOT redirect

## Failure modes to watch for
- CORS: backend must `allow_credentials=True` and include the frontend origin in `CORS_ORIGINS`.
- Cookie `samesite=none` requires `secure=True` — will not work on plain http.
- Emergent's redirect only preserves URL fragment; ensure React Router doesn't strip the hash.
- Never hardcode `window.location.origin` fallback — it breaks cross-environment.
