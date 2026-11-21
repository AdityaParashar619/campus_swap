# Simplified Academic Resource Publishing

## Publication model

Publication and verification are separate concerns:

- `publicationStatus: draft` keeps a resource out of personalized student responses.
- `publicationStatus: published` makes an active resource eligible for matching.
- `verificationStatus` and provenance fields remain available for independent review and future institutional use.

An administrator may use **Save & Publish** without a separate verification action only outside production. Production publication still requires `verificationStatus: verified`. **Save Draft**, Edit, optional provenance verification, and Retire remain available. Retirement makes the record inactive and returns it to draft state. Existing records are not migrated, published, retired, or otherwise changed automatically.

## Matching and isolation

The backend derives program and semester from the authenticated database-backed user. Client-supplied identity parameters are ignored.

For an exact syllabus or timetable, publication requires program scope, a canonical program, a semester from 1 through 8, an active record, and a safe HTTPS URL. Student matching requires the same canonical program and semester. Academic session and admission batch remain optional document metadata and do not block visibility.

Matching documents are classified as follows:

- A verified document with confirmed applicability remains an `exact_verified_match`.
- A published matching document without confirmed applicability remains internally classified as `published_reference` and is shown with the neutral label **Published resource**.
- An administrator-reviewed legacy `reference_only` document remains an `official_reference`.
- A published category-specific official index is used only as a browsing fallback when no exact document is available.
- Otherwise the category reports **Not yet available**.

Publishing never means “current.” The normal student card stays concise: resource title, program, semester, and **Open Syllabus PDF** or **Open Timetable PDF**. It does not show a lengthy applicability warning. Multiple eligible documents are retained in the response; verified applicable resources sort before other published matches.

The administrator's default form focuses on the resource identity, safe URLs, scope, program, semester, and publication actions. Academic session, admission batch, presentation mode, evidence, review notes, and review date remain available under **Advanced details**. Closing that section does not clear or omit existing values during editing.

For development and a major-project demonstration, a small representative set of legitimate academic PDFs is sufficient. Comprehensive institutional coverage is not required to demonstrate secure matching. Placeholder records and fabricated official URLs must not be seeded.

Program, department, and college scopes remain distinct. A resource for another program or another semester cannot become an exact match. Schemes, faculty directories, department overviews, and academic calendars may use a legitimate broader scope and do not require a semester.

## Compatibility and safety

- Legacy verified active resources remain visible even if they predate `publicationStatus`.
- Existing unverified resources remain invisible until an administrator explicitly publishes them.
- No student profile, resource record, or database is automatically changed.
- Mutation endpoints remain protected by the existing administrator role guard.
- URLs must use HTTPS; unsafe protocols remain rejected.
- Verification, provenance, retirement, timestamps, and audit history are preserved.
- Development convenience is fail-closed in production: unverified publication is rejected server-side.

## Test coverage

Automated coverage includes all ten canonical programs across semesters 1–8, development-published matching PDFs, verified-resource compatibility, cross-program and cross-semester isolation, optional session/batch metadata, drafts, inactive/retired resources, unsafe URLs, administrator authorization, and student mutation denial. Notes, navigation, Marketplace, authentication, build, audits, Chromium E2E, and Docker validation are exercised by the broader regression suite.

Final command results are recorded in the task report rather than hard-coded here so this document does not become stale.
