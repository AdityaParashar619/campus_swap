# Phase 4.8B.4 — Resource Curation and Validation

Checked: 2026-11-20. Scope: public pages on `www.satiengg.in` only. No private portal, development database, production database, user profile, or existing resource record was modified.

## Method and classification

Each candidate was checked as one of: verified official browsing page, source inaccessible during this check, not found, or exact document requiring review. A reachable page is never treated as proof that every linked PDF is current. No direct PDF was admitted into the import catalogue because the application cannot verify a student's admission batch or academic session. Consequently, exact-document coverage is currently zero and all confirmed catalogue entries are browsing fallbacks.

`AcademicResource.resourceKind` now distinguishes `exact_document` from `official_index`. Indexes cannot carry semester, session, or batch applicability. Provenance fields record applicability evidence, uncertainty, and the actual check date. Existing records remain backward-compatible as exact documents.

## Official sources inspected

- CSE and CSE-BC: `https://www.satiengg.in/syllabus-cse`, `/time-table-cse`, `/scheme-cse`, `/faculty-profiles-cse`, and `/departments/computer-science-engineering`. The syllabus page explicitly separates CSE and CSE-BC by programme and semester.
- IT and AIADS: `https://www.satiengg.in/syllabus-it`, `/time-table-it`, `/schemes-it`, `/faculty-profiles-it`, and `/departments/information-technology`. The syllabus page explicitly lists IT, IoT, and AIADS material, but this audit does not merge those programmes.
- IoT: `https://www.satiengg.in/syllabus-csiot` and `/time-table-csiot`. The syllabus page identifies CSE-IoT and admitted batches.
- Electronics and Communication: `https://www.satiengg.in/syllabus-ete`, `/time-table-ete`, and `/faculty-profiles-ete`. The timetable page explicitly identifies EC Engineering. Electronics and Electrical are not combined.
- Mechanical: `https://www.satiengg.in/syllabus-me` and `/time-table-me`.
- Electrical: `https://www.satiengg.in/syllabus-ece`, `/time-table-ece`, `/faculty-profiles-ece`, and `/departments/electrical-engineering`. SATI's `-ece` slug is used by its Electrical pages; programme identity is taken from page content, not the slug.
- AI/AIML, Civil, and the remaining departmental pages were searched on the official domain. Only pages with adequate programme evidence and successful inspection were admitted. Timeouts are recorded as inaccessible, not verified.

## Ten-program coverage matrix

All rows cover semesters 1–8 as an audit dimension. `0 exact` means no PDF is publishable as an exact match without administrator confirmation of programme, semester, session/batch, and currency.

| Registration | Program | Exact | Verified browsing fallbacks | Missing/inaccessible or review required |
| --- | --- | ---: | --- | --- |
| `cs` | CSE | 0 | syllabus, timetable, scheme, department | faculty, calendar |
| `bc` | CSE Blockchain | 0 | syllabus, timetable, scheme, department | faculty, calendar |
| `ai` | CSE AIML | 0 | department | syllabus, timetable, scheme, faculty, calendar |
| `ds` | CSE AIADS | 0 | syllabus, department | timetable, scheme, faculty, calendar |
| `it` | IT | 0 | syllabus, department | timetable, scheme, faculty, calendar |
| `iot` | CSE IoT | 0 | syllabus | timetable, scheme, faculty, department, calendar |
| `ec` | ECE | 0 | timetable, faculty | syllabus, scheme, department, calendar |
| `ce` | Civil | 0 | none | all six categories |
| `me` | Mechanical | 0 | syllabus, timetable | scheme, faculty, department, calendar |
| `ee` | Electrical | 0 | syllabus, faculty, department | timetable, scheme, calendar |

The machine-readable audit contains 60 rows: ten programmes × six resource types. Each row includes semesters 1–8, source status, reason, evidence, uncertainty, and check date. There are 21 importable official-index candidates and 39 missing/inaccessible/review-required rows.

## Safe import workflow

`backend/scripts/curateAcademicResources.js` is dry-run by default. It requires an explicit `--database` matching `MONGO_URI`, refuses production names and production runtime, validates the canonical registry and Mongoose model, detects exact duplicates and applicability conflicts, and never overwrites existing records.

Execution inserts only unverified drafts. It requires a real active trusted administrator ID. It does not set `verifiedBy` or claim manual verification. Non-test execution additionally requires an exact database allowlist and confirmation token. Each inserted record receives an import batch ID and audit history. Rollback deletes only unverified, never-verified records from the specified import batch; it cannot delete unrelated or administrator-verified records.

Dry-run performed against `campusswap_phase44b_test`:

- proposed inserts: 21;
- existing duplicates skipped: 0;
- conflicts: 0;
- invalid candidates: 0;
- records inserted: 0.

No import was executed against development or production.

## Administrator review and publication

The Admin Academic Resources page shows resource kind, official source, evidence, uncertainty, and check date. Administrators may verify official indexes as browsing fallbacks. Exact syllabus/timetable verification still requires program, semester, and session or admission batch. Applicability-changing edits invalidate verification. Retirement retains history and removes the record from student queries.

## Student matching and security

Only active, verified resources are queried. Matching remains restricted to the authenticated database-backed program, department, and semester. A verified `official_index` is excluded from the normal resource list and returned only as `browsing_fallback` with `isExactDocument: false`. Exact resources take precedence. Session- or batch-specific documents remain URL-withheld when the student's applicability cannot be confirmed. Inactive, stale, unverified, cross-program, and wrong-semester records remain excluded.

## Rollback

Code rollback is additive: remove the catalogue/import script and provenance fields, then revert the index-aware matching/UI additions. Existing documents remain readable because `resourceKind` defaults to `exact_document`. For an executed import, run the importer with the recorded batch, explicit target, `--execute`, and the required rollback confirmation. Only unverified records from that batch are eligible.

## Test record

Final validation on 2026-11-20:

- focused academic unit tests: 14/14 passed;
- complete backend suite: 168 passed, 0 failed, 3 environment-gated skips (171 total);
- isolated MongoDB academic integration: 1/1 passed against `campusswap_phase44b_integration_test`;
- complete frontend suite: 72/72 passed;
- Chromium E2E: 7/7 passed against the disposable `campusswap_phase44b_test` stack, including administrator create/verify/publish/retire and student visibility/isolation;
- production frontend build: passed (481 modules transformed);
- backend and frontend production dependency audits: 0 known vulnerabilities;
- default and E2E Docker Compose validation: passed;
- isolated backend `/api/live` and `/api/health`: HTTP 200 (`OK`, database connected); isolated frontend: HTTP 200; all three E2E containers healthy;
- `git diff --check`: passed (line-ending conversion warnings only, no whitespace errors).

The E2E MongoDB service uses `tmpfs`; its synthetic users and resource records are isolated from all development and production data. No persistent Docker volume was reset or deleted.

## Phase 4.8B.4 files changed

- `backend/models/AcademicResource.js`
- `backend/controllers/academicAdminController.js`
- `backend/services/academicResourceService.js`
- `backend/data/academicResourceCatalogue.js`
- `backend/scripts/curateAcademicResources.js`
- `backend/test/academicCatalogue.test.js`
- `backend/test/academicPrograms.test.js`
- `frontend/src/pages/AdminAcademicResources.jsx`
- `frontend/e2e/pilot.spec.js`
- `docs/PHASE_4_8B_4_RESOURCE_CURATION_VALIDATION.md`

Other dirty-worktree files predate or belong to the completed 4.8A–4.8B.3 and Notes work. They were preserved and were neither reset nor staged.

## Known limitations and readiness

- No exact PDF has been published. This is intentional, not complete content coverage.
- Live SATI pages intermittently timed out. Inaccessible pages were not imported.
- Current users do not have verified academic session or admission batch fields.
- Academic calendars were not confidently attributable as current programme resources.
- The administrator must inspect every linked item before exact-document publication.

The technical foundation is ready for the next separately approved college utility module. Resource-content coverage is deliberately incomplete: exact resources remain unavailable until an administrator verifies their applicability. This phase does not begin that module.
