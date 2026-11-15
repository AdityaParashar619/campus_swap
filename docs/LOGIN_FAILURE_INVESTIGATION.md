# CampusSwap Login Failure Investigation

> Follow-up disposition: the login failure was reproduced in an actual Express route regression test and fixed. `login` had wrapped `loginLogic` directly; `asyncHandler` passed Express `next` as `loginLogic`'s third, optional `createSession` argument. On success this invoked `next(user, req, res)`, producing the observed non-Error object and then a second JSON response. The final fix and verification are documented in [the final remediation report](PHASE_0_1_FINAL_REMEDIATION_REPORT.md) and [test report](PHASE_0_1_END_TO_END_TEST_REPORT.md).

**Scope:** Read-only audit of the login failure logs and the current repository source. No application code, configuration, dependencies, or database records were changed. The only file created for this audit is this report.

## Executive findings

1. **Double response at login — runtime failure confirmed by the supplied error, exact first-send location NOT CONFIRMED.** The stack says execution reached the login handler's final `res.json()` at runtime line 386 after headers had already been sent. In the current workspace source, login's session issuer only sets the refresh cookie and returns data; it does not send a response. Docker inspection was denied, so the running container source/version could not be compared. This strongly suggests the runtime has a different/stale implementation or injected/custom session creator, but that explanation is **NOT CONFIRMED**.
2. **`undefined` log — NOT CONFIRMED.** The current error middleware can print `undefined` if it receives a thrown/rejected object with neither `stack` nor `message`, but the available logs do not identify which error object generated the standalone line.
3. **Admin synchronization repeats — confirmed source defect.** The server calls admin synchronization on startup and every 30-second database retry tick, including after successful connection. Every sync of an existing bootstrap account increments `tokenVersion`, saves the account, and logs the message. This can repeatedly invalidate existing access tokens and generate write/log churn.
4. **Refresh 401 for no cookie — expected.** The refresh endpoint intentionally returns 401 when no refresh cookie is present. The frontend calls refresh during auth hydration, catches failure, clears local auth state and ends loading; it does not retry refresh recursively. Public login/register routes remain unauthenticated.
5. **Frontend backend target — configuration supports both local and Docker routing, actual browser target NOT CONFIRMED.** Default API URL is relative `/api`; Vite proxies to `localhost:5000`; Docker Compose builds `/api` and Nginx proxies it to `backend:5000`. Docker could not be queried and browser runtime configuration was not available.

## Request flow

### Login

1. Frontend `AuthContext` does a one-time `POST /api/auth/refresh` during hydration. A visitor without a refresh cookie gets a 401; the context catches it and leaves the user signed out.
2. Login form requests use the frontend API client. The client marks `/auth/login` as a public auth request, so a login 401 does not trigger a refresh retry.
3. Backend `/api/auth/login` is registered with the auth attempt limiter, required-field validation, email/password validation, then `login` (`backend/routes/authRoutes.js:38`). It does not have `authMiddleware`.
4. `loginLogic` lowercases the email for lookup, rejects missing users, blocked/suspended/pending accounts, bad passwords, and explicitly unverified email. Success calls `issueSession` then responds with JSON (`backend/controllers/authController.js:372-386`).
5. `asyncHandler` forwards rejected promises to Express error middleware (`backend/middleware/errorMiddleware.js:47-49`). Login validation failures and auth failures therefore take the normal error path before login sends a response. If a downstream session creator already sent a response, the final login `res.json()` becomes a second send.

### Refresh

`POST /api/auth/refresh` passes trusted-origin and rate-limit checks and calls `refreshSession` without bearer-auth middleware (`backend/routes/authRoutes.js:39`). Missing cookie throws 401 (`backend/controllers/authController.js:327-330`). Invalid/expired/revoked sessions also return 401; valid sessions rotate the refresh token and return access-token/user data (`backend/controllers/authController.js:331-350`).

## Findings

### 1. Login sends headers after a response has already been sent

**Severity: High**

The supplied Node error proves that at the time of the observed failure, a response had already been committed before the runtime executed the `res.json()` at `loginLogic` line 386. In the current repository, this is the only explicit login response in `loginLogic`: line 385 awaits `createSession(...)` or `issueSession(...)`, then line 386 calls `res.json(...)`.

The current default `issueSession` implementation persists the refresh session, sets an HttpOnly refresh cookie, and returns token/user data; it does **not** send a body (`backend/controllers/authController.js:145-159`). Thus the current source's normal `login` path does not explain the reported double send. The `createLoginHandler` factory accepts an injected `createSession` callback (`authController.js:390`), but the route imports the exported `login` function, not that factory (`authRoutes.js:6,38`).

**Confirmed:** runtime tried a second send at line 386; checked-in login's default session path does not send first.

**NOT CONFIRMED:** the actual first response site in the running backend, because Docker access was denied and deployed source/build identity is unavailable. Possibilities such as a stale image or a runtime session callback are hypotheses only.

**Recommended fix:** compare the exact running container's `controllers/authController.js` and imported session implementation against the workspace commit/image. Ensure the session creator only prepares session/cookie data and never writes the response; retain exactly one response owner in the controller. Add a regression test that exercises the actual route and asserts a single response on successful login. Do not mask this with `headersSent` handling alone.

### 2. Standalone `undefined` error log

**Severity: Medium (diagnostic gap); underlying cause NOT CONFIRMED**

The application error logger is `console.error(`[requestId]`, err.stack || err.message)` (`backend/middleware/errorMiddleware.js:40-41`). If Express receives a plain object with neither `stack` nor `message`, the second argument is `undefined`. Several validation middleware paths call `next({ status, message, ... })`, so those known objects do have messages (`backend/middleware/validateMiddleware.js:7-11,42-44`); they do not by themselves explain the line.

The supplied `undefined` line might come from this logger receiving a different error shape, but available evidence does not tie it to the login. The later `ERR_HTTP_HEADERS_SENT` stack is a real Error and should have a stack, so that stack alone would not normally produce `undefined` from this expression.

**Recommended fix:** correlate with request ID and inspect the exact value passed to the error handler in the running build. Normalize non-Error rejections before logging and log a stable fallback for missing stack/message. Keep internal stack details out of client responses.

### 3. Admin bootstrap repeats and invalidates access tokens

**Severity: High for active sessions; Medium for log/database churn**

`startServer()` invokes `connectDatabaseInBackground()` at listen time and schedules it every `env.databaseRetryIntervalMs` (`backend/server.js:68-74`; default 30 seconds at `backend/config/env.js:48`). The `connecting` guard only prevents overlapping attempts; it is cleared after every attempt (`server.js:46-59`). There is no already-connected/once-only guard. Each successful retry calls `ensureAdminUser()` (`server.js:51-55`).

For an existing administrator, `ensureAdminUser()` updates role/status fields, increments `tokenVersion`, saves the user, and logs “Bootstrap administrator role synchronized…” on every call (`backend/scripts/ensureAdmin.js:13-25`). `tokenVersion` is included in access tokens (`backend/controllers/authController.js:147`) and compared against the current user in socket auth (`backend/server.js:18-20`; bearer auth implementation should also be verified in the backend middleware). Repeated runs therefore invalidate previously issued access tokens at the next comparison and may make authenticated requests appear to lose session state. The log repetition is directly explained by the periodic retry loop.

**Recommended fix:** run bootstrap only after the first successful database connection, or make reconciliation idempotent and only save/increment `tokenVersion` when security-relevant state actually changes. Verify whether the running container uses this same source.

### 4. Missing refresh token returns 401; frontend handles it without a retry loop

**Severity: Low / expected behavior**

A missing cookie produces `Unauthorized('Session unavailable…')` (`backend/controllers/authController.js:327-330`). The request logger records `auth=no` based on the Authorization header, not the refresh cookie (`backend/middleware/requestMiddleware.js:11-21`), so `auth=no` is expected on a cookie-based refresh request.

`AuthContext` makes one refresh request at startup, catches failure, clears local user/access token state, and then sets `loading=false` (`frontend/src/context/AuthContext.jsx:15-41`). The interceptor excludes `/auth/refresh` itself from retry and excludes public login/register requests (`frontend/src/services/api.js:49-63`). Therefore the observed unauthenticated refresh 401 is expected, and source shows it should not prevent public pages from rendering. No protected-route behavior was independently exercised in a browser during this audit.

### 5. Login identity and account checks

**Severity: Informational; no source defect confirmed for these checks**

- Email is looked up in lowercase form (`backend/controllers/authController.js:376`); model email is lowercase and trimmed (`backend/models/User.js:6`).
- Password is checked with `bcrypt.compare(password, user.password)` (`authController.js:381`). Password hashes are selected by default in the model (`User.js:8`), so the comparison has access to the hash.
- Blocked, suspended, and pending accounts are rejected with the same generic “Invalid credentials” response as a nonexistent account or wrong password (`authController.js:377-384`), which avoids revealing account existence/status.
- `emailVerified === false` is rejected; missing legacy value is not rejected by this condition. That appears backward-compatible but means records without the field are treated as verified at login; whether that is intended is **NOT CONFIRMED**.
- The role is not used to decide whether a login is allowed; `sanitizeUser` derives permissions/profile data from user role (`authController.js:30-40`). Admin role syncing is a separate startup task described above.

### 6. Local vs Docker backend target

**Severity: NOT CONFIRMED as the cause of this incident**

The frontend API client uses `VITE_API_BASE_URL` or defaults to `/api` (`frontend/src/services/api.js:8-11`). Local Vite development proxies `/api` to `http://localhost:5000` (`frontend/vite.config.js:6-14`). Docker Compose builds the frontend with `/api` and exposes it on port 8080 (`docker-compose.yml:49-59`); frontend Nginx proxies `/api/` to `http://backend:5000/api/` (`frontend/nginx.conf:7-14`). Those are coherent local and Docker paths.

Docker engine access was denied (`permission denied ... dockerDesktopLinuxEngine`), so the running container/image, its source line 386, and actual browser network destination could not be inspected. The supplied logs alone do not prove which frontend/backend instance served the request.

## Reproduction steps

1. **Expected unauthenticated refresh:** open the public app with no refresh cookie; observe the one hydration `POST /api/auth/refresh` return 401 “Session unavailable.” Confirm the public login/registration route renders afterward and no repeated refresh requests occur.
2. **Double-send failure (runtime build required):** submit valid login credentials against the exact backend image that emitted the log. Capture request ID and full server stack. Inspect the runtime line 386 and the preceding call's response behavior. Current workspace source alone does not reproduce the reported double send.
3. **Repeated admin sync:** start the backend with MongoDB and bootstrap admin variables configured, then observe logs and the admin user's `tokenVersion` across one database retry interval. This audit did not connect to or inspect the database.
4. **Frontend target:** load the app through local Vite and through Docker's published frontend port and inspect the resolved `/api/auth/login` network request and corresponding backend request ID.

## Tests needed

No tests were run as part of this audit because the user requested diagnosis/reporting only and Docker runtime access was denied. Recommended tests:

- Route-level successful login test with a real/default session issuer: one JSON response, refresh cookie set, valid user/token payload.
- Route-level login tests for missing/malformed payload, unknown email, wrong password, unverified account, blocked/suspended/pending account; each should return one appropriate response and never hit `ERR_HTTP_HEADERS_SENT`.
- Test a rejected session persistence operation to verify one sanitized 500 response and a useful internal log.
- Error middleware test for Error, validation object, and malformed/plain-object rejections to ensure logging never prints an ambiguous bare `undefined`.
- Server bootstrap test proving admin synchronization runs once per successful startup/connection and does not increment `tokenVersion` on unchanged state or recurring retry ticks.
- Frontend tests for unauthenticated hydration, refresh 401, login 401, and protected-request refresh failure: public pages remain available and refresh is attempted at most once per protected request.
- Deployment smoke test against the selected local/Docker frontend and backend, checking `/api/live` or the configured health path and request ID correlation.

## Audit limitations

- Docker daemon access was denied, so runtime source and container identity could not be verified.
- No database was queried or changed.
- The standalone `undefined` log's origin and the exact first response writer in the running login process remain **NOT CONFIRMED**.
- Existing unrelated working-tree modifications were present before this report; this audit did not edit or revert them.
