# Academic PDF Accessibility and Applicability

## Root cause

`verificationStatus` established administrator review, but the personalized service exposed a direct URL only when the student's session or admission batch matched the resource. Current user profiles store branch and semester, not verified applicability fields, so an authentic CSE Semester 7 PDF was correctly withheld but could not be offered honestly for reference.

## Resource states

- `exact_applicable`: existing strict behavior. Verified syllabus/timetable documents require program, semester, and session or admission batch. The URL is exposed as an exact document only when the authenticated profile confirms the required applicability.
- `reference_only`: administrator-reviewed official document. Verification requires an exact program-scoped document, semester, official source page, review date, applicability evidence, and an uncertainty statement. It may be shown only to the same canonical program and semester. Its URL is labeled `View reference PDF`; it is never classified as current or applicable.
- Unverified, stale, inactive, unsafe, wrong-program, and wrong-semester resources remain unavailable. Existing records default to `exact_applicable`; nothing is reclassified or verified automatically.

## Administrator workflow

The existing Academic Resources form now includes **Student presentation**. To publish a reference, select `Exact document`, `Reference only — applicability unconfirmed`, `program` scope, canonical program, and semester. Record the official source URL, actual review date, evidence proving document authenticity/program/semester, and the unresolved applicability or historical limitation. Save first as unverified, inspect the source, then use the existing explicit Verify action. Editing the classification or provenance invalidates verification.

## Student behavior

Applicable documents retain `Open Syllabus PDF` or `Open Timetable PDF`. References show their session and batch metadata, the warning `Reference only — applicability unconfirmed`, uncertainty text, and `View reference PDF`. Official indexes remain browsing fallbacks. Missing categories remain `Not yet available`.

## Future profile applicability

No User fields or profiles were changed. A future non-destructive schema addition should use nullable protected fields:

- `verifiedAdmissionBatch`: `YYYY`, representing curriculum/admission cohort;
- `verifiedAcademicSession`: `YYYY-YY`, only if the institution verifies the student's applicable session;
- `academicApplicabilityVerifiedAt`: timestamp;
- `academicApplicabilityVerifiedBy`: administrator reference;
- `academicApplicabilityEvidence`: bounded provenance note.

Publication session, current academic session, and curriculum admission batch are different concepts and must remain separate. Values must be set through an audited administrator/institutional workflow, never inferred from enrollment number or semester, and never editable through the ordinary profile API.

## Verification results

- Focused academic backend: 21 passed, 0 failed.
- Full backend: 176 passed, 0 failed, 3 environment-gated skips (179 total).
- Isolated MongoDB academic integration: 1 passed, 0 failed.
- Full frontend: 74 passed, 0 failed.
- Chromium E2E: 7 passed, 0 failed, including reference create/review/verify/view/retire and student mutation denial.
- Production frontend build: passed; 481 modules transformed.
- Backend and frontend production dependency audits: 0 known vulnerabilities.
- Default and E2E Docker Compose validation: passed.
- Isolated MongoDB, backend, and frontend: healthy; live, health, and frontend checks returned HTTP 200.
- `git diff --check`: passed with line-ending conversion warnings only.

No development or production database, user profile, resource record, or infrastructure was modified. All database-backed tests used disposable isolated test databases.
