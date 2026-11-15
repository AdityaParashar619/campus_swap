# Database reliability report

## Data integrity

`User` has unique indexes for normalized email and enrollment number. `EmailVerification` has a unique `(email, kind)` index and expiry TTL index. `EnrollmentReservation` protects email and enrollment number with unique indexes and releases stale reservations by TTL. `RefreshSession` indexes token hashes uniquely and stores session expiry. The integration test inspects these indexes after `createIndexes()` against an isolated database.

Registration reserves the enrollment number before staging a pending verification, handles duplicate-key races, and does not create an active user until verification succeeds. OTP consumption and refresh-token rotation use atomic operations. Password reset consumes a hashed single-use token and revokes refresh sessions through token-version/session invalidation. The admin bootstrap test verifies repeated unchanged sync does not save, log, replace a password, or invalidate sessions.

## Migration and deployment cautions

No production database was inspected or modified as part of this task. If existing duplicate email or enrollment rows exist, MongoDB may reject creation of a unique index. Before deployment, run a read-only duplicate scan on the target database and resolve conflicts through an approved, backed-up data migration. Do not drop a database, reset volumes, or delete user records to make index creation succeed.

The final integration suite used a freshly created database named `campusswap_phase01_final_test` on a local isolated mongod process. It created schema indexes and test records, exercised real MongoDB-backed flows, deleted only its own randomized fixture documents, and disconnected. No user database or Docker volume was used. The temporary test data directory was retained; no recursive cleanup was performed.

## Status

- **FIXED AND TESTED:** Index definitions and atomic registration/OTP/session paths exercised against isolated MongoDB.
- **FIXED AND TESTED:** Repeated administrator synchronization behavior is covered by backend tests.
- **FIXED, NOT RUNTIME VERIFIED:** Deployment against the target MongoDB topology, production indexes, replica-set transactions, backup/restore, and failover. No production DB was accessed.
- **BLOCKED BY ENVIRONMENT:** Docker container health/runtime checks. Compose YAML validation succeeded, but a live Compose deployment was not verified in this pass.

Regression tests are in `backend/test/registration.integration.test.js`, `adminBootstrap.test.js`, `authWorkflows.test.js`, and related auth tests. Database/index assumptions and remaining risks are summarized in `PHASE_0_1_FINAL_RELEASE_REPORT.md`.
