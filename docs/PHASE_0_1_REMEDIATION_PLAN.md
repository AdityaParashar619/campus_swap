# CampusSwap Final Phase 0/1 Stabilization Plan

## Stage 1 — Source and report reconciliation (complete before application edits)

- Read the login, remaining audit, remediation, regression, and OTP reports; `POST_REMEDIATION_RUNTIME_REPORT.md` is absent.
- Current checkout supersedes older report claims in several places: proxy trust is configured in `app.js`; listing ownership, public contact serialization, mock preview, Socket.IO same-origin default, and enrollment reservation fixes exist; the auth bootstrap helper is idempotent for unchanged role/account type.
- Preserve all pre-existing worktree changes. Never reset, clean, or revert unrelated work.
- Docker daemon currently denies access to its named pipe. Do not claim Docker runtime verification unless access changes.
- Current code confirms React StrictMode plus an uncoalesced AuthContext refresh call; refresh shares the auth-IP limiter with login/registration. Current server retries the DB connection every 30 seconds and calls admin sync after already-connected `connectDB()` returns.
- Current login source has one explicit JSON response after refresh-cookie creation. The observed non-Error rejection object and Docker stack are not explained by current source evidence and remain unconfirmed pending route-level tests/runtime parity check.
- Root/backend `.env.example` files contain credential-like administrator values. Real ignored `.env` files exist; inspect only key presence/status, never print values. Example files will be replaced with placeholders; real `.env` values will not be printed, changed, or committed.
- Dependency audit is required. Network is restricted; try normal npm audit, then an approved network-enabled invocation if available. Do not blindly upgrade or force-fix.

## Final authentication repair extension

The latest task reiterates and tightens release acceptance around OTP retrieval, actual login routes, admin bootstrap/login, full password-recovery UX, execution-mode environment parity, and real-runtime evidence. It does not supersede the scope above. Add these gates:

1. Replace direct development OTP/reset-link response fields with a short-lived, single-use, high-entropy development mail-capture capability bound to one delivery. The preview endpoint must be unavailable outside development mock mode and accept no arbitrary email lookup.
2. Add actual Express route tests for student/admin login, error status, session cookie/persistence, single-response count, OTP/register/login lifecycle, reset lifecycle, refresh/missing cookie, limiter separation, and bootstrap-on-healthy-connection behavior.
3. Make backend `.env` loading deterministic from `backend/config/env.js` so direct execution from repository root or `backend/` uses the same backend file. Docker Compose continues to receive root `.env` only through its explicit environment map. Compare settings by presence/equality only; never print values.
4. Correct reset-delivery copy, add reset-success navigation, and verify frontend preview retrieval through the capability token.
5. Inspect each runtime mode separately. Docker daemon access remains denied; do not claim Docker startup, Docker/Node parity, or live-provider delivery from source/tests.
6. Audit package trees. Apply semver-safe in-range fixes first. Evaluate major upgrades only when the advisory remains critical/high and verify supported Node and test/build compatibility. Never use `--force` as a bulk operation.

## Stage 2 — Authentication crash, refresh flow, and bootstrap

1. Add tests through the actual Express login route for student/admin success, password/account failures, session persistence failure, cookie, and exactly one response.
2. Reproduce/fix only causes demonstrated by the actual route or runtime. Keep password/status checks and sanitize session errors; do not mask the source defect with a `headersSent` workaround.
3. Coalesce AuthContext refresh hydration and interceptor refresh into one in-flight request; ensure missing-cookie public hydration does not consume the login/register auth-IP bucket. Keep a distinct limiter for refresh requests carrying credentials so invalid-token guessing is still bounded.
4. Add coverage for missing/expired/invalid/valid/concurrent refresh, login after failed refresh, and independent proxy clients with spoofed forwarding headers.
5. Stop repeated administrator sync checks on healthy DB intervals while retaining retry/reconciliation after initial connection and genuine reconnect. Test idempotence and session preservation.

## Stage 3 — Registration, recovery, authorization, privacy, proxy, socket, and database

- Verify complete student/alumni/mock OTP/forgot/reset flows and token expiry, hashing, single-use, password change, old-password rejection, and session revocation. Correct the forgot-password copy so delivery failure is not described as completed delivery while retaining enumeration-safe public behavior.
- Verify listing update/delete allowlists and owner-scoped atomic operations; verify anonymous/unconnected/authorized-connected contact projections.
- Verify role matrix, protected routes, socket token identity, enrollment formats/index declarations, and institution mapping constraints without inventing year/section mappings.
- Confirm proxy trust count and forwarding-header behavior against the actual topology; keep shared limiter requirements documented for replicas.
- Use only an isolated Mongo database ending `_test`; never use ignored application `.env` database URLs for tests.

## Stage 4 — Dependencies, CI, configuration, and documentation

- Run frontend/backend npm audits separately. Upgrade the smallest safe package range only when advisory details are available and regression coverage is adequate.
- Inspect `.env` and `backend/.env` without printing values; confirm ignored status. Replace credential-like sample values with placeholders and keep secrets out of tracked files.
- Run development and production Compose config validation; run Docker only if permitted.
- Update plan, remediation report, regression report, production guide, and create the final release checklist. Record exact statuses and test results.

## Stage 5 — Verification and release gate

- Run backend tests, isolated Mongo integration, frontend tests/build, syntax checks, lint if configured, diff checks, npm audits, Compose config checks, and runtime smoke checks when available.
- Do not claim the supplied Docker login failure is fixed unless reproduced/fixed in the matching runtime image. Do not claim real provider delivery, live indexes, or Docker startup from unit/config evidence.
- Release decision is NO-GO until required critical/high gates and institutional policy acceptance are satisfied. No Phase 2 feature work is in scope.

## Current limitations at plan start

- Docker daemon: access denied on `npipe:////./pipe/dockerDesktopLinuxEngine`.
- npm audit endpoint: name resolution to `registry.npmjs.org` failed in the sandbox on initial attempt; network-authorized retry pending.
- Live production/staging backend and provider credentials are not available in this source workspace.
