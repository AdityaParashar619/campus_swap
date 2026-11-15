# Registration OTP Debug Report

> Follow-up: the earlier development response preview implementation has been replaced by a one-use local mail-capture capability. Raw OTPs and reset/alumni links are no longer included directly in public API responses. See [the final remediation report](PHASE_0_1_FINAL_REMEDIATION_REPORT.md), [environment setup](PHASE_0_1_ENVIRONMENT_CONFIGURATION.md), and [executed flow results](PHASE_0_1_END_TO_END_TEST_REPORT.md).

Date: 2026-11-08

## Root cause

The current repository's `sendVerificationCode` supports the reported `NODE_ENV=development`, `OTP_MOCK_ENABLED=true`, empty-provider configuration: it returns a development-only OTP preview before checking provider URL/key. A read-only inspection of the running Compose backend confirmed those mode flags, no configured provider values, and the mock-mode code branch in the container. That rules out a missing email provider as the cause under the inspected runtime values. There is no backend configuration/availability endpoint and no frontend registration guard. Registration availability is decided by `POST /api/auth/register/student` when its controller calls the email service.

The concrete controller defect was that both OTP delivery and a second database write updating `lastSentAt` were inside one `try/catch`, translating either failure into “Email delivery is not configured”. The live container was inspected: it has the correct mock-mode branch, but its controller still contains the old post-delivery `markSent` write. This identifies the live code path capable of emitting the misleading error under the reported mock settings. The exact database exception from a failing request was not captured, so the precise reason that write failed is not confirmed. The fix stores `lastSentAt` in the initial pending OTP write before delivery and removes the avoidable second write. Provider delivery errors remain caught and reported as delivery failures.

## Authentication behavior

- `/api/auth/refresh` returning 401 when no refresh cookie exists is expected. Refresh is not a public session-creation endpoint.
- The frontend `AuthProvider` calls refresh during hydration and clears local state when it fails. `/signup` and `/verify-email` are public routes; they are not wrapped by `ProtectedRoute`.
- The Axios response interceptor excludes `/auth/refresh` from refresh retry and excludes public auth endpoints, including `/auth/register/student`, so the missing-cookie response does not recurse.
- Registration does not depend on refresh. No authentication middleware was removed or weakened.

## Files changed

- `backend/config/env.js` — production rejects mock OTP and now requires a syntactically valid HTTPS provider URL plus API key when production real-email mode is selected.
- `backend/controllers/authController.js` — writes the OTP cooldown timestamp with the initial pending record and removes the fallible post-delivery bookkeeping write.
- `backend/test/auth.test.js` — added public registration, missing/expired refresh, successful refresh rotation, and mock registration/verification regressions.
- `backend/test/emailProvider.test.js` — added mode-matrix and real-provider request tests.
- `backend/test/registration.integration.test.js` — added an opt-in MongoDB integration test; it requires `TEST_MONGO_URI` whose database name ends in `_test`.
- `backend/.env.example` — removed duplicate conflicting keys and made the local development mock configuration explicit; no actual secrets are present.
- `.env.example` — added placeholder OTP pepper and provider variables for Compose; values are not real secrets.
- `docker-compose.yml` — passes `INSTITUTION_EMAIL_PATTERN` through to the backend with the other institution settings.

## Fix implemented

- Development + mock enabled: OTP is generated and returned only as a development preview; no external provider is needed.
- Development + mock disabled: a configured provider is required when registration tries to send; missing configuration yields a delivery error.
- Production + mock enabled: startup rejects configuration.
- Production + mock disabled: startup requires an HTTPS provider URL and non-empty API key; actual external availability is still determined by the provider response during delivery.
- Pending OTP expiry, hash, attempt count, and resend cooldown remain in place; the cooldown timestamp is stored before delivery, and a failed delivery removes the pending registration.
- No OTP is hardcoded, no verification step was bypassed, and real provider delivery remains active when mock mode is off.
- Example environment files now have one effective setting per key; backend sample explicitly uses development/mock mode.

## Tests executed

- `npm test` in `backend/` with loopback access — **passed, 24 passed, 1 skipped** in the final standard run. The skipped test is the opt-in MongoDB integration test because `TEST_MONGO_URI` was not set. Other coverage includes public registration, no-cookie and expired-cookie refresh 401s, successful refresh rotation, mode behavior, production startup validation, mock OTP verification with mocked persistence, and existing authentication/domain tests.
- `node --test test/registration.integration.test.js` with a temporary local MongoDB process and `TEST_MONGO_URI=mongodb://127.0.0.1:27029/campusswap_otp_debug_test` — **passed, 1/1**. Verified real Mongo pending record, mock OTP response, real account creation after OTP verification, refresh-session persistence, and temporary record cleanup. The database was isolated and its temporary files were removed afterward.
- An initial combined run with `TEST_MONGO_URI` failed because the integration fixture generated an email with four digits where the configured format requires two; the fixture was corrected. The isolated integration run then passed, including after the registration timestamp change.
- `npm run build` in `frontend/` — **passed**, Vite 4.5.14, 438 modules transformed.
- `docker compose --env-file .env.example config --quiet` — **passed**.
- `node --check` for edited backend files and `git diff --check` — passed.
- Lint scripts: none are defined in either package. `npm run` lists backend `start/dev/seed/test` and frontend `dev/build/preview` only. Frontend tests are also not configured.

## Remaining issues

- The running backend image predates the controller fix (`oldPostDeliveryWrite: true`). Because the task says not to rebuild the application, the running container was left untouched; the code fix is present in the workspace but is not active in that container until the backend image is rebuilt and recreated. The live HTTP registration/verification request was not completed, and the exact database exception was not captured.
- A valid-looking HTTPS provider URL/key cannot prove provider credentials/service health at startup. Delivery failures surface at request time; a provider health check is outside this fix.
- Frontend has no test or lint scripts. Public-route/interceptor behavior was verified by source inspection plus backend endpoint tests; no browser console/network test ran.
- Missing and expired refresh tests verify expected 401 behavior, and a mocked successful rotation test verifies the controller path. No deployed browser-cookie test ran. `docker compose config` passed; Docker image rebuild/recreate was intentionally not performed under the task constraint.
