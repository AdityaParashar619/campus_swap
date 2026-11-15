# CampusSwap Production Deployment Guide

## Required production settings

Production startup requires:

- `NODE_ENV=production`.
- `JWT_SECRET` with at least 32 characters.
- `OTP_PEPPER` with at least 32 characters, independently generated and different from `JWT_SECRET`.
- `OTP_MOCK_ENABLED=false`.
- `RESEND_API_KEY` and `EMAIL_FROM` after the sending domain has been verified.
- `RESEND_DOMAIN_VERIFIED=true` only after checking verified DNS status in Resend. Keep the gate false while verification is pending; email endpoints remain safely unavailable.
- One or more HTTPS origin values in `FRONTEND_URL` (comma-separated origins, no paths).
- `TRUST_PROXY_HOPS` set to the exact ingress chain length. Do not set it to `true` or guess. The backend must not be directly exposed around that ingress.
- Institutional email/enrollment patterns, allowed domains, and branches appropriate to the institution.

Never commit `.env`, `.env.production`, real passwords, JWT secrets, OTP peppers, or mail-provider keys. `.env.production.example` contains placeholders only. Copy it to `.env.production`, replace every secret placeholder using an approved secret manager or secure random generation process, and keep the resulting file ignored by Git.

## Docker Compose deployment

The root `docker-compose.yml` is development-only: it fixes the backend to development mode and enables mock OTP by default. It must not be used alone for production.

Prepare an HTTPS reverse proxy in front of the Compose frontend. Terminate TLS there, overwrite incoming `X-Forwarded-For` and `X-Forwarded-Proto` headers with trusted values, forward `/api/` and `/socket.io/` to the frontend Nginx service, and configure the actual proxy-hop count in `.env.production`. The sample assumes two trusted hops (external TLS ingress plus frontend Nginx); verify your topology. Restrict direct access to the frontend origin so clients cannot bypass the trusted edge. The backend is internal to Compose and should not be published directly. The reverse proxy must support Socket.IO WebSocket upgrades.

Validate the merged settings without printing environment values:

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

Start only after validation and verified secrets/provider configuration:

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up --build -d
```

The production overlay explicitly disables mock OTP, sets production mode, passes Resend configuration, and requires the HTTPS frontend origin and trusted proxy hop count. It leaves MongoDB data in the named volume; do not remove the volume during deployment. With `RESEND_DOMAIN_VERIFIED=false`, the application can start but its email delivery calls return unavailable until the domain is verified and credentials are set.

## Email provider contract

The backend uses the Resend Node SDK and sends message content directly from the backend:

- Student registration and resend OTP.
- Alumni email verification and password reset links.
- Password-changed confirmation without secret content.

SDK requests abort after 10 seconds. Provider errors and network exceptions are mapped to safe service failures. Password recovery retains an enumeration-safe public response and clears the just-issued reset token when delivery fails; check Resend dashboard telemetry by time/status and application request ID. Password change success is not rolled back if the best-effort confirmation email fails. Local onboarding test mode routes all mail to a permitted Resend test recipient and cannot be enabled in production.

In local development only, mock mode makes student OTP and alumni/reset links available through a one-use `devMailPreviewToken` capability. The UI consumes it through `POST /api/auth/dev-mail-preview`; the raw OTP or link is not included directly in the registration/reset response. Captures expire after five minutes, are invalidated by a newer message for the same recipient and purpose, and are held in process memory. The endpoint works only when both `NODE_ENV=development` and `OTP_MOCK_ENABLED=true`; it does not support lookup by email.

For direct backend execution, `backend/config/env.js` resolves `backend/.env` relative to the module, independent of the shell's current directory. Docker Compose reads root `.env` for interpolation and explicitly injects backend settings; Compose values take precedence over dotenv. See [environment configuration](PHASE_0_1_ENVIRONMENT_CONFIGURATION.md) for local setup.

## Vercel/Render or split-host deployments

The Render frontend is a static site and does not receive the Docker Nginx `/api` or `/socket.io` proxy. Set `VITE_API_BASE_URL` to the deployed API `/api` base and `VITE_SOCKET_URL` to the deployed Socket.IO origin. `FRONTEND_URL` on the API must exactly include the static site's HTTPS origin. Set `TRUST_PROXY_HOPS` to the verified hosting ingress chain. Do not use the default browser `localhost` for a deployed socket URL.

## Rate limits and scaling

The application applies IP-based and account-keyed auth rate limits. Account limiter keys are SHA-256 digests of normalized email values rather than plaintext email. Express trusts only the configured number of proxy hops. Spoofed forwarding headers must not be trusted beyond the known ingress chain.

The current express-rate-limit configuration uses its process-local memory store. Run a single backend instance unless/until a shared production store (for example Redis) is configured for every replica. Scaling without shared rate-limit state allows limits to multiply by replica count and makes enforcement inconsistent.

## Database indexes and migrations

Mongoose models declare unique email and enrollment indexes, one-email/kind pending verification, unique refresh token hashes, unique enrollment reservations, and TTL indexes. The registration integration test verifies these declarations against its isolated Mongo database. A successful source/test run does not prove the production database has these indexes.

Before deploying to an existing database, inspect actual indexes and duplicate data using a read-only database review. Do not run `syncIndexes()` or delete/merge user records as an unreviewed migration. Resolve legacy duplicate email/enrollment data through a separately reviewed migration. The enrollment-reservation collection is new and can be created without modifying existing user records.

## Release checks

1. Run frontend tests/build and backend tests with the dedicated Mongo database named `*_test`.
2. Validate the production Compose overlay with `config --quiet` and keep its output secret-free.
3. Verify HTTPS, cookie flags, exact CORS origins, trusted proxy hop count, API proxy, and Socket.IO upgrades in a staging deployment.
4. Exercise registration, alumni verification, reset lifecycle, login, refresh rotation, role denial/allowance, ownership denial, and public-field privacy.
5. Inspect production Mongo indexes before enabling signup.
6. Verify provider delivery and the password-change confirmation template with a non-production provider account.

`docker compose config --quiet` passed during remediation. Docker Engine was unavailable (`npipe:////./pipe/dockerDesktopLinuxEngine` missing), so container startup/health, deployed proxy behavior and production database access were not verified. The staging/runtime checks above remain required before release; current status is NO-GO.
