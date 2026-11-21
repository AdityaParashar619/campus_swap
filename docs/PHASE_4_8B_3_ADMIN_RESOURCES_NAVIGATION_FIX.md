# Phase 4.8B.3 — Academic Administration and Navigation Repair

## Navigation root cause and replacement

The previous desktop header rendered nearly every route as a flat row at 1440px while separately reserving width for the brand, notification/theme controls, and a variable-width account name. Changing the breakpoint could postpone but not prevent collisions.

The replacement uses a fixed brand destination, Marketplace, two bounded dropdowns, and an avatar-led account menu. Full navigation begins at the content-aware 1180px breakpoint; below it, the same destinations are presented in a scroll-bounded compact menu. The Dashboard link is removed from navigation. The brand targets `/dashboard` for authenticated users and `/` for guests. Escape and outside-pointer actions close open menus; navigation selections close the compact menu.

## Academic resource administration

The existing Admin Panel links to `/admin/academic-resources`. Backend endpoints are:

- `GET /api/admin/academic-resources`
- `POST /api/admin/academic-resources`
- `PATCH /api/admin/academic-resources/:id`
- `PATCH /api/admin/academic-resources/:id/status`

All endpoints require authentication and an explicit role of `admin`, `college_admin`, or `super_admin`. Marketplace and departmental coordinators are not implicitly authorized.

Creation always produces an active, unverified record. Program selection is validated against the centralized registry and derives the department, preventing invalid combinations. Verification-relevant edits invalidate earlier verification. Exact program syllabus/timetable verification requires program, semester, and an explicit academic session or admission batch.

Retirement sets `isActive=false` and `retiredAt` without deleting the record. `createdBy`, `updatedBy`, `verifiedBy`, verification time, and structured per-record history identify administrative actions. Duplicate active resources with the same scope, applicability, and URL are rejected.

## Student visibility

The student API remains unchanged. Only active verified resources can appear. Program/department/semester isolation, college-wide inclusion, and honest missing-resource fallbacks continue through the B.1 matching service.

## UI workflow

The Admin Panel provides a linked resource manager with creation/edit form, all ten canonical programs, applicability fields, unverified-by-default behavior, explicit verification, retirement/reactivation confirmation, validation feedback, and an empty state. It does not upload or fabricate documents.

## Security notes

The controller uses an explicit field allowlist, bounded pagination, registry validation, Mongoose validation, HTTPS-only schema validation, safe ObjectId checks, and no hard-delete route. Verification and activation are separate states.

## Rollback

Remove the four admin routes/controller, remove the admin page route/link/API methods, and restore the earlier Navbar. Existing resource records remain compatible; the additional audit fields are additive and require no destructive migration.

## B.4 readiness

No resources were imported into the development database by this phase.

## Verification record

- Backend: 165 tests discovered; 162 passed and 3 environment-gated integration/socket tests skipped; 0 failed.
- Frontend: 69 tests passed; 0 failed.
- Production frontend build: passed (481 modules transformed).
- Real Chromium: 7/7 passed, including two isolated students, the administrator draft workflow, navigation collision checks, and light/dark layouts at 320, 390, 768, 1280, and 1920 px.
- Production dependency audits: backend and frontend both reported 0 vulnerabilities.
- Docker Compose: isolated MongoDB, backend, and frontend services healthy; configuration validation passed.
- `git diff --check`: passed. Existing accumulated Phase 4.8A/B.1/B.2 changes remain uncommitted and preserved.

Phase 4.8B.3 is GO for Phase 4.8B.4 planning. B.4 was not started.
