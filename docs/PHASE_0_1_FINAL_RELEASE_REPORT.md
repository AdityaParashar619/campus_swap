# CampusSwap Phase 0/1 final release report

**Release decision: NO-GO. Do not start Phase 2.** Actual institutional email delivery and inbox acceptance remain blocked by missing provider credentials, verified sender configuration, and mailbox access. The code-level provider contract has tests, but this is not evidence that messages arrive.

## Implementation summary

- Strict student SATI email and enrollment validation with normalization and branch alignment.
- Shared password policy enforced by frontend and backend.
- Real provider configuration requires HTTPS endpoint, API key, and sender in non-mock mode; provider calls are bounded by a timeout. Local mock mode is development-only and uses a secure one-use capture.
- OTP and password reset keep one-use, expiry, attempt/cooldown and session-invalidation controls. Student activation occurs only after verification.
- Login response handling, refresh rotation and administrator bootstrap behavior have regression coverage.
- Unique user email/enrollment indexes and atomic pending enrollment reservations are covered with isolated MongoDB integration.

No enrollment roster or authoritative verification source is configured. Institutional email shape and OTP are not proof of enrollment.

## Files changed for this implementation

- Backend identity, policy, and mail configuration: `backend/config/env.js`, `backend/controllers/authController.js`, `backend/middleware/validateMiddleware.js`, `backend/models/User.js`, `backend/utils/institutionalIdentity.js`, `backend/utils/passwordPolicy.js`, `backend/utils/emailProvider.js`, `backend/package.json`, and `backend/package-lock.json` (Resend SDK).
- Frontend registration/reset feedback: `frontend/src/pages/Signup.jsx`, `frontend/src/pages/ResetPassword.jsx`, `frontend/src/utils/institutionalEmail.js`, `frontend/src/utils/passwordPolicy.js`.
- Configuration examples and deploy definitions: `.env.example`, `backend/.env.example`, `.env.production.example`, `docker-compose.yml`, `docker-compose.production.yml`, and `render.yaml`.
- Tests: `backend/test/auth.test.js`, `backend/test/emailProvider.test.js`, `backend/test/institutionalValidation.test.js`, `backend/test/institutionConfig.test.js`, and `frontend/test/registrationValidation.test.js`.
- Reports: `INSTITUTIONAL_EMAIL_VALIDATION.md`, `EMAIL_OTP_CONFIGURATION.md`, `PASSWORD_POLICY.md`, `AUTHENTICATION_RELIABILITY_REPORT.md`, `DATABASE_RELIABILITY_REPORT.md`, `PHASE_0_1_FINAL_RELEASE_REPORT.md`, plus corrected legacy `INSTITUTIONAL_VALIDATION_REPORT.md`.

This lists files directly relevant to this implementation. Other pre-existing working-tree changes from earlier CampusSwap work were preserved.

## Configuration required

Use root `.env.example` for Docker development and `backend/.env.example` for direct backend development. Do not copy placeholder secrets into a deployment. Required production settings include:

```env
NODE_ENV=production
MONGO_URI=<production MongoDB connection string>
JWT_SECRET=<unique random secret, at least 32 characters>
OTP_PEPPER=<different random secret, at least 32 characters>
OTP_MOCK_ENABLED=false
RESEND_API_KEY=<secret from Resend secret storage>
EMAIL_FROM=<verified sender, e.g. CampusSwap <no-reply@satiengg.in>>
RESEND_DOMAIN_VERIFIED=false
RESEND_TEST_MODE=false
ALLOWED_COLLEGE_DOMAINS=satiengg.in
INSTITUTION_EMAIL_PATTERN=^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\.in$
ENROLLMENT_PATTERN=^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$
INSTITUTION_BRANCHES=cs,bc,ai,ds,it,iot,ec,ce,me,ee
```

Also set correct `FRONTEND_URL`, `TRUST_PROXY_HOPS`, MongoDB network access, and `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS` as needed. Production rejects mock OTP and requires the secret/proxy configuration described in `.env.production.example`. Never commit values containing actual credentials.

After Resend confirms DNS, set `RESEND_DOMAIN_VERIFIED=true`, configure a verified `EMAIL_FROM`, and create a scoped Resend API key. During local testing DNS can remain pending by setting `RESEND_TEST_MODE=true`, `OTP_MOCK_ENABLED=false`, and `EMAIL_FROM=CampusSwap <onboarding@resend.dev>` with a permitted `RESEND_TEST_RECIPIENT`. Test mode routes all messages to the Resend test destination; it does not verify institutional mailbox delivery.

## Tests and checks actually run

- Backend `npm test`: **65 passed, 0 failed, 0 skipped** in the final run with an isolated local MongoDB test database (`campusswap_resend_test`). Includes integration registration → mock OTP capture → verification → student login → refresh/logout → password reset, plus administrator login/authorization, Resend SDK mock/config, and index checks.
- Frontend `npm test`: **9 passed, 0 failed**.
- Frontend `npm run build`: **passed** (Vite production build).
- `docker compose config --quiet` and production-overlay `config --quiet`: **passed** (configuration parse only, not container runtime/health verification).
- `npm audit --offline --omit=dev` (backend) and `npm audit --offline` (frontend): **0 vulnerabilities reported** from available lockfile/audit metadata.
- Initial sandboxed backend test attempt failed because local TCP binds were denied; rerun with local binding enabled passed. This initial environmental failure is not counted as a passing run.
- No lint script exists in either package manifest, so lint was not run. Docker daemon was unavailable (`docker info` could not connect), so live Compose health checks and production deployment were not verified. A mocked provider request was tested; no external email was sent.

## Release gate

| Gate | Status |
|---|---|
| Strict SATI format and branch validation | FIXED AND TESTED |
| Backend password rules and frontend feedback | FIXED AND TESTED |
| Mock OTP registration/verification | FIXED AND TESTED |
| Resend SDK contract and development test mode | FIXED AND TESTED with a mocked SDK client |
| Production email before verified domain | BLOCKED BY ENVIRONMENT until Resend DNS verification and configuration |
| Real OTP arrives in institutional mailbox | BLOCKED BY ENVIRONMENT |
| Student/admin login and session workflow | FIXED AND TESTED in automated tests |
| Forgot-password and reset workflow | FIXED AND TESTED in mock/isolated integration |
| Unique indexes and registration/OTP database flow | FIXED AND TESTED in isolated MongoDB |
| Live Docker health checks / production topology | BLOCKED BY ENVIRONMENT |
| Authoritative student enrollment proof | BLOCKED BY POLICY |

Because real email acceptance is a hard GO criterion, release remains **NO-GO**. After provider credentials and a test institutional mailbox are configured, repeat the complete acceptance workflow and record evidence before release.

## Local verification commands

From repository root:

```powershell
docker compose config --quiet
docker compose up --build
```

For direct development, set a local `backend/.env` from `backend/.env.example`, keep `NODE_ENV=development` and `OTP_MOCK_ENABLED=true`, then:

```powershell
cd backend
npm test
npm run dev
```

In another terminal:

```powershell
cd frontend
npm test
npm run build
npm run dev
```

For database-backed integration tests, run tests only against a fresh isolated database with a name ending `_test`:

```powershell
# In one terminal, use a fresh directory and keep mongod running:
$testMongoPath = Join-Path $env:TEMP ("campusswap-test-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testMongoPath | Out-Null
mongod --dbpath $testMongoPath --bind_ip 127.0.0.1 --port 27192
# In another terminal:
$env:TEST_MONGO_URI = 'mongodb://127.0.0.1:27192/campusswap_phase01_test'
cd backend
npm test
```

Do not point `TEST_MONGO_URI` at the normal development or production database. After deployment configuration, register a new institutional test account, retrieve the actual OTP from its inbox, verify it, login/refresh/logout, request reset, consume the delivered link, and login with the new password. No real email acceptance result is claimed here.
