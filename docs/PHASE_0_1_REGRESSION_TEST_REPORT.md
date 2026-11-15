# Phase 0/1 Regression Test Report

## Environment and boundaries

- Repository workspace: `campus_swap` local checkout.
- Backend suite was run with localhost socket access enabled. `TEST_MONGO_URI` was explicitly unset; tests therefore did not connect to a database.
- Docker Compose configuration parsing is separate from container execution. The Docker Desktop daemon pipe was inaccessible, so no containers were started or inspected.
- Test counts below are from the final run after correcting two stale test assertions found in an earlier run. Earlier intermediate failures are not represented as passing tests.

## Executed checks

| Check | Result | Notes |
|---|---|---|
| `backend: npm test` | **50 passed, 0 failed, 1 skipped** (51 total) | Mongo-backed registration/index integration test skipped because `TEST_MONGO_URI` was unset. The other tests, including public registration, refresh behavior, mock OTP workflow, login single-response, auth/provider config, access control, PII serialization, proxy rate limits, and socket auth, executed. |
| `frontend: npm test` | **5 passed, 0 failed** | Public-auth retry policy, one-refresh retry limit, socket origin selection, fragment token cleanup, missing-fragment behavior. |
| `frontend: npm run build` | **Passed** | Vite production bundle completed. |
| Backend `node --check` | **Passed** | Checked `authController.js`, `config/env.js`, `ensureAdmin.js`, `errorMiddleware.js`, and `socketAuthMiddleware.js`. |
| `git diff --check` | **Passed** | No whitespace errors; Git emitted only line-ending conversion warnings. |
| Merged production Compose `config --quiet` | **Passed** | Used `.env.production.example` placeholders; no values printed. This validates syntax/interpolation, not runtime behavior. |
| Lint | **Not available** | Neither frontend nor backend package defines a lint script or configured linter. |
| Docker runtime / staging / live Mongo | **Not run** | `docker compose ps` failed with permission denied connecting to `npipe:////./pipe/dockerDesktopLinuxEngine`; no live database URI was supplied. |
| Remote CI | **Not run** | The workflow was updated locally but not pushed/executed by CI. |

## Backend test coverage represented by the run

- Auth payload validation, public registration access, absent/expired refresh behavior, refresh token rotation, registration OTP preview, reservation-conflict handling, and mock OTP account verification.
- Login password success/failure and single-response behavior on successful login/session-store failure.
- JWT auth, suspended/pending/revoked account denial, profile protected-field behavior, and privilege grant restrictions.
- SATI email/enrollment accepted branch codes and malformed formats/domains/sections/lengths.
- Reset token single-use, password update/session revocation, provider failure cleanup, and alumni email verification single-use.
- Development/production OTP provider configuration, real email request shape, and safe mock preview behavior.
- Error normalization/headers-sent behavior, listing owner checks, anonymous contact privacy, role permission decisions, and proxy/account limiter behavior.
- Socket authentication and rejection of missing/invalid/blocked/revoked identities.

## Skipped integration check

`backend/test/registration.integration.test.js` verifies actual Mongo indexes and full registration plus OTP verification against Mongo. It refuses database names not ending in `_test`, creates indexes only in that isolated test database, and cleans only IDs recorded as created by the test. It was skipped in this local run because no safe test URI was available. The CI workflow defines `campusswap_ci_test` and a Mongo service to execute it on CI; that workflow result is still pending.

## Interpretation

These results establish unit and in-process HTTP behavior for the checked source. They do not establish deployed container parity, live database index state, production email delivery, trusted proxy behavior, cookie behavior through the real ingress, or WebSocket upgrade behavior. See [the remediation report](PHASE_0_1_REMEDIATION_REPORT.md) for release blockers.
