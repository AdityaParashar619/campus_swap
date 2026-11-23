# Campus Issues — Phase 4.8E.2

CampusSwap students open **College Services → Campus Issues**. The feature is for community reporting. For official grievances or emergencies, use the college's official channels.

## Student routes

| Route | Screen |
| --- | --- |
| `/campus-issues` | My Reports |
| `/campus-issues/new` | Submit New Issue |
| `/campus-issues/:id` | Report details |

The pages use the existing authenticated layout and student role check. `CampusIssueUi` shares layout, status badges, dates, loading/error display and pagination. Read requests use an abortable hook that discards responses after a route, filter or page change.

## Workflow and API

My Reports uses `GET /api/campus-issues/mine` with up to 10 reports per page. It supports the server's category and status filters and shows submission date, written location and response when present. Changing a filter returns to page one.

The form posts `title`, `category`, `description`, optional `locationDescription` and optional `campusLocation` to `POST /api/campus-issues`. UI validation follows the backend's 120/3,000/300-character limits. A synchronous guard blocks a second submission while one is pending. The form preserves values and the chosen location on errors. HTTP 429 shows a wait-and-retry message, and an ambiguous failure asks the student to check My Reports before retrying. On success the form is replaced by the new report's detail route.

The optional picker searches `GET /api/campus-locations` after a 300 ms debounce. It requests at most eight locations per page and displays names. Only the selected location ID enters the payload. A missing or unavailable catalogue still allows free-text location and submission. CampusSwap requests no GPS permission.

The details screen uses `GET /api/campus-issues/:id`. It shows Submitted, Under Review, Resolved or Closed as returned by the API. The latest admin response, review dates, resolution note and closure explanation are conditional. Missing and inaccessible reports share a generic unavailable state. The app renders issue content as plain text. The backend enforces ownership and determines map-location visibility. The frontend projects student-facing response fields and stores no reports or drafts in browser storage.

## Testing and scope

Unit tests cover routing and navigation, field allowlisting and bounds, response normalization, pagination and rate-limit messaging. The Chromium pilot uses synthetic records in disposable MongoDB and exercises the private lifecycle, map picker, duplicate-submit guard, error and retry states, ownership, and responsive widths. Browser fixtures use the authorized admin API for reviews.

The focused frontend run passed 14 tests and the full frontend run passed 110. The full backend run in an ephemeral Linux container passed 203 tests with seven environment-gated skips. The isolated issue HTTP integration test passed separately. The final Chromium run passed all 10 tests. Both production dependency audits reported zero vulnerabilities. The production build, development and E2E Compose validation, and `git diff --check` passed.

Changes become visible on revisiting or refreshing a report. The UI presents the latest response and relevant dates. The backend has no upload contract yet. A later upload phase can evaluate the existing authenticated, type- and size-checked image workflow, with upload ownership tied to the student and private issue delivery authorized separately. Phase 4.8E.3 can build the admin review UI on the existing role-protected endpoints and their version check.
