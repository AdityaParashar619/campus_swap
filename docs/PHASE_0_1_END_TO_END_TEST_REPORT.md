# CampusSwap Phase 0/1 End-to-End Test Report

## Executed checks

| Command / check | Result |
|---|---|
| `npm test` in `backend`, with `TEST_MONGO_URI` pointing to a temporary isolated MongoDB 8.2 database `campusswap_phase1_test` | **60 passed, 0 failed, 0 skipped.** Includes duplicate-registration suppression, OTP cooldown and expired/incorrect OTP rejection, one-use mail capture expiry/replacement, actual Express login route responses, admin/student login, session failure sanitization, rate limits, and Mongo-backed student registration → capture OTP → verify → login → protected profile → refresh → logout → protected request denial → reset request → capture reset link → reset → old password rejection → new password acceptance → student admin API denial → admin login and admin API allowance. |
| `npm test` in `frontend` | **7 passed, 0 failed, 0 skipped.** Includes public auth refresh policy, no refresh recursion, socket URL resolution, token fragment cleanup, and single-flight behavior. |
| `npm run build` in `frontend` | **Passed.** Vite 7.3.8 production build completed. |
| `npm audit --json` in `backend` | **Passed, 0 vulnerabilities.** |
| `npm audit --json` in `frontend` | **Passed, 0 vulnerabilities.** |
| `npx nodemon --version` in `backend` | **Passed**, reports 3.1.14. |
| `docker compose config --quiet` and production overlay with `.env.production.example` | **Passed.** Development and production Compose syntax/merge validated only; the placeholder example was used for validation, not as deploy credentials. |
| `docker compose ps` | **Blocked by environment.** Docker Engine pipe `npipe:////./pipe/dockerDesktopLinuxEngine` is unavailable. |
| `git diff --check` | **Passed.** No whitespace errors. |

The isolated database used a unique temporary directory and `*_test` database name. The configured application `.env` database was not used. Test-created fixtures were cleaned by ID; the temporary test directory was retained. No actual email provider was called.

## Coverage boundaries and not-run checks

- The integration covers actual Mongo persistence for student registration, OTP verification, login, refresh/logout, and recovery. The admin account/API path uses a real Mongo fixture; bootstrap creation/idempotence is covered by isolated controller tests, not by configured production administrator credentials.
- Real provider delivery, Docker startup/health checks, deployed Nginx forwarding, live DB index/duplicate review, and production cookie settings were not runtime verified.
- Browser-level UI automation is not configured. Reset success navigation and local capture UI were source-reviewed and included in a successful production build, but were not clicked in a browser.
- No frontend/backend lint script is configured; lint was not claimed as executed. CI runs the existing backend/frontend tests and frontend build; backend lint is conditional on a future script.
- The policy for matching email and enrollment year/section across institutional identity records remains unconfirmed.

## Release result

**NO-GO** until Docker/staging runtime checks, real provider delivery, live database index review, and institutional policy confirmation are completed. Passing unit/integration checks do not substitute for those release gates.
