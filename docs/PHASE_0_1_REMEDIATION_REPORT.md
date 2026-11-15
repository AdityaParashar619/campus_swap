# CampusSwap Phase 0/1 Consolidated Remediation Report

> Historical checkpoint. Current implementation status and executed results are in [the final remediation report](PHASE_0_1_FINAL_REMEDIATION_REPORT.md) and [end-to-end test report](PHASE_0_1_END_TO_END_TEST_REPORT.md). Those reports supersede test counts and limitations below where they differ.

## Outcome

The reviewed source-level Phase 0/1 remediation is implemented. Release status remains **NO-GO** because deployment runtime, live database indexes, and institutional policy cannot be confirmed from the available environment. No database records were accessed, migrated, or deleted.

This report does not repeat the incident narrative in [the login investigation](LOGIN_FAILURE_INVESTIGATION.md), registration diagnosis in [the OTP report](REGISTRATION_OTP_DEBUG_REPORT.md), or earlier broad findings in [the remaining audit](PHASE_0_1_REMAINING_AUDIT_REPORT.md). It records the implementation disposition and open release gates.

## Changes made

- Listing updates now accept only explicitly editable fields and use an atomic owner-scoped query. Listing delete is also owner-scoped. Anonymous listing and bounty feeds use a shared serializer that omits email and phone/WhatsApp contact fields.
- Auth error handling normalizes non-`Error` rejections and avoids writing a second response after headers have been sent. Login and error middleware tests exercise one-response behavior; this does not prove the supplied Docker incident is fixed in the deployed image.
- Bootstrap administrator sync skips writes/logging/token invalidation when role/security state is unchanged. Security-state changes revoke refresh sessions; existing passwords and explicitly blocked accounts are preserved.
- OTP, alumni verification, and password-reset local previews are gated to development. Reset/alumni tokens are placed in URL fragments, removed from browser history after capture, and reset tokens are single-use. Provider failure cleanup and password-change confirmation handling are tested with mocks.
- Authentication routes retain public registration/login behavior. Authenticated frontend retries refresh at most once and do not recurse on public auth or refresh requests. Account-level rate-limit keys use normalized-email hashes.
- Proxy trust has an explicit hop count. Socket authentication uses the backend token subject and current account/token version; client-supplied identity is not authoritative.
- Listing/admin moderation paths validate editable/status fields and protect privileged accounts. Report queue access uses the existing `grievances:review` permission.
- Pending enrollment claims now use unique, expiring reservations in addition to normalized enrollment checks. Model declarations include unique email/enrollment indexes and token/verification indexes.
- Development and production Compose configurations are separated. Production requires HTTPS provider/origin settings, independent OTP pepper, explicit proxy trust, and mock OTP disabled. A later review found credential-like administrator values in an environment example and replaced them with empty placeholders. Actual `.env` files and administrator credentials were not changed; see the final environment report.
- CI now includes frontend tests/build, backend tests with a dedicated Mongo service/database, and production Compose configuration validation.
- Added [production deployment guide](PRODUCTION_DEPLOYMENT_GUIDE.md) documenting proxy topology, provider templates, rate-limit scaling, and safe index migration review.

## Follow-up investigation: HTTP 429 and administrator bootstrap

### Rate-limit configuration

- **Environment variables are supported.** `backend/config/env.js:80-81` parses `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`, falling back to `900000` ms (15 minutes) and `200` when unset or invalid/zero. The inspected runtime values being `undefined` therefore select those defaults; they do not disable limiting.
- `backend/.env.example:23-24` documents those two values, but `docker-compose.yml` does not pass either variable into the backend container. With the provided runtime inspection, the Compose container uses the code defaults. Root `.env` values alone would not be forwarded unless explicitly interpolated in the Compose `environment` map.
- `backend/middleware/securityMiddleware.js:11-21` applies the global in-memory IP limiter to every request, including health endpoints. It permits 200 requests per 15 minutes per derived client IP by default.
- `securityMiddleware.js:24-32` applies a separate, hard-coded 10-per-15-minute IP limiter to authentication endpoints. `securityMiddleware.js:36-44` applies another separate, hard-coded 10-per-15-minute limiter keyed by SHA-256 of normalized email for routes that include it. These are independent limiter stores. The same IP limiter instance is shared across the auth routes using it; the account limiter is likewise shared across routes using it.

### Authentication endpoint limiter map

All endpoints below also pass through the global 200-per-15-minute limiter in `backend/app.js:48-50`.

| Endpoint | Additional limiter(s) |
|---|---|
| `POST /api/auth/register`, `/register/student` | Auth IP 10/15m; account 10/15m |
| `POST /api/auth/register/alumni` | Auth IP; account |
| `POST /api/auth/verify-alumni-email`, `/verify-email`, `/resend-otp` | Auth IP; account |
| `POST /api/auth/login` | Auth IP; account |
| `POST /api/auth/refresh` | Trusted-origin check, then auth IP; no account key |
| `POST /api/auth/logout` | Trusted-origin check only; global limiter still applies |
| `POST /api/auth/forgot-password` | Auth IP; account |
| `POST /api/auth/reset-password` | Auth IP; no account key |
| `GET /api/auth/users`, `GET /me`, `PATCH /me`, `PATCH /me/password` | Global limiter; protected routes additionally require authentication |

The map is from `backend/routes/authRoutes.js:32-47`. A caller behind a shared public NAT can consume the same 10-per-15-minute auth-IP bucket as other users behind that address, even when their account keys differ. The account limiter can separately throttle repeated attempts against one normalized email.

### Proxy identity and spoofing

- The current checkout **does configure Express proxy trust**, at `backend/app.js:35`, using validated `TRUST_PROXY_HOPS` from `backend/config/env.js:22,30,58`. This corrects the older statement in `PHASE_0_1_REMAINING_AUDIT_REPORT.md` that `app.js` did not configure proxy trust; that statement predates the current source state.
- Development Compose defaults to one trusted hop (`docker-compose.yml:21`). The frontend Nginx appends its observed peer address to `X-Forwarded-For` (`frontend/nginx.conf:13`). With one Nginx hop, Express uses the rightmost appended peer address, so a client-provided leftmost spoof does not change the rate-limit identity. This assumes requests pass through the configured proxy and the hop count matches the actual topology. Directly exposing the backend with positional proxy trust, or misconfiguring the hop count, can make forwarded identity unsafe. For an extra ingress hop, it must overwrite untrusted forwarding headers and `TRUST_PROXY_HOPS` must reflect the real chain.
- A one-off loopback HTTP experiment was executed without writing files. It configured a 1-request global limit and a one-hop proxy that appends the connected client's address like Nginx: client A received 200; A's next request with a different spoofed `X-Forwarded-For` received 429; client B at a different source address received 200. This demonstrates independent identities and spoof resistance for that modeled one-proxy topology. It is not a persisted automated regression test and does not verify the deployed Nginx/ingress.
- The committed `backend/test/proxyRateLimit.test.js` only checks Express's configured trust-hop function and normalized account-key hashing. It does not automate the independent-client/spoofed-header scenario. No test file was added because this follow-up explicitly prohibited file changes other than this report.

### 429 attribution: NOT CONFIRMED

The observed `RATE_LIMIT_* = undefined` values alone do not explain a 429. They mean default limits are active. A shared-IP throttle is plausible if the requester shares a public/NAT address with enough previous auth attempts in the same 15-minute window, but the inspected five-minute log excerpt contains no login request or auth 429. `backend/middleware/requestMiddleware.js` logs completed non-GET requests, and it runs before `securityMiddleware`; therefore a 429 produced by this backend instance should appear as a request log (for example, `POST /api/auth/login 429`). On the supplied evidence, the 429 was not shown to originate from this instance. An omitted/rotated log, another replica, a different configured API origin, an upstream gateway, or a different timeframe remain possible. No prior attempts or actual rate-limit key could be inspected, so shared-IP causation is **NOT CONFIRMED**.

For attribution, capture the exact response body, `RateLimit-*`/`Retry-After` headers, `x-request-id`, request URL/origin, and matching logs from every backend replica and any upstream proxy. The three limiter messages distinguish global, auth-IP, and per-account responses. Keep existing limits unchanged until that evidence identifies the limiting layer.

### Administrator bootstrap cadence

- `backend/server.js:60-64` starts a background DB attempt on listen and schedules `connectDatabaseInBackground()` every `env.databaseRetryIntervalMs`, default 30 seconds (`backend/config/env.js:79`). The interval is not cancelled after a successful connection.
- Once Mongo is connected, `backend/config/db.js:9-10` makes later `connectDB()` calls return immediately, but `server.js:44` still calls `ensureAdminUser()` after every call. Thus an admin lookup/sync check does recur every 30 seconds in a healthy process.
- The current `backend/scripts/ensureAdmin.js:17-22` returns without writing or logging when role and account type already match. The “Bootstrap administrator role synchronized” log is emitted only after an actual role/account-type change (`ensureAdmin.js:22-28`), so that message should not recur every 30 seconds in a stable single instance. Repeated identical log entries could indicate an older image, a restart, repeated external mutation, or another process/configuration changing the role/account type; none is confirmed from the supplied logs. The periodic admin check is not itself a source of HTTP 429s. The smallest future code change is to stop the DB retry timer after a successful initial connection and re-arm retries only after a real disconnect, while retaining idempotent admin sync.

### Smallest safe response

Do not disable or raise limits based only on undefined runtime env output. First verify the actual API origin and correlate the 429 response metadata with backend/upstream logs. Keep `TRUST_PROXY_HOPS` aligned with the reachable proxy chain, ensure the outermost trusted ingress overwrites client-supplied forwarding headers, and retain the backend's private network boundary. If confirmed same-NAT false positives are affecting users, a later reviewed change should preserve both IP and account abuse controls while addressing keying or policy intentionally; it should not silently remove the IP limiter.

The requested permanent HTTP regression cases (distinct client identities and spoofed `X-Forwarded-For`) remain outstanding due to the read-only constraint. The one-off behavior test above is evidence, not a substitute for committed CI tests.

## Verification performed

See [the regression test report](PHASE_0_1_REGRESSION_TEST_REPORT.md) for commands and counts.

- Backend suite: 50 passed, 0 failed, 1 skipped. The skipped test requires `TEST_MONGO_URI` naming a dedicated database ending in `_test`.
- Frontend suite: 5 passed, 0 failed.
- Frontend production build: passed.
- Backend JavaScript syntax checks and `git diff --check`: passed.
- Merged production Compose configuration with placeholder env: passed `docker compose ... config --quiet`.
- Lint: not configured in either package; no lint result is claimed.
- Runtime: `docker compose ps` could not connect to Docker Desktop because the named-pipe access was denied. No Docker container or Mongo runtime checks were completed.

## Confirmed Phase 0/1 blockers

1. **Institution identity policy unresolved (CS-P2-01).** The application validates configured email/enrollment formats and branch compatibility, but no authoritative policy was supplied for matching graduation/admission year, section, and roll components across the two identifiers. Do not implement inferred coupling.
2. **Production Mongo indexes/data not verified (CS-P2-07).** Model declarations and an isolated Mongo regression test exist, but the integration test was skipped. Existing deployments require a read-only duplicate/index review before applying unique indexes.
3. **Reported login double-send remains NOT REPRODUCED in the target runtime.** The current source has a one-response path under tests, but the reported running image could not be inspected or restarted. Validate that the deployed image matches this checkout and reproduce with the original request before closing the incident.
4. **Production ingress and mail provider not staging-verified.** Compose config parses, but container startup, secure cookie behavior, forwarded headers, external email delivery, and Socket.IO upgrades require the real deployment topology/provider.
5. **Multi-replica auth rate limiting is not ready.** Rate-limit state is process-local; production must remain single-backend-instance until a shared store is configured and tested.

## Other constraints / unresolved items

- No lint script or linter is configured; lint coverage remains absent.
- Remote CI was not executed from this workspace.
- `render.yaml` deployment settings were inspected/updated but not exercised in a live Render environment.
- Mongo integration fixture cleanup is scoped to IDs created during the test. The integration test intentionally refuses any database whose name does not end in `_test`.

## Recommendation

Do not declare production-ready or begin Phase 2 release work until the five blockers above are closed or explicitly accepted by the institution and release owner. The current result supports source-level remediation and local unit verification only.
