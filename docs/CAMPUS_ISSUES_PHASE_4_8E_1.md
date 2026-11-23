# Campus Issues — Phase 4.8E.1

Campus Issues is a private community reporting feature for CampusSwap. It is not an official SATI grievance or emergency response channel. The backend uses a separate collection from public Community Requests.

## Schema

Each report stores a title (up to 120 characters), description (3,000), category, authenticated owner, and status. Optional fields include a location description (300), a CampusLocation reference, an admin response (2,000), and a resolution or closure note (2,000). Mongoose records creation and update timestamps. The review endpoint records the latest reviewer and review timestamp, plus a distinct resolution or closure timestamp.

Categories are `infrastructure`, `cleanliness`, `water`, `electricity`, `internet`, `library`, `hostel`, `accessibility`, and `other`. The owner/newest and newest-first indexes support private history and the admin queue. An internal attachment field reserves storage ID, media type, size, and upload time. The API accepts neither uploads nor attachment URLs in this phase.

## HTTP API

| Method and path | Access and behavior |
| --- | --- |
| `POST /api/campus-issues` | Authenticated students submit an issue. Returns HTTP 201 with status `submitted`. |
| `GET /api/campus-issues/mine` | Authenticated students list only their issues. |
| `GET /api/campus-issues/:id` | Authenticated students retrieve their issue. Missing and foreign IDs both return HTTP 404. |
| `GET /api/admin/campus-issues` | `admin`, `college_admin`, or `super_admin` list the private queue. |
| `GET /api/admin/campus-issues/:id` | Administrators read a private issue and its review version. Reading does not change status. |
| `PATCH /api/admin/campus-issues/:id/status` | Administrators review, respond, resolve, or close using the latest quoted `If-Match` version. |

Example submission:

```json
{"title":"Drinking water tap out of service","description":"The tap did not dispense water this morning.","category":"water","locationDescription":"Ground-floor corridor"}
```

Both lists accept `category`, `status`, `search`, `page`, and `limit`. Search is a literal case-insensitive substring across title and description, up to 100 characters. Lists sort newest first with ID as the tie-breaker. The default page size is 20, the maximum is 50, and page numbers are capped at 10,000. Responses use `{ success, data, pagination: { page, limit, total, totalPages } }`.

### Lifecycle

- `submitted → under_review` starts review. An optional `adminResponse` is visible to the reporter.
- `under_review → under_review` adds or replaces the student-visible response and requires nonblank response text.
- `under_review → resolved` requires a meaningful `resolutionNote` of at least 10 characters.
- `submitted → closed` and `under_review → closed` use the same note field for a required closure explanation, such as a duplicate or out-of-scope report.
- Resolved and closed are distinct terminal states. The API provides no reopening, deletion, or automatic status change on viewing.

Read the admin response's numeric `version` and send it quoted as `If-Match: "0"` (for version 0). The review body accepts `status`, optional `adminResponse`, and `resolutionNote` for a terminal state. A missing or malformed version header returns 400. A stale version, a concurrent update, or an incompatible transition returns 409. Reload before retrying.

## Privacy and Campus Map

Ownership is enforced in the database lookup using the authenticated user ID. The existing authentication, role checks, and per-user creation limiter apply. Public feeds, student assignment of audit fields, anonymous submissions, and client-provided attachment metadata are outside this API. Response envelopes use `Cache-Control: no-store` for issue data. They omit account profiles and reporter IDs, and reviewer IDs and versions appear only on admin responses. Title, description, and notes are plain text. Future views must render them as text.

The optional `campusLocation` submission field accepts a currently published, verified CampusLocation ID. Both admin and student responses include only the public location ID and name. A location that is unpublished or archived later is returned as `null`; the independently supplied location description remains available. Coordinates and GPS data are not part of issue submissions.

## Verification and limits

The focused suite tests field bounds, status transitions, search and pagination, and blocked payloads. The opt-in HTTP test uses disposable MongoDB on port 27019 with `CAMPUS_ISSUE_TEST_MONGO_URI=mongodb://127.0.0.1:27019/campusswap_issues_test`. It verifies ownership, review and response, resolution vs. closure, concurrent updates, and location visibility using synthetic accounts and places. Test cleanup only targets its fixture owners in that database.

Verification passed 47 focused tests, including five new issue unit tests, and all three isolated MongoDB integration tests for Issues, Campus Map, and Notice Board. The full backend run passed 203 tests with seven environment-gated skips and zero failures. The backend production dependency audit reported zero vulnerabilities. Development and E2E Compose validation and `git diff --check` passed.

The foundation provides a latest reviewer and latest response, not a complete review history. There is no automatic notification, attachment upload, reopening, or frontend workflow yet.
