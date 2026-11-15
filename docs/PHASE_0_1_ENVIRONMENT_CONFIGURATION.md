# CampusSwap Phase 0/1 Environment Configuration

## Environment source by run mode

| Mode | Configuration source | Database target |
|---|---|---|
| Direct backend Node (`cd backend; npm start` or `node server.js`) | `backend/.env`, resolved relative to `backend/config/env.js`; inherited process variables override dotenv values. | `MONGO_URI` in `backend/.env`; the sample points to local `127.0.0.1`. |
| Docker Compose development | Root `.env` is read by Compose interpolation and selected values are passed explicitly into the backend container. The backend loader uses `backend/.env` only as fallback; Compose-injected process values win. | Compose explicitly sets `mongodb://mongodb:27017/campusswap` on the internal Mongo service. |
| Production Compose overlay | `--env-file .env.production` supplies Compose interpolation; production overlay sets `NODE_ENV=production`, disables mock OTP, and keeps Resend sends gated until `RESEND_DOMAIN_VERIFIED=true`. | Internal Compose Mongo service; use a separately managed persistent volume and reviewed migration process. |

The root and backend `.env.example` files are examples only. They contain placeholders or empty administrator credentials and no actual secrets. Keep real `.env*` files ignored. Safe indicator checks from both the repository root and backend directory confirmed that direct Node resolves the same backend configuration and reported only boolean presence flags; no secret values were printed. Existing local `.env` files and administrator credentials were not changed.

## Local development setup

1. Copy `backend/.env.example` to `backend/.env` and replace the placeholder JWT secret and OTP pepper with separate random values.
2. Set `MONGO_URI` to a local development database, `NODE_ENV=development`, and `OTP_MOCK_ENABLED=true`.
3. Leave `RESEND_API_KEY` blank only while using the development mock. To test Resend without verified DNS, set `OTP_MOCK_ENABLED=false`, `RESEND_TEST_MODE=true`, an API key, `EMAIL_FROM=CampusSwap <onboarding@resend.dev>`, and `RESEND_TEST_RECIPIENT=delivered@resend.dev`. This is a provider test, not an institutional inbox test.
4. Start MongoDB, then run `cd backend; npm start`.
5. Run the frontend from `frontend` with `npm run dev`. Its Vite proxy targets the backend at `http://localhost:5000`; public pages do not require a refresh cookie.
6. Register a test student. The API returns an opaque `devMailPreviewToken`; the frontend consumes it once from `POST /api/auth/dev-mail-preview` and displays the captured code. The capability expires after five minutes, is invalidated by a newer message for the same recipient/purpose, and cannot be queried by email address.

Development mail capture is in-memory and intended for a single local backend process. Restarting the backend clears captures. The endpoint is unusable unless both `NODE_ENV=development` and `OTP_MOCK_ENABLED=true`.

## Email provider modes

- Development mock: `OTP_MOCK_ENABLED=true`; no external provider required. Student OTP, alumni verification link and reset link are available only through one-use mail-capture capabilities.
- Real development delivery: `OTP_MOCK_ENABLED=false`; configure `RESEND_API_KEY` and `EMAIL_FROM`, or use the explicit Resend test mode described above. SDK calls time out after ten seconds. A failure does not leave an unusable student enrollment reservation or reset token.
- Production: startup rejects mock mode, missing independent OTP pepper, weak JWT secret, and absent proxy trust configuration. Sending stays unavailable until the operator sets `RESEND_DOMAIN_VERIFIED=true` after DNS is verified and configures the Resend key and verified sender. Never expose OTPs/reset tokens from production APIs.

## Proxy and API configuration

Compose uses same-origin `/api` and `/socket.io` through frontend Nginx. For split hosting, set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to deployed endpoints, and set `FRONTEND_URL` to the exact allowed browser origin. Set `TRUST_PROXY_HOPS` to the verified ingress chain only; do not trust arbitrary forwarding headers. The process-local rate limiter requires a single backend instance unless a shared production store is configured.

## Validation executed

- Backend configuration startup tests cover development mock, missing Resend settings, onboarding test configuration, production mock rejection, and the production sending-domain gate.
- Direct environment loader check from root and backend directories passed without printing any secret values.
- `docker compose config --quiet` passed. Docker daemon was unavailable, so container startup, health checks and proxy runtime were not verified.
