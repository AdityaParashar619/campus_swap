# Authentication reliability report

## Status summary

- **FIXED AND TESTED:** Student email normalization and strict SATI format checks; enrollment shape and branch alignment; password-strength enforcement; OTP hashing, purpose scoping, expiry, attempt limit, resend cooldown and one-use verification; login single-response path; refresh rotation and session revocation; enumeration-safe public recovery responses.
- **FIXED AND TESTED:** Development mock delivery uses a one-use local mail-capture capability. Provider rejection and timeout paths are handled as failures rather than successful delivery.
- **BLOCKED BY ENVIRONMENT:** Actual student OTP and password-reset email delivery and inbox acceptance. No provider credentials, verified sender, or mailbox access were available. See `EMAIL_OTP_CONFIGURATION.md`.
- **BLOCKED BY POLICY:** Real enrollment verification. No authoritative SATI roster or approved verification API is configured.

## Relevant implementation

- `backend/controllers/authController.js`: validates normalized student identity before pending registration, stores bcrypt-hashed password and parsed institutional metadata, activates only after OTP verification, and handles login/reset/session logic.
- `backend/utils/institutionalIdentity.js`: strict SATI parser and startup configuration assertion.
- `backend/utils/passwordPolicy.js` and `backend/middleware/validateMiddleware.js`: backend password rules for account creation and reset.
- `backend/utils/emailProvider.js`: Resend SDK adapter with configured sender and 10-second abort signal; onboarding test recipient and local mock capture are isolated modes.
- `backend/utils/devMailCapture.js`: one-use capability hashed at rest, short expiration, replacement invalidation.
- `backend/models/EmailVerification.js`, `EnrollmentReservation.js`, `RefreshSession.js`, and `User.js`: unique/TTL indexes and session/verification storage.
- `frontend/src/services/api.js`: public auth calls do not start a refresh retry; protected calls make a bounded refresh attempt.

The previous login audit identified an Express `next` argument being passed as an optional session factory, causing response propagation to conflict with a second login response. The wrapper now passes only `(req, res)` to login logic. The exact old report remains at `LOGIN_FAILURE_INVESTIGATION.md`; current login route tests exercise success, invalid credentials, session write failure, student, and administrator flows.

## Verification performed

Backend: 65 tests passed, 0 failed, 0 skipped in the final Mongo-backed run using a new isolated `campusswap_resend_test` database on localhost. This includes registration, mock capture, OTP verification, student/admin login, refresh, logout, password reset, authorization integration, and Resend SDK mock/config tests. The test process created indexes and removed its own fixture records; no normal database was used.

Frontend: 9 tests passed, 0 failed. Production Vite build completed. `docker compose config --quiet` passed. Offline dependency audit reported zero vulnerabilities for backend production dependencies and frontend dependencies. The backend package has no lint script; no lint command was available. Docker runtime health checks and actual email delivery were not established by this result. See the release report for full verification scope and issues.

## Remaining risks

1. Provider delivery is not tested against a real provider or mailbox; release is **NO-GO** until the documented end-to-end email acceptance test succeeds.
2. Email address pattern and mailbox ownership do not prove enrollment; roster verification is unavailable.
3. Local mock captures are in-memory and unsuitable for multi-process or production operation by design.
4. Existing database duplicates may prevent unique-index creation during deployment. Inspect the target database first; do not drop indexes or data as a workaround.
5. Direct deployment must set matching proxy trust, origins, separate high-entropy JWT/OTP secrets, and real email configuration.
