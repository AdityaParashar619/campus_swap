# Phase 4.8B.1 — Academic Foundation

## Existing academic identity audit

Student registration accepts exactly `cs`, `bc`, `ai`, `ds`, `it`, `iot`, `ec`, `ce`, `me`, and `ee`. The institutional email and enrollment-number validators encode the same list and require the submitted branch to match both identifiers. Branch values are normalized to lowercase during registration. Semester is stored as a string and the configured values are `1` through `8`.

`User` stores `branch`, `department`, `semester`, `institutionalYearCode`, and `institutionalRollNumber`. It does **not** store an academic session or a verified admission batch. `institutionalYearCode` is an identifier component and is not treated as either. This phase does not change registration, profile protection, or any user data.

## Supported program registry

| Registration code | Canonical program | Display name | Department |
| --- | --- | --- | --- |
| `cs` | `CSE` | Computer Science and Engineering | `CSE` |
| `bc` | `CSE_BC` | Computer Science and Engineering (Blockchain) | `CSE` |
| `ai` | `CSE_AIML` | Computer Science and Engineering (Artificial Intelligence and Machine Learning) | `AI` |
| `ds` | `CSE_AIADS` | Computer Science and Engineering (Artificial Intelligence and Data Science) | `AI` |
| `it` | `IT` | Information Technology | `IT` |
| `iot` | `CSE_IOT` | Computer Science and Engineering (Internet of Things) | `CSIOT` |
| `ec` | `ECE` | Electronics and Communication Engineering | `ECE` |
| `ce` | `CE` | Civil Engineering | `CE` |
| `me` | `ME` | Mechanical Engineering | `ME` |
| `ee` | `EE` | Electrical Engineering | `EE` |

Registry startup validation fails if configured registration codes and registry entries diverge. Lookup is case-insensitive only for explicit registration-code aliases. In particular, `CSE`, `CSE_BC`, `CSE_AIML`, `CSE_AIADS`, and `CSE_IOT` are distinct programs and are never interchangeable.

Official SATI program listings support these program names (`https://www.satiengg.in/admission/admission-courses` and `https://satiengg.in/academics/courses`), but SATI currently presents some department ownership inconsistently across pages. Department codes here are stable application identifiers, not claims about current organizational reporting lines.

## Central academic resource schema

`AcademicResource` stores one central resource, not one copy per student. Its explicit scope is `college`, `department`, or `program`; cross-field validation prevents ambiguous scope. Supported types are syllabus, timetable, scheme, faculty, academic calendar, department overview, and other.

Applicability fields are department, program, semester, academic session (`YYYY-YY`), and admission batch (`YYYY`). URLs must use HTTPS and cannot contain embedded credentials. Active state and verification state (`unverified`, `verified`, or `stale`) are separate. A verified record requires `lastVerifiedAt`. Creator and updater references provide provenance.

The compound index follows the personalized read predicate: active/verified state, scope, department, program, and semester. Collections and databases are never dropped.

## Matching rules and precedence

`GET /api/academic/my-resources` is authenticated. It reloads branch, department, and semester from the authenticated user's database record. Query-string identity values are ignored.

The response can contain only:

1. exact program records for the student's canonical program;
2. department records for that program's department;
3. college-wide records;
4. the student's semester or all-semester records.

Only active, verified records are queried. Program-and-semester records without session/batch restrictions are `exact_verified_match`. Department and college records are labeled separately. A session- or batch-specific resource is `session_or_batch_unconfirmed` because current user records cannot prove applicability; its document URL is withheld and it is not selected as an exact syllabus/timetable.

Syllabus and timetable availability is always explicit. Every configured branch in semesters 1–8 receives HTTP 200. If no exact record exists, the response is either `browsing_fallback` using a verified official department page or `not_available`. It never substitutes another program or semester.

### Example empty/fallback response

```json
{
  "success": true,
  "data": {
    "supported": true,
    "identity": {
      "registrationBranch": "ce",
      "programCode": "CE",
      "departmentCode": "CE",
      "semester": "5",
      "academicSession": null,
      "admissionBatch": null
    },
    "resources": [],
    "availability": {
      "syllabus": { "status": "browsing_fallback", "isExactDocument": false },
      "timetable": { "status": "browsing_fallback", "isExactDocument": false }
    }
  }
}
```

## Source verification and initial import policy

No scraper or automatic seed was added. No resource was inserted into any database. The registry includes only department-page fallbacks that were reachable from the official SATI site during this audit. Candidate syllabus and timetable pages are not treated as exact current documents because a reachable index does not prove a linked document's program, semester, session, or batch applicability.

A future importer must be dry-run by default, require an explicit allowlisted database and confirmation for non-test targets, insert only absent records, preserve curated records, and record source and verification timestamps. It must never delete or overwrite resources as a side effect of synchronization.

## API contract and security properties

- `GET /api/academic/my-resources`: bearer authentication required; read-only; database-backed identity only.
- No public student or personalized endpoint was added.
- No generic CRUD API was added.
- Unknown registry identities fail closed and cannot be mapped to a nearby program.
- Unsafe URL protocols are rejected by model validation.
- Unverified, stale, and inactive records are excluded.
- Resource reads never write student-specific copies.

## Tests

Focused tests cover registry completeness, explicit case normalization, unknown rejection, CSE/Blockchain separation, all 80 configured branch/semester combinations, CE semester 5 with and without a match, ME semester isolation, IT/CSE isolation, department and college scope, session/batch uncertainty, unsafe URLs, unauthenticated rejection, client override attempts, inactive/unverified exclusion, and central storage. Mongo integration is guarded by `TEST_MONGO_URI` and refuses database names not ending in `_test`.

Verification results on 2026-11-19:

- focused academic unit/API tests: 10 passed;
- complete backend suite: 159 passed, 0 failed, 3 integration tests skipped unless explicitly configured;
- academic Mongo integration: 1 passed against `campusswap_phase_4_8b_1_test`;
- registration Mongo regression: 1 passed against the same isolated test database;
- frontend regression suite: 62 passed;
- production frontend build: passed;
- backend and frontend production dependency audits: 0 vulnerabilities;
- `git diff --check`: passed (only existing Windows line-ending warnings);
- Compose build and validation: passed; MongoDB, backend, and frontend healthy; `/api/live` and `/api/health` returned healthy and the frontend returned HTTP 200.

## Known gaps and risks

- Existing users have no verified academic session or admission batch. Exact session- or batch-specific matching is intentionally unavailable until a separately designed, verified identity migration exists.
- The registry distinguishes `ai` and `ds` based on the current registration contract. The UI currently collects branch as free text; registration validation, not a select list, remains authoritative.
- Official pages may change independently. A link's availability is not proof that a document is current.
- Exact academic documents have not been curated or imported in this phase.

## Phase 4.8B.2 readiness criteria

B.2 may consume this read-only API. The Phase 4.8B.1 verification run passed. A future UI must render `not_available`, `browsing_fallback`, and `session_or_batch_unconfirmed` honestly and must not relabel a fallback as an exact document.
