# Independent Phase 0 & Phase 1 Verification Report

Date: 2026-11-07 (Asia/Calcutta)

## Executive assessment

**NO-GO for accepting Phase 0/1 as verified for production.** The repository contains substantial implementation, but the required registration, OTP, refresh rotation/reuse, password reset, alumni review, authorization, feature regression, MongoDB persistence, Docker runtime, and browser workflows were not exercised end to end. Static review found high-risk session and account recovery defects, along with configuration/operational issues. This audit does not implement fixes.

The prior completion reports correctly disclose several testing limitations, but Phase 1 is phrased as delivered without behavior-level evidence. The 13 unit/API tests and frontend build passed before this audit attempted `npm ci`; they were not rerun afterward because the attempts left dependencies incomplete. Passing a build and unit/API tests is not proof of the listed workflows. Exact evidence and blocked checks follow.

## Tests performed

### Passed

| Check | Command | Evidence |
| --- | --- | --- |
| Backend tests | `npm test` in `backend/` with loopback access | 13/13 passed before the audit's `npm ci` attempts. Covers health, validation, injected registration staging, injected login behavior, auth middleware state/token checks, profile allowlist, permissions, OTP/hash helpers, role-assignment helper, and email-domain policy. It does not use MongoDB for IAM lifecycle tests. |
| Frontend build | `npm run build` in `frontend/` | Vite 4.5.14 completed before the audit's `npm ci` attempts; 438 modules transformed. No browser interaction was performed. |
| Compose syntax/config | `docker compose --env-file .env.example config --quiet` | Exit code 0. This validates Compose interpolation/schema, not image build or runtime. |
| Backend syntax | `node --check` on `backend/app.js`, auth/admin/IAM controllers, alumni model, bootstrap script, and auth util | Exit code 0. |
| Diff whitespace | `git diff --check` | Exit code 0; Git emitted expected LF-to-CRLF working-copy warnings. |
| CI workflow inspection | Read `.github/workflows/ci.yml` | Workflow config shows PR/push triggers for main/develop, npm ci, optional frontend tests, frontend build, backend tests, optional backend lint. Workflow was not run on GitHub. |

### Failed

| Check | Command | Evidence |
| --- | --- | --- |
| Clean dependency installation | `npm ci` in `backend/` and `frontend/` | Both failed with Windows `EPERM` unlink errors on locked native binaries (`bcrypt_lib.node`, `esbuild.exe`). This audit setup attempt removed files from the existing `node_modules` trees; repeated normal and elevated attempts remained blocked. Source files and lockfiles were not changed. Dependency trees are therefore incomplete at report time, and further npm checks cannot be trusted until restored. |

### Blocked / not performed

| Check | Reason/evidence |
| --- | --- |
| Frontend/backend lint | Neither package has a `lint` script. CI uses `--if-present` for backend lint; no frontend lint command exists. |
| Frontend tests | No `test` script or configured frontend test framework exists. CI runs `npm test --if-present`, so it skips. |
| Backend build | No backend build script exists; application is JavaScript ESM. Syntax checks are the applicable static check currently configured. |
| Live MongoDB IAM workflow/integration tests | A local `mongod` binary exists and a temporary isolated server was started on 127.0.0.1:27018 with a temp DB path. The dependency tree was incomplete (`mongoose` package files absent after failed npm ci), preventing a Mongoose probe. No application writes or production data were touched. |
| App health/API against Mongo | Could not start backend due incomplete dependencies. Existing unit tests include mocked/disconnected health only. |
| Docker frontend/backend build and Compose startup | Docker CLI/Compose are installed, but Docker Desktop Linux engine is unavailable: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.` Compose config alone passed. |
| Persistent volume and service networking | Requires Docker daemon and container startup; not verified. |
| Graceful shutdown | Code inspection only; the existing server test checks listening while an unavailable DB connection proceeds, not signal-driven drain behavior. |
| GitHub Actions execution | No GitHub run was initiated or inspected. Workflow source was reviewed only. |
| Browser/mobile/frontend workflows and console/network errors | No browser-driven test was run; build output is not behavioral verification. |
| Existing feature regression workflows | Marketplace, notes, requests, bounties, connections, messages, notifications, reports, and moderation workflows were not exercised. |
| Email provider, cookie cross-origin behavior, native refresh | No provider credentials/deployed origin/browser session; native refresh is explicitly not implemented. |

## Findings

### Critical

None confirmed by this static audit. This is not equivalent to a clean security assessment: several high-risk issues remain and the end-to-end paths were unavailable.

### High priority

1. **Refresh rotation has a parallel-request race that can revoke the live session family.** `refreshSession` atomically marks the old session revoked, issues a replacement, then saves `replacedBy`. If two refresh requests arrive with the same cookie, one wins; the other sees a revoked token and immediately revokes all non-revoked sessions in that family, including the winner’s replacement. Browser refresh concurrency is plausible across tabs or simultaneous 401s. See `backend/controllers/authController.js` (`refreshSession`). No concurrency test exists.

2. **Reset tokens are reusable during concurrent reset submissions.** `resetPassword` hashes a new password before an atomic `findOneAndUpdate` that sets token fields to null. Concurrent requests can both match before either update completes depending on Mongo update scheduling; the operation itself is atomic per document, so only one should match once serialized, but no test proves this invariant. More concretely, provider failure leaves a live reset hash until expiry and there is no explicit invalidation/attempt throttling; account recovery has no lifecycle tests. Treat as a high-priority verification gap, not a confirmed exploit.

3. **Alumni verification can strand or orphan account state.** The controller claims a link, creates the User, then saves the verification record. If the final save fails after User creation, the unique email prevents retry from creating a fresh user, while the verification may remain email_pending with a claim timestamp. Admin review updates verification and User in separate writes, allowing partial approval/rejection. No transaction or repair workflow exists. See `backend/controllers/authController.js` (`verifyAlumniEmail`) and `backend/controllers/iamAdminController.js` (`reviewAlumniVerification`).

4. **Unauthenticated account recovery has no explicit per-account cooldown or user-level throttling.** Global auth attempt limiter is process-local IP-only. `forgotPassword` can repeatedly overwrite a user's stored reset token and trigger provider sends; distributed deployment multiplies the effective limit. Use a shared store, email/account keyed cooldown, and provider abuse controls before production.

### Medium priority

1. **Production cookie settings conflict with default Compose URL.** Refresh cookie uses `SameSite=None; Secure` in production, but Compose sets `FRONTEND_URL=http://localhost:8080`. Browsers reject Secure cookies over plain HTTP (except special localhost handling varies); deployed HTTPS origins must be configured consistently. The provided default `OTP_MOCK_ENABLED` in Compose is `true`, which causes production backend startup to throw unless operators override it. `.env.example` also defaults it to true. Safe for local compose only if `NODE_ENV` is development; not safe as a default for the production Compose service.

2. **JWT secret validation is incomplete.** Only presence and production length are checked. Development/test accept short/shared secrets; access TTL, refresh days, rate-limit numeric settings, and malformed `ENROLLMENT_PATTERN` are not validated. Invalid regex can cause request-time 500s. `jwtExpiresIn` remains exposed but no longer controls sign-in token lifetime, creating a misleading setting.

3. **CORS accepts requests without an Origin.** `corsOptions.origin` returns success when Origin is absent. This is normal for non-browser clients but is not a CSRF boundary. Refresh/logout separately require Origin, while cookie-authenticated routes are currently those two endpoints. Verify reverse proxies and future cookie routes preserve this distinction. No deployed CSRF/CORS tests exist.

4. **Refresh cookie clearing omits original attributes.** `clearCookie` uses only `path`; cookie identity is primarily name/path/domain, but consistent `sameSite`/`secure` settings reduce browser inconsistencies. No browser test verifies logout/refresh-reuse clearing.

5. **Potential login account enumeration through timing.** Unknown-user login exits before bcrypt while existing-user invalid passwords run bcrypt. Error body is generic, but timing is distinguishable. Forgot-password response text is generic, while provider side effects differ as expected. Consider constant-work login and abuse monitoring.

6. **Several admin and feature queries remain unbounded or loosely validated.** `adminController.listUsers` uses an unbounded `find()`. Search page parameters can become very large (page has no cap), and invalid status/role values mostly return empty results rather than validation errors. Existing feature routes were not exhaustively reviewed/tested in this run.

7. **Password reset frontend constraints conflict with backend.** `ResetPassword.jsx` advertises `minLength={8}`, but backend requires 12 characters and the page does not collect confirmation. The user gets server rejection for 8–11 chars and there is no client confirmation step.

8. **Profile/feature contracts have no behavioral regression coverage.** IAM changes retain legacy fields but no existing feature workflows verify field projections, status checks, real-time behavior, or moderation regressions.

9. **Dependency installation is currently unreproducible in the audit environment.** `npm ci` failed on locked native binaries and left package directories incomplete. Clean install should be tested in a fresh checkout/CI runner after no process holds these files; current build/test success predates the failed install attempt.

### Low priority

1. **Reports describe implementation more strongly than available evidence.** Phase 1 report says auth/session/admin flows were delivered, but only helper-level and mock tests exist; annotate those workflows as implemented but not integration-verified.
2. **No frontend lint/test scripts.** CI skips both frontend test/lint coverage paths by design (`--if-present` for tests; no lint step). This is a maintainability gap, not a runtime failure by itself.
3. **Root `.env.example` defaults to an insecure development mock value while Compose forces production mode.** Compose config validation cannot detect that application-level startup mismatch.

## Security review

- Passwords are bcrypt hashed with cost 12 on new flows; legacy login accepts old password lengths for compatibility.
- OTP hashes are HMAC-bound to email, have expiry and max attempts. Helper tests cover formatting/binding, but Mongo concurrency/expiry/reuse behavior is untested.
- Refresh tokens are opaque and SHA-256 hashed in `RefreshSession`. Rotation/reuse logic exists, but the parallel refresh race above needs a designed grace/idempotency policy and concurrent integration test.
- Access JWTs use signature verification and live account/token-version lookup. Legacy tokens without a tokenVersion remain accepted by design until expiry, as documented.
- Password reset stores a hash, expiry, and atomically consumes the token; no real email/provider or concurrent reuse tests ran.
- Authorization uses role permissions server-side for admin routes. The `admin` legacy role intentionally lacks IAM user management but retains moderation permissions. Student/alumni/faculty negative API matrix was not run.
- Profile updates use an allowlist. No direct HTTP test attempted protected field mutation because the prior test invokes controller with a mocked update.
- Socket.IO now verifies JWT and derives user identity server-side. Room membership is derived from verified identity; typing destination is client-selected but sender ID is server-derived. Actual unauthorized connection/room tests were not run; sockets do not re-check account state after handshake until disconnect/token expiry.
- OTP/reset email URLs carry bearer secrets in query strings. Browser history, referrer behavior, proxy logs, analytics, and email link scanners can expose them; use a fragment or POST-exchange design and set restrictive referrer policy/no third-party content on verification pages.
- Audit logging exists for IAM mutations, but mutation+audit are non-transactional, and legacy moderation block action does not write an audit record.
- No secret was found in the inspected sample env/config files; production secrets are environment values. Docker build-context exclusion and final image contents were inspected from Dockerfiles but not built/scanned.

## Performance and operations

- Rate limiters use in-memory storage, so limits are per process and reset on restart.
- Chat preview still has the documented N+1 shape; user/admin/report reads include unbounded paths.
- Mongo TTL/index behavior and index migration were not verified against an existing database. Enrollment partial unique index rollout may fail against a legacy unique index or duplicate data.
- Compose defines a named Mongo volume and health checks; persistence and readiness ordering are declarative only until containers run.
- Backend health reports Mongo readiness; Compose backend health check uses liveness `/live`, which can mark backend healthy before readiness changes after startup only because Mongo dependency is separately gated. Runtime behavior was not observed.
- Graceful shutdown code calls Socket.IO close and Mongoose disconnect, but no signal test verified active request/socket draining or forced timeout behavior.

## Docker and CI/CD

- Docker Compose parsing passed. Docker daemon was unavailable, blocking image builds, startup, health probes, service networking, SPA routing, persistence, and shutdown checks.
- Dockerfiles use lockfile-based npm installs, non-root backend runtime, Nginx frontend runtime, and no explicit secret COPY. No image scan/build evidence is available.
- CI source has pull-request and push triggers, read-only contents permission, Node 22, locked installs, backend tests, and frontend build. It skips missing frontend tests/lint and does not build Docker images or start MongoDB.
- No CI run result was inspected. The previous report’s phrase “CI runs” describes configured workflow, not a run in this audit.

## Regression testing

No end-to-end workflow was verified for marketplace listings, notes, requests, bounties, connections, messaging, notifications, reports, moderation, mobile layouts, or Socket.IO unauthorized room access. Existing tests do not establish those regression claims.

## Exact commands executed

- `npm test` in `backend/` — pass before audit `npm ci` attempts; rerun not possible after dependencies were removed/locked.
- `npm run build` in `frontend/` — pass before audit `npm ci` attempts; rerun not possible after dependencies were removed/locked.
- `docker compose --env-file .env.example config --quiet` — pass.
- `node --check backend/app.js`; `node --check backend/controllers/authController.js`; `node --check backend/controllers/adminController.js`; `node --check backend/controllers/iamAdminController.js`; `node --check backend/models/AlumniVerification.js`; `node --check backend/scripts/ensureAdmin.js`; `node --check backend/utils/auth.js` — pass.
- `git diff --check` — pass.
- `docker version; docker compose version` — Docker CLI 29.3.1 and Compose v5.1.0 present; Docker daemon connection failed because Desktop Linux engine pipe was absent.
- `npm ci` in backend and frontend — failed with EPERM unlink locked `bcrypt_lib.node` and `esbuild.exe`; repeated with escalation, same result.
- Started local `mongod --dbpath <temp>/campusswap-audit-mongo --port 27018 --bind_ip 127.0.0.1 --quiet` — startup completed; isolated temporary database only.
- Attempted a Mongoose model/index probe using Node against `127.0.0.1:27018` — failed because `backend/node_modules/mongoose` had been removed by failed `npm ci`.

## Recommended fixes

See `docs/BUG_FIX_BACKLOG.md`. Priority order is to restore a clean dependency environment, fix refresh rotation concurrency, make alumni/user and audit state transitions atomic or recoverable, add real Mongo-backed auth/authorization tests, correct production Compose configuration, then execute browser/container/feature regression suites.

## Final decision

**NO-GO.** High-risk session concurrency and account-state integrity concerns remain, critical acceptance workflows were not behaviorally verified, and Docker/Mongo integration checks could not complete. No production deployment was attempted and no production data was accessed.
