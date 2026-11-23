# Campus Issues Phase 4.8E.4

CampusSwap remains a student-run reporting tool. Students can attach up to three photos, find older reports in History, and view private evidence on reports they own. Admins can review the same evidence. Test report removal is available only in explicitly configured isolated environments.

## Files

- Backend model, query validation, controller, and student/admin routes: `backend/models/CampusIssue.js`, `backend/utils/campusIssueValidation.js`, `backend/controllers/campusIssueController.js`, `backend/routes/campusIssueRoutes.js`, and `backend/routes/adminRoutes.js`.
- Evidence and lifecycle: `backend/middleware/campusIssueEvidenceUpload.js`, `backend/services/campusIssueEvidence.js`, `backend/services/campusIssueLifecycle.js`, and the explicit operator command in `backend/scripts/campusIssueFixtures.js`.
- Frontend pages under `frontend/src/pages` are `CreateCampusIssue.jsx`, `CampusIssueDetails.jsx`, `CampusIssues.jsx`, and `AdminCampusIssues.jsx`. Shared changes are in `components/CampusIssueEvidence.jsx`, `services/api.js`, `utils/campusIssues.js`, and `utils/campusIssueAdmin.js` under `frontend/src`. Existing navigation continues to point to the same routes.
- Verification files are `backend/test/campusIssueEvidenceHistory.test.js`, `backend/test/campusIssueE4.integration.test.js`, `backend/test-support/campusIssueCloudinaryMock.js`, `backend/test-support/campusIssueBrowserServer.js`, `frontend/test/campusIssueEvidence.test.js`, `frontend/e2e/campus-issue-evidence.spec.js`, and `frontend/e2e/pilot.spec.js`.
- Infrastructure: `docker-compose.yml` passes the private-evidence flag with a disabled default. `frontend/nginx.conf` permits a 16 MiB request only on the Campus Issues submission path.

## Photo upload and delivery

`POST /api/campus-issues` still accepts JSON without photos. With photos it accepts multipart fields `issue` (JSON), `submissionKey` (a client-generated UUID v4 used for retries), and up to three `photos` files. The server requires a student role and applies the existing creation rate limit, multipart byte and part limits, and a per-process limit of four buffered or processing submissions. It accepts JPEG, PNG, and WebP with a maximum original size of 5 MiB per file. Sharp checks the actual format and decoded dimensions, rejects malformed media and multiframe inputs, applies orientation, then resizes within 1,800 × 1,800 pixels and re-encodes to WebP without preserving EXIF, GPS, or other source metadata. Input is capped at 20 million decoded pixels.

Cloudinary assets use resource type `image` and delivery type `authenticated`. The dedicated namespace is `campusswap/campus-issues/evidence/<report-id>/<storage-key>`. The server generates a storage key distinct from the evidence ID returned to the browser and disables overwrite. MongoDB keeps these IDs, media type, size, timestamp, and the owning Cloudinary cloud name. No original filenames, binaries, delivery URLs, or credentials are stored with reports.

- Student endpoint: `GET /api/campus-issues/:id/evidence/:photoId`.
- Admin endpoint: `GET /api/admin/campus-issues/:id/evidence/:photoId`.

Every request checks the existing authentication and role middleware, report ownership on the student route, and the photo’s association with the selected report. The server makes a short-lived signed Cloudinary download request to the fixed Cloudinary API host, rejects redirects, and streams a bounded response with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. The frontend receives bytes through the authenticated API, creates an in-memory object URL for the preview or enlarged photo, and revokes it when the photo is replaced or unmounted. An authorized viewer can still save the bytes they receive. A report moving to History retains the same access controls.

Set `CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED=true` on the backend only after validating authenticated upload, denial of unsigned original and transformed delivery, and streaming from the signed download endpoint with an isolated provider test asset. The feature uses the existing Cloudinary credential variables. The account must support the authenticated delivery type and direct downloads from `https://api.cloudinary.com` without redirects. No public delivery path is available. [Cloudinary authenticated media and signed download documentation](https://cloudinary.com/documentation/control_access_to_media).

## Interrupted upload recovery

A report with photos starts as a hidden journal in the existing Campus Issues collection. All intended evidence IDs are recorded before the first provider call. The report becomes visible after every upload succeeds and MongoDB acknowledges publication. A unique owner-and-submission-key index prevents duplicate publication when the client retries a photo submission or retries after removing its photos.

On an upload error, successfully acknowledged assets are cleaned up where possible. The journal retains every intended ID because a timed-out upload might have completed remotely. If a MongoDB publication acknowledgement is lost, the server leaves the assets intact and a retry with the same key checks the authoritative report state. The form keeps the key during the same page visit. After leaving or reloading the form, check My Reports before starting a new submission.

An operator can inspect hidden journals by their report ID and age using a read-only database session. Once a journal is at least one hour old and no upload is still in flight, run the explicit recovery command from the backend directory with the intended `MONGO_URI`, `CAMPUS_ISSUE_RECOVERY_DATABASE`, and matching evidence account:

```text
node scripts/campusIssueFixtures.js recover-upload <database> <report-id> CONFIRM
```

The command claims only the named hidden journal, uses its stored evidence IDs, and removes the journal after every scoped destroy succeeds or returns absent. On failure the journal remains retryable. A failed provider call with an ambiguous outcome still requires this delayed reconciliation. No scheduled job removes journals, reports, or evidence.

## Active / Recent and History

`GET /api/campus-issues/mine` accepts `view=recent` (default) or `view=history`. Active / Recent contains submitted and under-review reports plus resolved and closed reports whose matching terminal timestamp is less than 168 hours old. History begins at exactly 168 elapsed hours, based on the server’s UTC instant and the status-specific `resolvedAt` or `closedAt`. Terminal reports with a missing timestamp stay in Active / Recent. Filtering, search, and pagination compose on the server using the existing owner/sort index. Older reports retain their status, evidence, notes, and authorized direct links. The admin queue includes both recent and historical reports.

## Test-only deletion

The server requires an explicit `NODE_ENV=development` or `test`, `CAMPUS_ISSUE_TEST_DELETE_ENABLED=true`, and a connected database whose name exactly matches `CAMPUS_ISSUE_TEST_DATABASE` and the pattern `campusswap_<name>_test`. The database host must be loopback or the isolated Compose service `e2e-mongodb`. The ordinary development database is outside this gate. Normal student submissions cannot set the immutable test marker. Existing unmarked reports remain protected, regardless of their title or age.

A database operator can create a new marked report associated with a synthetic student in the isolated database. This command cannot mark an existing report:

```text
node scripts/campusIssueFixtures.js create-test-fixture <database> <synthetic-student-id> CONFIRM
```

Eligible details show **Delete Test Report**. Confirmation displays the title and ID, requires typing `DELETE`, and sends the current quoted version in `If-Match` to `DELETE /api/admin/campus-issues/:id/test-report`. There is no student or bulk deletion route.

The server atomically claims the report and increments its version before contacting the provider. A claimed report remains visible to admins for retry. Student access, evidence delivery, and status mutations are blocked. Cleanup addresses only authenticated assets derived from that report’s stored evidence IDs and verifies the configured account against the stored account. Successful or already-absent provider responses permit the final conditional MongoDB deletion. If the provider or MongoDB fails, reload the admin detail and retry against the authoritative version. An already-deleted report returns 404. No cleanup operation uses a folder deletion or a caller-supplied asset identifier.

## Verification and manual checklist

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend full suite | 219 | 0 | 2 |
| Focused backend and isolated MongoDB, including 10 MongoDB integration cases | 21 | 0 | 0 |
| Standalone Socket.IO expiry and Vite HTTP/WebSocket proxy | 2 | 0 | 0 |
| Focused frontend | 15 | 0 | 0 |
| Frontend full suite | 118 | 0 | 0 |
| Final Chromium suite | 12 | 0 | 0 |
| Frontend production build | 1 | 0 | 0 |
| Frontend and backend production dependency audits | 2 | 0 | 0 |
| Default and E2E Compose configuration checks | 2 | 0 | 0 |
| Git diff check | 1 | 0 | 0 |

The two backend integration cases skipped in the full command passed separately on isolated loopback servers. The Vite test targeted a loopback API, so it exercised the proxy contract without recreating the development stack. The first Chromium run had one fixture failure because the new E4 scenario and the pilot shared an administrator and reached the existing account rate limit. The clean rerun used separate administrator fixtures. Additional browser checks passed for Community Requests publish and close, and for opening a mocked Notes PDF in the sandboxed preview. Both audits reported zero vulnerabilities. The updated Nginx configuration passed a syntax check in a disposable container. The three existing development containers reported healthy and their proxied health endpoint returned HTTP 200.

Backend integration and Chromium fixtures use an isolated MongoDB database and an in-process Cloudinary mock. The mock asserts the provider delivery type and signed download parameters. A real account test is required before enabling evidence storage. Verify the following using a disposable asset in the existing Cloudinary account and a disposable database:

1. Submit JPEG, PNG, and WebP examples. Inspect the stored delivery type and verify source metadata was removed.
2. Confirm an unsigned original and unsigned derived URL both fail. Confirm the owner and an admin can view evidence through CampusSwap and another student gets 404.
3. Confirm the API returns image bytes with no public cache or redirect. Confirm a temporary signed request constructed by the server works with this account.
4. Verify the default view, History, and authorized direct links with known terminal timestamps.
5. In the isolated test database only, verify typed and versioned cleanup against a synthetic marked report. Confirm unrelated report and asset access still works.
