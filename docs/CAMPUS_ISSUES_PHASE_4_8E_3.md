# Campus Issues Phase 4.8E.3

## Admin dashboard

Open **Admin Panel → Campus Issues** at `/admin/campus-issues`. The dashboard uses the existing admin route guard and the backend applies its own admin authorization. The queue searches by title or description, filters by category and status, and loads ten reports per page. Use **View / Review** to fetch a report and read its full description, visible location information, timestamps, latest response, and terminal note when present.

## Review workflow

| Report status | Available actions |
| --- | --- |
| Submitted | Start review, optionally give a response, or close with an explanation |
| Under Review | Add or replace the latest response, resolve with a note, or close with an explanation |
| Resolved | Read the report and its resolution note |
| Closed | Read the report and its closure explanation |

Use **Resolved** when the issue has been addressed and reasonably confirmed. Use **Closed** for reports closed without a confirmed resolution, such as duplicates or out-of-scope issues. A resolution note or closure explanation must contain 10–2,000 characters. Student-visible responses and notes use plain text.

## API and concurrent reviews

- `GET /api/admin/campus-issues` accepts `page`, `limit`, `search`, `category`, and `status`.
- `GET /api/admin/campus-issues/:id` returns the current report and version.
- `PATCH /api/admin/campus-issues/:id/status` sends `If-Match` with the quoted server version and a JSON body containing the new status and the review text for that action. The saved response from the API becomes the current detail and triggers a queue refresh.

When the server rejects a stale version with HTTP 409, the editor preserves the administrator’s text and blocks further writes. **Reload Latest** confirms before discarding edits. The form keeps its text if reloading fails. The administrator can then review the latest state and reapply their changes.

## Student visibility and privacy

Students see the latest status, response, and terminal note on their own report after revisiting or refreshing. The admin UI omits reporter and reviewer identifiers. Existing server rules continue to enforce report ownership, admin authorization, and public campus-location visibility. CampusSwap is a student-run reporting tool. Official grievances and emergencies belong with the college’s official channels.

## Verification

Use the focused frontend tests in `frontend/test/campusIssueAdmin.test.js`, the Campus Issues backend integration suite on an isolated MongoDB instance, and the Chromium pilot suite. The Chromium workflow includes a real stale-version conflict, successful recovery, a validation-error fixture, and a paginated queue response fixture. It checks the review layout at 320, 390, 768, 1280, and 1920 pixels.

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Focused admin frontend | 5 | 0 | 0 |
| Full frontend, including the focused tests | 115 | 0 | 0 |
| Full backend with the Campus Issues MongoDB suite enabled | 204 | 0 | 6 |
| Separate isolated MongoDB run | 5 | 0 | 0 |
| Final full Chromium run | 11 | 0 | 0 |

The separate MongoDB run covered Campus Issues, Campus Locations, Notice Board, Academic Resources, and registration. It reran four suites skipped in the full backend command. The standalone Socket.IO expiry and Docker Vite-proxy integration cases remained skipped. Chromium ran against the production frontend build and a loopback test API. The initial Chromium run had one mobile navigation timing failure. The final run passed after the test waited for the Marketplace page to render. An additional Chromium smoke check passed for anonymous admin access redirection and the Community Requests publish and close workflow.

The production frontend build, both default and E2E Compose configuration checks, and `git diff --check` passed. Both production dependency audits reported zero vulnerabilities. The isolated API and proxied health endpoint both returned HTTP 200. Docker runtime health could not be checked because Docker Desktop was stopped.

## Current scope

The backend stores the latest response and terminal note. Full review history, real-time or email updates, and private photo attachments are outside this phase. Attachment work needs a separate private upload and delivery design with authorization on retrieval.
