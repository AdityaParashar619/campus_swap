# CampusSwap production deployment runbook

This runbook prepares a deployment; it does not authorize provisioning, DNS changes, or production data changes.

## Recommended initial architecture

Use one small Linux VPS running Docker Compose, with a host-level TLS reverse proxy (Caddy or an equivalently maintained proxy) in front of the frontend container. Keep the frontend bound to `127.0.0.1`, the backend and MongoDB on the private Compose network, and MongoDB on persistent storage. Run one backend replica because rate limits are process-local.

Use an authenticated MongoDB URI. A managed MongoDB service is safer operationally when its monthly cost is acceptable; otherwise run authenticated MongoDB on the VPS and copy encrypted backups to a separate restricted storage location. Cloudinary and the configured email provider remain external services.

The production Compose overlay initializes a least-privilege application user only when MongoDB starts with a brand-new production volume. Deploy with a distinct Compose project name such as `campusswap-production`; never point this initialization flow at the existing development volume. Changing initialization variables does not rotate credentials on an already initialized volume.

Approximate monthly planning ranges, excluding taxes and usage overages:

- Single VPS: USD 6–15; off-host backup storage: USD 1–5; domain: typically USD 10–20/year.
- Hybrid VPS plus managed MongoDB: USD 6–15 plus USD 0–25+ for the database, depending on free-tier eligibility and storage.
- Fully managed frontend/API/database: often USD 0 during evaluation, but reliable always-on service commonly reaches USD 15–50+ and may sleep, restrict WebSockets, or impose egress/build limits.

Provider prices and free-tier terms must be checked during Stage B. The single-VPS design is the simplest initial operating model, but it is a single failure domain and does not provide zero-downtime deployments.

## Required configuration

Create `.env.production` from `.env.production.example`; never commit it. Required values include:

- independent random `JWT_SECRET` and `OTP_PEPPER` values of at least 32 characters;
- an authenticated `MONGO_URI` containing the explicit `campusswap` database;
- the exact HTTPS browser origin in `FRONTEND_URL`;
- the verified proxy hop count in `TRUST_PROXY_HOPS`;
- production-ready Resend or Gmail configuration, with mock/test modes disabled;
- all three backend-only Cloudinary credentials;
- institutional domain, enrollment, branch, department, and semester policy values.

Do not prefix backend secrets with `VITE_`. Only public API/socket origins may enter a frontend build. Validate without printing the merged environment:

```powershell
docker compose -p campusswap-production --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

## TLS, proxy, and cookies

The public endpoint must be HTTPS. Redirect HTTP to HTTPS at the edge, enable HSTS only after HTTPS and domain ownership are verified, and forward `/`, `/api/`, and `/socket.io/` to `127.0.0.1:8080`. Preserve WebSocket upgrade headers and use a read timeout longer than expected idle heartbeats.

The backend sets refresh cookies as `HttpOnly`, `Secure`, `SameSite=None`, scoped to `/api/auth` in production. Therefore production cannot be tested over plain HTTP. `FRONTEND_URL` must contain exact HTTPS origins; wildcard credentialed CORS is not supported. Provider-generated HTTPS hostnames are sufficient when stable and supported by both the frontend and API host. A custom domain is optional unless institutional branding or provider requirements demand one.

## Build and deploy

1. Back up MongoDB and verify the archive checksum.
2. Record the current image identifiers and Git commit.
3. Run tests and validate Compose configuration.
4. Build images without removing volumes.
5. Start the stack and wait for readiness.
6. Verify `/api/live`, `/api/health`, frontend HTTP, login/refresh, Socket.IO, email, Cloudinary, and restricted admin routes.

```powershell
docker compose -p campusswap-production --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose -p campusswap-production --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
```

`/api/live` proves the process can answer HTTP. `/api/health` is readiness and returns 503 while MongoDB is unavailable.

## Backup and recovery

Run `mongodump` from a restricted host using a least-privilege backup credential. Write outside the repository, gzip the archive, calculate SHA-256, and upload an encrypted copy to a different failure domain. Never place the URI in shell history or logs; inject it through the protected runtime environment.

Recommended initial policy:

- daily backups retained for 14 days;
- weekly backups retained for 8 weeks;
- monthly backups retained for 6 months;
- automated checksum verification after every backup;
- monthly restore rehearsal into an isolated database whose name ends in `_restore_test`;
- alerts on backup age, failure, checksum mismatch, and insufficient disk space.

Example commands, with the URI supplied securely by the operator:

```powershell
mongodump --uri $env:CAMPUSSWAP_BACKUP_URI --db campusswap --archive=campusswap.archive.gz --gzip
Get-FileHash -Algorithm SHA256 .\campusswap.archive.gz
mongorestore --uri $env:CAMPUSSWAP_RESTORE_TEST_URI --nsFrom "campusswap.*" --nsTo "campusswap_restore_test.*" --archive=.\campusswap.archive.gz --gzip
```

After an isolated restore, compare collection counts, required indexes, and an administrator identity projection without printing hashes or tokens. A production restore requires a maintenance window, a fresh pre-restore backup, explicit approval, and a documented rollback point.

## Monitoring

For the initial single-VPS release, use lightweight external HTTPS checks plus host/container monitoring:

- poll `/api/live` every minute and `/api/health` every 1–5 minutes;
- alert after consecutive failures, not one transient failure;
- monitor container restart counts, exit codes, memory, CPU, disk usage, volume free space, and backup age;
- retain Docker logs with size/rotation limits and collect only request IDs, status, duration, and sanitized provider events;
- alert on elevated HTTP 5xx rates and repeated `auth_email_*_failed`, Cloudinary cleanup/upload failures, Mongo disconnects, and Socket.IO connection errors;
- test a real Socket.IO connection from an external synthetic client during Stage B.

Never log authorization headers, cookies, OTPs, reset links, passwords, provider credentials, MongoDB URIs, or private profile bodies.

## Rollback

Keep the previous immutable image tags. If readiness fails, stop the new containers and start the previous image set without deleting the MongoDB volume. Do not roll application images backward after an incompatible schema migration unless its reviewed data rollback is also available. CampusSwap currently has no migration framework, so every future schema change needs an explicit compatibility and rollback review.

Troubleshooting order:

- Backend deployment failure: inspect sanitized startup logs, environment validation, image digest, and `/live`.
- MongoDB failure: keep traffic out, inspect `/health`, credentials, network, storage, and disk; do not initialize a replacement volume automatically.
- Invalid environment: correct the secret/config source and redeploy; never add fallback secrets.
- WebSocket failure: verify HTTPS `wss://`, upgrade headers, timeouts, CORS origin, and proxy hop count.
- Email failure: use request IDs and provider telemetry; do not expose OTPs or switch production to mock mode.
- Cloudinary failure: preserve database ownership records and retry only provider operations proven to belong to those records.

## Secret rotation

- Rotating `JWT_SECRET` invalidates all access tokens immediately.
- Rotating `OTP_PEPPER` invalidates outstanding OTPs.
- Database, email, and Cloudinary credentials should overlap during a controlled rotation when the provider supports it.
- Revoke the old credential only after health, login, upload, and delivery verification.
- Never rotate administrator credentials as a side effect of deployment.

## Release gate

Production remains blocked until Stage B supplies a host/provider, HTTPS hostname, authenticated database, verified email delivery, Cloudinary credentials, off-host backup destination, tested restore rehearsal, monitoring destination, and disposable accounts for authenticated browser and two-user Socket.IO tests.

## Limited pilot controls

Pilot registration can be restricted without changing the normal registration workflow. Set `PILOT_MODE_ENABLED=true` and inject `PILOT_ALLOWED_EMAILS` as a comma-separated secret. The backend normalizes email case and rejects non-allowlisted registrations before creating an OTP, reservation, or user. Startup fails closed if pilot mode has an empty, duplicate, or malformed list. Keep the mode disabled in normal development and never place participant identities in source control.

Administrator creation is a one-time operation for a fresh database. Supply a unique email and strong password through the secret store, set `ADMIN_BOOTSTRAP_ENABLED=true` for one controlled startup, verify the created role, then remove the password and set the flag back to false. Bootstrap refuses any email that already exists and never updates roles or passwords. Do not enable it on a restored database or copy the development administrator into production.

The configured provider is authoritative: Compose development defaults to Gmail; direct backend startup and the production overlay default to Resend. Gmail remains supported and requires only Gmail credentials plus `EMAIL_FROM`. Resend DNS verification is required only when `EMAIL_PROVIDER=resend`; unused provider credentials are not required. Before a pilot, send registration and password-reset messages to approved institutional test accounts and verify provider acceptance, mailbox receipt, expiry, resend throttling, and that logs contain no OTP or credential values.

## Legacy administrator avatar

The development administrator's embedded data URL inflates `/api/auth/me` and should not be copied to production. Do not mutate it automatically. For a controlled manual migration: export the exact `profilePicture` field to an encrypted restricted rollback file outside the repository; decode and inspect the image locally; authenticate as the preserved administrator; upload that same image through `PATCH /api/auth/me/avatar`; verify the returned URL is HTTPS and belongs to the configured Cloudinary account, refresh `/api/auth/me`, and inspect the Profile page. Retain the rollback export until a backup and UI check succeed. If verification fails, restore only the original `profilePicture` field using the exact administrator ID. Never delete a Cloudinary asset or the rollback copy based solely on a URL.

## Phase 4.4B local validation

The isolated stack uses `campusswap_phase44b_test` on a MongoDB `tmpfs`; it does not mount or reset the development volume:

```powershell
docker compose -p campusswap-phase44b -f docker-compose.e2e.yml up -d --build
npm --prefix frontend run test:e2e
$env:E2E_ACCESS_TOKEN_TTL='3s'; docker compose -p campusswap-phase44b -f docker-compose.e2e.yml up -d --force-recreate
$env:PHASE44B_SOCKET_URL='http://127.0.0.1:5100'; npm --prefix backend test -- --test-name-pattern='real Socket.IO'
docker compose -p campusswap-phase44b -f docker-compose.e2e.yml down
```
