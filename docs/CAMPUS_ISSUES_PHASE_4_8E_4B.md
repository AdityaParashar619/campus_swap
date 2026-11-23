# Campus Issues Phase 4.8E.4B local activation

## Configuration

Enabled the existing `CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED=true` flag in the repository root's ignored development `.env`. The backend reads it in `checkEvidenceStorage()`. Local Docker Compose forwards the flag to the backend and defaults to `false` when the setting is absent. The production Compose model resolved to `false` when validated with its separate production environment example.

The running stack was confirmed as project `campus_swap`, with `NODE_ENV=development`, the internal development database `campusswap`, and the local frontend at [localhost:8080](http://localhost:8080/). The existing backend image already contained the current Campus Issues implementation. Applied the setting by recreating only the backend service:

```powershell
docker compose -p campus_swap --env-file .env -f docker-compose.yml up -d --no-deps --no-build --wait --wait-timeout 65 backend
```

All other development environment values matched the pre-change values. The frontend container, MongoDB container, and MongoDB volume mounts were preserved. There were no new persistent test reports or Cloudinary writes in this phase. Production configuration and existing accounts were preserved.

## Runtime verification

| Check | Result |
| --- | --- |
| Backend, frontend, and MongoDB container health | Healthy |
| Running backend's evidence configuration check | Enabled and configured |
| Backend health directly and through the frontend proxy | HTTP 200 |
| Frontend and Campus Issues form assets | HTTP 200. Chromium verified the running Docker frontend displayed the file picker and decoded a local photo preview with its API requests routed to the isolated backend |
| Anonymous profile, multipart submission, evidence, and admin queue requests | HTTP 401 |

The local service reads the flag and retains its authentication boundary. Authenticated uploads, owner and admin evidence access, and the review workflow were exercised against disposable MongoDB with a mocked Cloudinary provider. The same Cloudinary configuration passed the earlier account-level privacy verification. [Phase 4.8E.4A report](CAMPUS_ISSUES_PHASE_4_8E_4A.md).

## Test results

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Focused backend Campus Issues | 11 | 0 | 0 |
| Backend Marketplace image regressions | 10 | 0 | 0 |
| Focused frontend Campus Issues | 15 | 0 | 0 |
| Isolated MongoDB integration | 6 | 0 | 0 |
| Chromium E2E | 12 | 0 | 0 |
| Running Docker frontend preview smoke check | 1 | 0 | 0 |
| Frontend production build | 1 | 0 | 0 |
| Development, E2E, and production Compose validation | 3 | 0 | 0 |
| Git diff check | 1 | 0 | 0 |

## Manual verification

1. Sign in as a student at [local CampusSwap](http://localhost:8080/). Open **College Services → Campus Issues → Submit New Issue**.
2. Enter a clearly labeled synthetic report and select one small, non-sensitive JPEG, PNG, or WebP. Confirm the thumbnail, submit once, and open the report details. Confirm the photo loads in **Evidence**.
3. In a separate browser session, sign in as an administrator. Open **Admin Panel → Campus Issues**, find the report, and confirm the photo loads.
4. Select **Start review**, save an admin response, then select **Resolve report** and supply a resolution note.
5. Refresh the report in the student session. Confirm the Resolved status, saved response, resolution note, and evidence.

The manual submission uses the existing local development database and Cloudinary account. A manually submitted report follows normal retention and authorization rules. Its synthetic title does not make it eligible for test-report deletion.

## Security and limitations

Evidence uploads require an authenticated student. Retrieval requires report ownership or administrator authorization. The server validates image contents, strips source metadata, stores evidence with Cloudinary's authenticated delivery mode, and streams authorized responses with `Cache-Control: no-store`. Signed provider URLs and storage keys remain server-side.

Verification on the running local stack stopped before an authenticated submission. The first persistent submission and review are the manual steps above.

**Decision: GO for local manual testing.**
