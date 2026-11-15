# Email and OTP configuration

## Modes

### Development mock

Set `NODE_ENV=development` and `OTP_MOCK_ENABLED=true`. No provider is required. Student OTP and supported reset/alumni verification messages are placed in a process-local development mail capture. The API returns an opaque, high-entropy, one-use capability; the code or reset URL is only returned after a local-only capture request. Capture records are short-lived, invalidated when replaced, and never enabled in production. This mode does not send email and is not an acceptance test for delivery.

### Real delivery

The backend uses the official Resend Node SDK. For a real sender after DNS/domain verification, set `OTP_MOCK_ENABLED=false` and configure:

```env
RESEND_API_KEY=re_replace-with-secret-from-resend
EMAIL_FROM=CampusSwap <verified-sender@your-domain.example>
RESEND_DOMAIN_VERIFIED=true
RESEND_TEST_MODE=false
```

`RESEND_DOMAIN_VERIFIED=true` is an operator-controlled release gate; the app does not query Resend DNS status. Keep it `false` until Resend reports the sending domain as verified. Production starts with email sends unavailable while false, and auth email operations return a generic service-unavailable response. When enabled, production requires a Resend API key and a non-onboarding `EMAIL_FROM` sender. Store the API key only in backend environment/secret management; never put it in a Vite variable or frontend bundle.

### Resend onboarding test sends

DNS verification is not required for local integration testing. Set `NODE_ENV=development`, `OTP_MOCK_ENABLED=false`, `RESEND_TEST_MODE=true`, and use:

```env
RESEND_API_KEY=re_your_resend_test_key
EMAIL_FROM=CampusSwap <onboarding@resend.dev>
RESEND_TEST_RECIPIENT=delivered@resend.dev
RESEND_DOMAIN_VERIFIED=false
```

Test mode can use only Resend's documented simulation recipients (`delivered@resend.dev`, `bounced@resend.dev`, or `complained@resend.dev`) and always overrides application recipients with that configured test recipient. It is rejected in production and conflicts with local mock OTP. This exercises Resend API acceptance; it does not deliver a student's OTP to their institutional mailbox. Resend's Node SDK usage and test address examples are documented in the [Node.js guide](https://resend.com/nodejs) and [test email guide](https://resend.com/changelog/sending-test-emails).

The adapter sends verification, resend, password-reset, alumni verification, and password-change messages through `resend.emails.send()`. Requests use a 10-second abort signal. SDK errors and network exceptions become generic delivery errors; provider details, API keys, OTPs, and reset URLs are not included in logs or public error responses. A successful SDK response means the provider accepted the API request, not that an email landed in an inbox.

## OTP controls

Defaults are `OTP_TTL_MINUTES=5`, `OTP_MAX_ATTEMPTS=5`, and `OTP_RESEND_COOLDOWN_SECONDS=60`. Startup bounds are respectively 1–60 minutes, 1–20 attempts, and 1–3600 seconds. OTPs are generated cryptographically, stored as peppered hashes scoped to email and purpose, atomically consumed, and old pending codes are replaced. Production requires a separate `OTP_PEPPER` and rejects `OTP_MOCK_ENABLED=true`.

## Local and production setup

Root `.env.example` supports local Docker mock mode; `backend/.env.example` supports direct backend development. Production values are represented by `.env.production.example` and `docker-compose.production.yml`; placeholders must be replaced through deployment secrets. Do not commit actual credentials. Docker Compose forwards the institution, OTP, and sender settings to the API.

Actual institutional inbox delivery is **BLOCKED BY ENVIRONMENT** in this verification: no Resend API key, verified sending domain, or institutional mailbox test was supplied. The SDK calls are tested with a mocked client; no real email was sent. Required acceptance test after DNS verification: set the production gate true, register a new SATI address, confirm the OTP arrives in that mailbox, verify it, and complete password recovery using the delivered reset message.

## Troubleshooting

- Missing `RESEND_API_KEY` or `EMAIL_FROM` prevents development real-mode startup; production domain verification false leaves sending unavailable without blocking the rest of the server.
- A Resend rejection or timeout is returned as a safe service failure; inspect Resend dashboard status and request time without logging message data or secrets.
- Mock capture is process-local; restarting or scaling across workers can make a capture unavailable. Use real mode for multi-instance deployments.
- Check the release report for exact executed tests and remaining delivery blockers.
