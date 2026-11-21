# Phase 4.8B.5 — Direct Documents and Category Fallbacks

Checked 2026-11-20. No development or production resource was imported, published, updated, or deleted.

## Root cause and correction

The matching service previously synthesized a fallback from `officialDepartmentUrl` whenever a category-specific index was absent. That made unrelated categories, including syllabus and timetable, open the same department overview. The service now returns a fallback only from an active, verified `official_index` record of the same `resourceType`. Otherwise it returns `not_available`.

Availability is generated independently for syllabus, timetable, scheme, faculty, department overview, and academic calendar. The frontend labels each fallback by category and renders `Not yet available` when no verified category index exists.

## Universal matching

The authenticated database-backed branch resolves through the canonical ten-program registry. Semester must be 1–8. Queries admit only the exact program, its department-wide records, and college-wide records; program and semester mismatches are excluded.

Exact syllabus and timetable documents fail closed unless they have explicit academic-session or admission-batch applicability. If a resource requires a session or batch absent from the student's profile, its URL is withheld and it is not an exact match. Known but mismatching applicability is excluded entirely. CSE, CSE-BC, AIML, AIADS, and IoT remain separate programs.

The UI uses `Open Syllabus PDF` and `Open Timetable PDF` for confirmed exact documents. Multiple applicable records remain visible as separate selectable links. Session and admission-batch metadata are displayed without calling historical records current.

## Direct candidate review

- CSE Semester VII syllabus, session 2025–26: the official PDF was reachable and identifies CSE Semester VII. It remains `unverified` and outside automatic imports because users do not have a verified session/batch.
- CSE Semester VII timetable, July 2025: the official index identifies Jul–Nov 2025 as a previous timetable. The direct PDF was inaccessible during this audit. It remains `unverified`, historical, and outside automatic imports.

Published exact documents introduced by this phase: **0**. Unverified direct candidates documented: **2**. Existing database counts were not changed.

## Admission-batch/session proposal

Reliable exact personalization requires protected, nullable `academicSession` (`YYYY-YY`) and `admissionBatch` (`YYYY`) profile fields with provenance such as `academicApplicabilityVerifiedAt` and `academicApplicabilityVerifiedBy`. They should be populated only through an audited administrator or institutional verification workflow, never inferred from semester or enrollment number and never editable through the ordinary profile API. This phase does not add or migrate those fields.

## Verification

- Focused academic backend: 21 tests passed.
- Full backend: 173 passed, 0 failed, 3 environment-gated skips (176 total).
- Isolated MongoDB academic integration: 1 passed, 0 failed.
- Full frontend: 73 passed, 0 failed.
- Chromium E2E: 7 passed, 0 failed.
- Production frontend build: passed; 481 modules transformed.
- Backend and frontend production dependency audits: 0 known vulnerabilities.
- Default and E2E Docker Compose validation: passed.
- Isolated backend live/health and frontend checks: HTTP 200; MongoDB, backend, and frontend containers healthy.
- `git diff --check`: passed; only line-ending conversion warnings were emitted.
- All 80 branch/semester combinations return a safe response in unit coverage.
- Explicit isolation covers EC 5 vs CSE 7, EC 5 vs EC 7, CSE 7 vs EC 5, ME 3 vs IT 3, and missing applicability.

## Files changed in Phase 4.8B.5

- `backend/services/academicResourceService.js`
- `backend/data/academicResourceCatalogue.js`
- `backend/test/academicPrograms.test.js`
- `backend/test/academicCatalogue.test.js`
- `backend/test/academicResources.integration.test.js`
- `frontend/src/pages/MyDepartment.jsx`
- `frontend/test/academicResources.test.js`
- `docs/PHASE_4_8B_5_DIRECT_DOCUMENTS.md`

## Readiness

The implementation is technically ready for Phase 4.8C. Academic content remains incomplete by design. Exact PDFs must remain unavailable until administrator verification and reliable student applicability data exist.
