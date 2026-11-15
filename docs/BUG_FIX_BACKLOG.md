# Verification Audit Bug-Fix Backlog

Prioritized from the independent Phase 0/1 audit. No items were changed as part of the audit.

## P0 — before production acceptance

1. **Define refresh rotation concurrency behavior.** Avoid revoking a legitimate just-issued replacement when duplicate refresh requests race. Consider a bounded reuse grace window or idempotent rotation keyed to the prior session, while preserving theft detection. Add concurrent Mongo-backed tests proving one family remains usable for a legitimate race and is revoked for true token replay.
2. **Make alumni verification/review transitions recoverable and atomic.** Use Mongo transactions where deployment topology supports them or a durable state machine/outbox with repair semantics. Test failure after User creation, failure during review, retries, and duplicate link clicks.
3. **Add Mongo-backed Phase 1 API integration tests.** Cover OTP expiry/attempts/reuse/resend, duplicate email/enrollment, refresh rotation/reuse/expiry/logout, password-reset valid/expired/reuse, status/role authorization, alumni approval/rejection, and account revocation. Use an isolated ephemeral database; never share production DB.
4. **Correct production Compose defaults.** Production `OTP_MOCK_ENABLED` must default false; supply an HTTPS frontend origin; ensure startup fails clearly when production email/domain configuration is absent. Preserve a separate development compose profile if needed.
5. **Restore clean install reliability.** Re-run `npm ci` in fresh worktrees/CI after releasing file locks; prove package lock reproducibility on Windows and Linux and rerun tests/build from clean dependency state.

## P1 — required before broad rollout

6. **Protect password reset from abuse.** Add shared IP and email-keyed throttles/cooldowns, provider-send controls, and a reset lifecycle test suite. Keep responses generic.
7. **Remove bearer tokens from verification URLs.** Exchange a one-time secret using a fragment or other referrer-safe design; apply `Referrer-Policy: no-referrer`, avoid third-party resources, and prevent query-secret logging. Add URL/browser behavior tests.
8. **Validate environment configuration at startup.** Enforce adequate secrets outside production too, validate access-token TTL, positive finite refresh/rate-limit values, regex compilation, provider URL scheme, and allowed origin syntax. Remove or document unused `JWT_EXPIRES_IN`.
9. **Add server-side access-control matrix tests.** Verify student/alumni/faculty/coordinator/moderator/legacy-admin/college-admin/super-admin access, role assignment boundaries, status transitions, self-modification rejection, and IDOR/resource ownership.
10. **Validate frontend auth workflows.** Add a frontend test framework and cover signup/OTP/login/logout/reset/profile/session expiration, role guards, accessibility, error/loading states, and responsive views.
11. **Fix frontend/backend reset policy mismatch.** Set reset input min length to 12, collect confirmation, and show errors consistent with server validation.
12. **Test Socket.IO security and lifecycle.** Test missing/expired/revoked JWT rejection, room isolation, spoofed sender identity, token/account revocation behavior for active sockets, and graceful shutdown.
13. **Add database migration procedure.** Inspect actual production User indexes and duplicate/missing enrollment values, migrate partial unique index deliberately, verify TTL indexes, and record rollback steps.
14. **Add transactional audit guarantees or repair path.** Ensure moderation block/unblock is audited, and mutation/audit cannot silently diverge.
15. **Run full Docker/CI acceptance.** Build both images, start Compose, verify `/health`, `/live`, registration/login cookie flow, SPA deep links, Mongo volume persistence after recreation, shutdown, and CI failure propagation. Include dependency/image scanning.

## P2 — reliability and scale

16. **Use shared rate-limit storage** for multi-instance deployments and test limits across processes.
17. **Bound administrative and remaining collection reads.** Paginate `adminController.listUsers`, cap page numbers/offsets, validate sort/filter parameters, and add query indexes based on explain plans.
18. **Reduce login timing differences** with a dummy bcrypt comparison for unknown users and verify with a timing/abuse test appropriate to the threat model.
19. **Add frontend linting and accessibility checks** to CI; remove the current no-op/missing checks or clearly label them.
20. **Correct completion-report language** so “implemented” and “behaviorally verified” are distinct and each acceptance criterion links to test evidence.

## Audit environment follow-up

21. **Restore workspace dependency directories from lockfiles.** Audit `npm ci` attempts failed unlinking locked native binaries and left `backend/node_modules` and `frontend/node_modules` incomplete. Close any process holding `bcrypt_lib.node` or `esbuild.exe`, restore clean dependency trees, then rerun `npm ci`, `npm test`, and `npm run build` before further work.
