# Phase 1 Completion Report: Identity and Access Management

Date: 2026-11-07

## Delivered

- Added account types, verification/account states, institutional metadata, scoped coordinator fields, token versions, and a partial unique enrollment index while retaining the existing `password`, `role`, `isBlocked`, and `isVerifiedStudent` fields for compatibility.
- Replaced immediate student registration with a temporary pending registration, HMAC-protected six digit email OTP, expiry, attempt limit, resend cooldown, exact institution domain allow-list, and verification before account creation. The development mock returns a clearly labeled OTP preview and production rejects mock delivery.
- Added alumni personal-email verification followed by a separate administrator review before activation.
- Added short-lived access JWTs, opaque rotating refresh sessions stored only as hashes, HttpOnly cookies, reuse detection, logout, password change/reset revocation, and current account/token-version checks.
- Added role-to-permission mapping and permission middleware, bounded IAM search/detail APIs, status and role administration, department/club scope validation, alumni decisions, and audit records.
- Updated profile settings, session restoration, role-aware navigation, registration/verification screens, password visibility, and administration screens.
- Added configurable email delivery, student/institution settings, admin bootstrap settings, API/security/database docs, and this completion report.

## Verification

- `backend: npm test` — passed, 13/13. The initial sandbox run was blocked by loopback networking; rerun with approved loopback access passed.
- `frontend: npm run build` — passed.
- `docker compose --env-file .env.example config --quiet` — passed.
- `git diff --check` — passed. Backend syntax checks are run separately against application source; do not include `node_modules` in recursive syntax checks.

## Required before production

- Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` to a dedicated account; the bootstrap refuses to promote a normal existing user. `ADMIN_EMAIL` remains a legacy moderation role only.
- Configure institution-owned `ALLOWED_COLLEGE_DOMAINS`, optional enrollment/department/branch/club/semester values, a production email provider, separate `OTP_PEPPER`, a 32+ character JWT secret, and HTTPS frontend origins. Production fails closed for student signup when allowed domains are empty and rejects the OTP mock.
- Inspect existing User indexes and enrollment data before creating/reconciling the partial unique enrollment index. Review operational TTL/index creation on the new collections.
- Run MongoDB-backed concurrency and lifecycle tests, real email-provider tests, and a full Compose/deployment smoke test. The current tests do not exercise Mongo persistence, index migration, provider delivery, cookie behavior across deployed origins, or multi-instance rate limiting.

## Known limitations

- The configured college mailbox proves mailbox control, not official enrollment. Stronger proof needs an institutional roster/API or administrator process.
- Refresh cookie transport is browser-oriented; native secure refresh transport is not implemented.
- Rate limits are in-process. Multi-instance deployments need a shared store.
- Audit and account mutations are not transactional. Replica-set transactions or an outbox are needed for strict audit atomicity.
- Department/club scope is stored and validated when assigning roles; future resource endpoints must enforce scope filtering.
- No frontend test or lint framework is configured. Frontend behavior was build-checked only.
