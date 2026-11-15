# CampusSwap Phase 0/1 Final Release Checklist

## Implemented and tested

- [x] Fix login double response caused by passing Express `next` as the session factory.
- [x] Verify actual Express student/admin login success and one response per request.
- [x] Verify session persistence failure returns a single sanitized 500.
- [x] Development-only OTP/reset/alumni local mail capture with high-entropy one-use capability and expiry.
- [x] Mongo-backed registration → OTP verification → student login → protected profile → refresh → logout flow.
- [x] Mongo-backed reset request → captured link → reset → old password rejection → new password login.
- [x] Role authorization checks: student denied admin overview; admin permitted.
- [x] Admin bootstrap idempotence and healthy DB retry guard tests.
- [x] Frontend tests and production build.
- [x] Backend/frontend dependency audits report zero known advisories.
- [x] Docker Compose configuration validation and `git diff --check`.

## Required before GO

- [ ] Start Docker Engine and run `docker compose up --build -d`; verify backend/frontend/Mongo health checks and browser login/refresh/registration through Nginx.
- [ ] Verify Socket.IO WebSocket upgrade and correct identity in the deployed topology.
- [ ] Configure a non-production real email provider account and verify OTP, alumni verification, reset and password-change confirmation delivery/failure behavior. Production must keep `OTP_MOCK_ENABLED=false`.
- [ ] Read-only inspect deployment DB indexes and duplicate email/enrollment data. Resolve legacy conflicts with a reviewed migration before deploying unique indexes.
- [ ] Confirm institutional email/enrollment year, section and branch matching policy with SATI; current regex/list validation does not establish authoritative identity equivalence.
- [ ] Decide whether production is single-instance or add a shared rate-limit store before scaling backend replicas.
- [ ] Browser-test reset success screen, Go to Login link, local OTP capture and public route startup with no refresh token.
- [ ] Recheck the final deployment image and production configuration after all changes.

## Commands

```powershell
# Development stack (after creating root .env with non-production secrets)
docker compose config --quiet
docker compose up --build -d
docker compose ps

# Backend tests (use an isolated Mongo database ending `_test`)
cd backend
$env:TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/campusswap_phase1_test'
npm test

# Frontend verification
cd ../frontend
npm test
npm run build
```

Current decision: **NO-GO**. Docker runtime, live provider delivery, deployment database review and institutional policy remain unresolved. Do not begin Phase 2 under this release gate.
