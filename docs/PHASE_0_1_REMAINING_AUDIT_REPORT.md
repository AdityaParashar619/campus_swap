# CampusSwap Remaining Phase 0/1 Security and Functionality Audit

**Scope:** Read-only code, test, CI, and deployment configuration audit. This report supplements [LOGIN_FAILURE_INVESTIGATION.md](LOGIN_FAILURE_INVESTIGATION.md); it does not repeat its login, refresh-cookie, or recurring administrator-bootstrap findings. Docker runtime inspection was attempted but denied by the Docker Desktop named-pipe permission error. No database connection or test execution was performed.

**Status legend:** “Confirmed” means directly evident in the checked-in source/configuration. It does not imply runtime exploitation or deployed-container verification. “NOT CONFIRMED” marks conclusions needing runtime, data, or policy evidence.

## Findings

### CS-P1-01 — Listing owner can be reassigned through the update API

- **Severity:** High (authorization/IDOR; Phase 2 blocker)
- **Evidence:** `backend/routes/listingRoutes.js:16` authenticates PATCH requests; `backend/controllers/listingController.js:65-76` checks the existing listing owner, then copies every request body field into the listing with `Object.assign(listing, updates)`. `backend/models/Listing.js:17` includes mutable `user` ownership.
- **Root cause:** Confirmed. Authorization checks the stored owner before applying unfiltered client fields, so the same request can transfer ownership after passing the check.
- **Reproduction:** As account A, PATCH a listing owned by A with `{ "user": "<account-B-id>" }`. The source permits that field to be assigned. Confirm in an isolated test database that account B can then update/delete it and account A cannot.
- **Recommended fix:** Explicitly allowlist editable listing fields and never accept ownership, moderation, or counter fields from the client. Bind update/delete operations to both listing ID and authenticated owner in the database query.
- **Required regression tests:** Owner update succeeds; non-owner update/delete fails; `user`, `isHidden`, `favoritesCount`, and other server-managed fields in the body cannot be changed.

### CS-P1-02 — Public feeds expose account email addresses

- **Severity:** High (privacy; Phase 2 blocker)
- **Evidence:** Public `GET /api/listings` is unauthenticated (`backend/routes/listingRoutes.js:14`) and populates owner `name email profilePicture trustScore` (`backend/controllers/listingController.js:49-52`). Public `GET /api/bounties` is unauthenticated (`backend/routes/bountyRoutes.js:8`) and populates `name email` (`backend/controllers/bountyController.js:21-23`). The contact visibility filter is only applied in `backend/utils/connections.js:24-34`, not in these feed serializers.
- **Root cause:** Confirmed. Public feed population explicitly selects email without enforcing contact visibility or a connection relationship.
- **Reproduction:** Request either public feed without credentials and inspect populated `user.email` values.
- **Recommended fix:** Remove email from public feed projections and use a shared visibility-aware public profile serializer. Expose contact details only through the intended authenticated/connected-user flow.
- **Required regression tests:** Anonymous listing/bounty responses contain no email, phone, or WhatsApp fields; permitted contact visibility remains available only in the intended connection state.

### CS-P1-03 — Docker Compose rate limits all users behind the reverse proxy as one client

- **Severity:** High (availability; Phase 2 blocker)
- **Evidence:** `backend/app.js:33-53` does not configure Express `trust proxy`; `backend/middleware/securityMiddleware.js:11-20,23-29` uses default in-memory IP-keyed rate limiters. Nginx forwards `X-Forwarded-For` (`frontend/nginx.conf:7-14`), but Express does not trust it. Compose exposes only the frontend (`docker-compose.yml:49-59`) and the frontend proxies API requests to the backend. Thus backend `req.ip` is expected to be the proxy peer for proxied requests, not each browser. This is a source/configuration inference; Docker could not be inspected.
- **Root cause:** Confirmed configuration mismatch; deployed request-IP behavior NOT CONFIRMED. With the shown topology and default Express proxy trust, clients share a proxy-derived rate-limit key. Ten authentication attempts in the 15-minute limiter window can consequently throttle other users as well. The limiter's default memory store is also per-process, so limits do not coordinate across replicas.
- **Reproduction:** In an isolated Compose deployment, record backend `req.ip` for two clients, then use ten auth attempts from one client and observe whether the other client gets 429. Do not perform against production accounts.
- **Recommended fix:** Configure `trust proxy` only for known proxy hops/subnets, verify spoofed forwarding headers cannot alter the trusted client IP, and use a shared rate-limit store for multi-instance production deployments. Keep per-account/IP controls for auth abuse.
- **Required regression tests:** Proxy client-IP derivation, spoofed `X-Forwarded-For` rejection, independent clients receive independent limits, and multi-instance shared-store behavior.

### CS-P1-04 — Compose sets the backend to development and enables mock OTP by default

- **Severity:** High if Compose is used for production (Phase 2 deployment blocker until deployment mode is explicit)
- **Evidence:** `backend/Dockerfile:6-8` sets `NODE_ENV=production`, but `docker-compose.yml:17-18` overrides it with `development`; Compose defaults `OTP_MOCK_ENABLED` to `true` (`docker-compose.yml:35`). Production-only HTTPS-provider and mock-mode guards are in `backend/config/env.js:22-37` and therefore are not applied under this Compose configuration. The frontend image itself is built as a production static Nginx image (`frontend/Dockerfile:1-14`).
- **Root cause:** Confirmed configuration mismatch. Whether the Compose file is used outside local development is NOT CONFIRMED.
- **Reproduction:** Resolve/start Compose with the default OTP setting and inspect the backend's effective `NODE_ENV` and OTP mock mode; this runtime check was not possible here. Static configuration already establishes the override.
- **Recommended fix:** Keep a clearly development-only Compose configuration, and provide a production Compose/override or deployment manifest that sets `NODE_ENV=production`, requires real provider configuration, and sets mock OTP false. Fail deployment validation when development defaults are selected for production.
- **Required regression tests:** Render effective Compose config for dev and prod; production config refuses mock OTP, absent provider URL/key, insecure URL, or weak required secrets; dev remains usable with mock mode.

### CS-P1-05 — Mock mode does not support alumni verification or password recovery end to end

- **Severity:** High for these authentication journeys (Phase 2 functionality blocker)
- **Evidence:** `backend/utils/emailProvider.js:21-25` returns `{ accepted: true }` in non-production mock mode without sending or returning a reset/verification link. Alumni signup sends its verification URL through this function (`backend/controllers/authController.js:288-298`) and does not return the URL/token. Password reset likewise creates a token, calls the helper, discards the return value, and returns a generic message (`authController.js:392-409`). Student mock OTP is different: `sendVerificationCode` returns `previewCode` (`emailProvider.js:3-19`) and registration includes it in the dev response (`authController.js:194-201`).
- **Root cause:** Confirmed. Mock provider accepts email work that is never delivered and exposes no local preview for the opaque links.
- **Reproduction:** In development with mock enabled and no provider, submit alumni signup or forgot-password for a test account. The API reports a generic accepted response, but no email/link is sent or returned, so the recipient cannot complete the flow.
- **Recommended fix:** Provide a non-production-only, explicitly gated preview mechanism for reset/alumni links or a mail-capture provider. Never expose preview tokens in production. For real provider failures, retain generic anti-enumeration responses but roll back unusable tokens and emit actionable operational telemetry.
- **Required regression tests:** Mock alumni verification and password reset are completable in dev using safe preview/capture; production response never exposes raw tokens; provider failure leaves no unusable active token; generic response does not enumerate accounts.

### CS-P2-01 — Student email and enrollment are matched only by branch, not by section/roll

- **Severity:** Medium (identity integrity)
- **Evidence:** `backend/controllers/authController.js:89-132` normalizes and validates both values, then cross-checks only capture group 1 (branch) at lines 115-121. The configured SATI patterns encode section and roll in both identifiers, but no equality/relationship check is made for those components. Student data is then staged using the independently supplied values (`authController.js:184-192`).
- **Root cause:** Confirmed limited cross-check. Whether institution policy requires matching the encoded section/roll components is NOT CONFIRMED; the provided formats imply they identify the same student, but year/section mapping rules should be confirmed institutionally.
- **Reproduction:** Submit two syntactically valid identifiers with the same allowed branch but different section/roll components. Current source validates the formats and branch, without comparing the remaining identity components.
- **Recommended fix:** Obtain the authoritative mapping rules and compare the corresponding normalized section/roll fields before OTP issuance; avoid guessing year relationships.
- **Required regression tests:** Mismatched section and roll rejected, matching identities accepted across all branches and both sections, and explicitly documented year mapping cases.

### CS-P2-02 — Enrollment duplicate checks use the unnormalized request value and pending enrollments are not uniquely indexed

- **Severity:** Medium (duplicate registration/data integrity)
- **Evidence:** `validateStudentIdentity` lowercases enrollment at `backend/controllers/authController.js:96-98`, but duplicate queries use `enrollmentNumber.trim()` at lines 175 and 180. Stored pending payload uses normalized `identity.enrollmentNumber` at lines 184-191. `EmailVerification` has a unique index only on `{ email, kind }` (`backend/models/EmailVerification.js:13`), not on pending enrollment. Final `User` enrollment has a unique partial index (`backend/models/User.js:50`).
- **Root cause:** Confirmed inconsistent canonicalization and no pending enrollment uniqueness. Case-variant duplicate requests can miss the preliminary lookup. Concurrent requests for different emails with the same enrollment can both stage OTPs; the final User unique index prevents two completed accounts, but only at verification time.
- **Reproduction:** With an existing normalized enrollment, submit the same identifier in uppercase/case variant (if accepted by the configured validator) or concurrently stage two different emails for the same enrollment. Observe preliminary duplicate lookup behavior and verification-time conflict.
- **Recommended fix:** Use the normalized identity value consistently for every query and persist a canonical enrollment key with a uniqueness constraint for pending registrations, or perform an atomic reservation that expires safely.
- **Required regression tests:** Case-insensitive duplicate enrollment is detected before OTP issue; concurrent pending enrollment claims allow only one reservation; final uniqueness remains intact after expiration/retry.

### CS-P2-03 — Alumni verification and password-reset tokens are placed in browser URLs

- **Severity:** Medium (credential-like token exposure)
- **Evidence:** Alumni verification link includes `email` and raw token in the query string (`backend/controllers/authController.js:288-290`); `frontend/src/pages/VerifyAlumni.jsx` reads them from query parameters and POSTs them to the API. Password reset link creation is at `authController.js:403`. Reset UI also reads the token from `frontend/src/pages/ResetPassword.jsx:7,20`.
- **Root cause:** Confirmed token-in-query design. Actual leakage through browser history, analytics, referrer headers, or proxy logs is deployment-dependent and NOT CONFIRMED.
- **Reproduction:** Inspect the received email link, browser address bar/history, and same-origin request referrer/logging in a controlled environment. Do not use a live token.
- **Recommended fix:** Prefer a fragment or one-time POST handoff that is not sent in HTTP request URLs; set a strict referrer policy on verification/reset pages, avoid third-party assets/analytics there, and clear the token from browser history immediately after capture.
- **Required regression tests:** Tokens are absent from server/proxy access logs and subsequent referrers; successful one-time verification/reset remains possible; reused/expired tokens fail.

### CS-P2-04 — Super-administrator authorization is inconsistent on report queue

- **Severity:** Medium (role behavior; intent NOT CONFIRMED)
- **Evidence:** The global permission map grants `super_admin` wildcard access (`backend/utils/permissions.js:9-18`), while `GET /api/reports/open` uses exact `requireRole('admin')` (`backend/routes/reportRoutes.js:7-8`). `requireRole` checks exact inclusion (`backend/middleware/authMiddleware.js:39-43`). A `super_admin` therefore receives forbidden on this route despite wildcard permissions elsewhere.
- **Root cause:** Confirmed route-policy inconsistency; whether super-admins should review this queue is a product authorization decision and NOT CONFIRMED.
- **Reproduction:** Call `/api/reports/open` with a valid super-admin bearer token; route guard does not include that role. No runtime request was executed.
- **Recommended fix:** Make the policy explicit and consistent, preferably permission-based if the queue is governed by `grievances:review`; otherwise document and test the intentional exclusion.
- **Required regression tests:** Route authorization matrix for student, alumni, legacy admin, college admin, and super-admin against report queue and admin APIs.

### CS-P2-05 — Public Docker chat client bypasses the configured Socket.IO proxy

- **Severity:** Medium (Docker functionality; Phase 2 blocker if chat is in scope)
- **Evidence:** Chat uses `VITE_SOCKET_URL || 'http://localhost:5000'` (`frontend/src/pages/Chat.jsx:11`). Docker Nginx already proxies same-origin `/socket.io/` to `backend:5000` (`frontend/nginx.conf:16-23`), but Compose does not publish backend port 5000 (`docker-compose.yml:14-59`). In a browser using the Docker-hosted app, `localhost:5000` means the end user's machine, not the backend container.
- **Root cause:** Confirmed URL fallback conflicts with the Compose/Nginx topology. Whether chat is currently enabled in the deployed app is NOT CONFIRMED.
- **Reproduction:** Open Chat through the published Compose frontend and inspect the Socket.IO handshake destination; with no host service on port 5000, it cannot reach the Compose backend through that hard-coded fallback.
- **Recommended fix:** Default the socket client to the current origin (or a same-origin relative path) and use the Nginx `/socket.io/` proxy; configure an explicit socket URL only for deployments that need one.
- **Required regression tests:** Local Vite chat connects to local API backend; Docker browser connects through same-origin Nginx; authenticated handshake and message events work in both environments.

### CS-P2-06 — CI does not run frontend tests and backend authorization coverage is thin

- **Severity:** Medium (verification gap; Phase 2 blocker for release confidence)
- **Evidence:** Frontend CI runs `npm test --if-present` then build (`.github/workflows/ci.yml:13-28`); `frontend/package.json:6-9` defines no test script. Backend CI runs `npm test` and optional lint (`ci.yml:30-49`); backend tests include auth/password/OTP/role helper coverage (`backend/test/auth.test.js`) but no route-level tests for listing ownership, public PII fields, report authorization matrix, proxy rate-limit keys, or admin mutation pathways. The Mongo registration integration test skips without `TEST_MONGO_URI` (`backend/test/registration.integration.test.js:5-8,31`).
- **Root cause:** Confirmed from the checked-in CI/test setup. Exact CI outcomes are NOT CONFIRMED because CI was not run during this audit.
- **Reproduction:** Inspect the workflow and package scripts; frontend `npm test --if-present` performs no test command when no script exists. Integration coverage skips without the isolated Mongo URI.
- **Recommended fix:** Add focused frontend API/auth hydration tests, route-level authorization/ownership tests, and a CI Mongo service or isolated test database for integration coverage. Keep tests isolated from developer/prod data. Add lint scripts/config if lint is an intended gate.
- **Required regression tests:** CI logs show nonzero frontend test execution; backend auth/authorization tests run without skipping core flows; integration job uses a database name ending `_test` and cleans all fixtures.

### CS-P2-07 — Rate-limit behavior and database TTL/index deployment are not runtime verified

- **Severity:** Medium (operational assurance; NOT CONFIRMED runtime defect)
- **Evidence:** TTL and unique indexes are declared in Mongoose models: `User.js:6,50`, `EmailVerification.js:7,13`, `AlumniVerification.js:4-9`, `RefreshSession.js:5-8`, and `Connection.js:12`. Source declarations do not prove indexes exist in an already-running database, nor that legacy duplicates permit index creation.
- **Root cause:** NOT CONFIRMED. No database access or index inspection was performed.
- **Reproduction:** In a read-only production-approved inspection, list actual indexes for those collections and check build status/duplicates. Do not trigger migrations against production as part of this audit.
- **Recommended fix:** Add an explicit deployment/migration verification step for required unique/TTL indexes and fail readiness or rollout when required indexes are absent. Resolve legacy duplicates through a reviewed migration.
- **Required regression tests:** Integration test inspects required indexes in an isolated Mongo database and verifies TTL-backed records are rejected by query logic immediately at expiry (TTL deletion itself is asynchronous).

## Areas with positive source evidence

- Student OTPs are cryptographically generated (`backend/utils/auth.js:12`), HMAC-hashed with email binding (`auth.js:14`), compared with constant-time equality (`auth.js:16-19`), constrained to a 10-minute query window, and capped at five attempts (`authController.js:207-220`). Resend has a 60-second application cooldown (`authController.js:237-258`) plus the auth limiter. TTL indexes are declared; live index existence remains unverified.
- Password-reset tokens are 32 random bytes, stored as SHA-256 hashes, and expire after 15 minutes (`backend/utils/auth.js:21-26`). Reset consumes the matching token while updating password and increments `tokenVersion`, then revokes refresh sessions (`backend/controllers/authController.js:412-427`).
- Admin routes are behind `authMiddleware` and per-route permissions (`backend/routes/adminRoutes.js:18-34`); permission grants are derived from server-side role definitions (`backend/utils/permissions.js:1-18`). Role changes block self-change and restrict privileged roles (`backend/controllers/iamAdminController.js:91-98`).
- Most ownership-sensitive operations use authenticated identity or owner-scoped queries, including notification reads (`backend/controllers/notificationController.js:9-14`), connection responses (`backend/controllers/connectionController.js:66-70`), request status changes (`backend/controllers/requestController.js:69-76`), and report “mine” (`backend/controllers/reportController.js:24-26`). The listing update exception is CS-P1-01.
- Request bodies are capped at 2 MB; Helmet, Mongo operator sanitization, HPP, CORS credentials, and rate limit middleware are installed (`backend/app.js:25-53`; `backend/middleware/securityMiddleware.js:7-29`). CORS uses configured exact origins, and refresh/logout additionally require an allowed `Origin` (`backend/routes/authRoutes.js:23-27,39-40`). These source controls do not replace runtime proxy, cookie, or CSRF verification.

## Audit execution and limitations

- Code/config/test/CI inspection only; no automated tests or production builds were executed.
- Docker Compose runtime inspection was attempted and failed with `permission denied while trying to connect to the Docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
- No database records were read or changed. Actual Mongo index state, duplicate-data condition, and runtime request IP behavior remain unverified.
- Existing working-tree modifications were present before this audit. They were preserved; only this report was created in this turn.

## Confirmed Phase 2 blockers

1. **CS-P1-01:** Authenticated listing owner can reassign listing ownership through mass assignment.
2. **CS-P1-02:** Anonymous listing and bounty feeds expose account emails.
3. **CS-P1-03:** Compose reverse-proxy traffic is not configured as trusted proxy traffic for IP-based limits, risking shared rate-limit lockout; runtime behavior still requires Docker confirmation.
4. **CS-P1-05:** Development mock mode cannot complete alumni verification or password recovery.
5. **CS-P2-05:** Docker-hosted chat points at the browser’s `localhost:5000` instead of the backend proxy.
6. **CS-P2-06:** Frontend CI has no tests, and critical route-level authorization/privacy paths lack regression coverage.
7. **CS-P1-04 (conditional):** Do not use the current Compose environment defaults for production; they force development mode and default mock OTP on.

CS-P2-01 (identity component mapping), CS-P2-03 (URL token handling), CS-P2-04 (super-admin report access), and CS-P2-07 (live index state) require policy/runtime confirmation before being classified as release blockers.

