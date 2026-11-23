# CampusSwap Phase 4.9 final audit

## Executive summary

**GO for closing Phase 4.9.** Phase 4.9C passed the full backend, frontend, and Chromium suites. The browser gate used a single unfiltered run with zero retries or skips. This decision covers the audited worktree and the verified local database state.

Phase 4.9 originally recorded a NO-GO because the running development database lacked the declared unique OTP index on `emailverifications.email + kind`. Registration and password reset rely on that key for concurrent upserts. The audit snapshot had no duplicate key groups or documents without `kind`. The approved Phase 4.9B maintenance window created the index after an actual isolated backup restore. Phase 4.9C independently verified its presence and options with read-only checks.

The audit started from commit `156f93e` with an existing dirty worktree. All prior changes were preserved. No P0 defect was identified in the checks performed. No application was deployed and the running services were left in place.

## Architecture and coverage

React and Vite serve lazy-loaded routes through Nginx or the local Vite proxy. Express implements API authorization and Socket.IO authentication. Mongoose uses the default MongoDB connection. Cloudinary stores and delivers product images, profile media, notice media, and authenticated issue evidence. Mongo stores record metadata. Notes link to HTTPS resources.

| Module | Checks and boundaries |
| --- | --- |
| Authentication and profiles | Disposable registration and OTP, profile fields, password reset, refresh rotation, logout, origin checks, and restricted role changes. Email delivery used test fixtures. Production cookies use Secure and HttpOnly with SameSite=None. Cookie-authenticated refresh and logout enforce trusted origin checks. |
| Marketplace and Favorites | Bounded discovery, owner-only writes, seller serialization, favorite persistence, and image validation/ownership regressions. Cloudinary operations were mocked. |
| Chat, Network, and notifications | Conversation authorization, private Socket.IO rooms, reconnect and token expiry, connection lifecycle, and recipient-scoped notification reads and mutations. An ambiguous message-send HTTP retry has no dedicated idempotency key. |
| Community Requests | Public open feed, owner close, and offer privacy. Requests and Campus Issues use separate routes and collections. |
| Notes and Academic Resources | Notes auth and URL validation, sandboxed preview UI, branch and semester isolation, and admin-only academic publishing with separate production verification rules. The browser Notes check used a mocked external URL and verified modal behavior and the sandbox attributes. External PDF byte rendering remains unverified. |
| Smart Notice Board | Draft and published visibility, targeting, attachment validation, admin authorization, and supported preview/fallback rendering. No new live attachment was uploaded. |
| Campus Map and management | Published and verified visibility, coordinate validation, draft/publish/archive, stale updates, and map fallback states. No new coordinates were published. |
| Campus Issues | Cold startup, private photo validation/delivery, report ownership, versioned admin review, resolved/closed notes, seven-day History, and restricted test-only deletion in disposable fixtures. The earlier live Cloudinary report covers a separate provider check. [Phase 4.8E.4A evidence](CAMPUS_ISSUES_PHASE_4_8E_4A.md). |

## Prioritized issue register

| ID | Severity | Evidence | Impact | Fix | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-01 | P1 | The original MongoDB catalog lacked the unique `{email:1,kind:1}` index declared by the OTP schema. Password-reset issuance uses an upsert on those fields. | Concurrent initial OTP issuance can leave more than one active record per account and purpose, making verification and attempt accounting unreliable. | Phase 4.9B added only `email_1_kind_1` after an approved backup and isolated restore. | Phase 4.9C read-only verification confirmed the exact unique key, original indexes, and zero duplicate or malformed key counts. Disposable tests verify key uniqueness and separation of the two OTP kinds. | Resolved in local development. |
| AUD-02 | P1 | `GET /api/requests` was public and returned populated offers, including messages and responder identities. The UI shows previous offers to the owner. The response write also returned the full offer list. | A visitor or unrelated authenticated account could read messages intended for the request owner. | Restrict offers to the owner or offer author in both response paths. Keep the public feed and prevent shared caching. | Authenticated and anonymous response checks use disposable data. | Fixed in worktree. |
| AUD-03 | P2 | With the local evidence flag exported as true, the merged production Compose model resolved true before the fix. | A development setting could enable production evidence handling through Compose interpolation. | Pin the audit-phase production overlay to false. Development configuration remains available. | Re-ran the same configuration with the flag exported. Production resolved false and development true. | Fixed in worktree. |
| AUD-04 | P2 | Notes preview previously declared modal semantics on a regular div with no focus containment, Escape handling, or restoration. | Keyboard users could tab into the background and lose their place. | Use a native modal dialog, focus Close, and restore the launch control. Preserve the existing sandbox and referrer policy. | Browser checks cover focus, containment, Escape, and restored focus. | Fixed in worktree. |
| AUD-05 | P2 | Running index catalog lacks declared indexes on notifications, Campus Locations, Notices, and Academic Resources. Cold-start benchmark also lacked the declared Community Requests index in its new fixture DB. | Read performance can degrade as data grows. Campus Location building-code uniqueness depends on a missing index. | Review data, startup provisioning, and index deployment together. | Read-only catalog checked. Persistent DDL was excluded. | Open. |
| AUD-06 | P2 | Notes requests the default first page and applies the visible search to those loaded items. Community Requests requests page one with a 50-row limit. | Older items can be inaccessible in the client view even when the APIs have more pages. | Add server-backed paging to both views and align Notes search semantics. | Controller and page source inspected. | Open. |
| AUD-07 | P2 | A lost HTTP response after chat persistence has no dedicated send idempotency key. | A manual retry can send the same message again. | Define a request key and review retry semantics in a separate change. | Source inspection. Private-room, expiry, and reconnect tests cover adjacent behavior. | Open. |
| AUD-08 | P3 | Request logs include `originalUrl` and request IDs. No metrics or trace collection is configured by the audit. | Query strings can contain sensitive values if callers add them. Diagnosis is limited to current logs. | Redact query parameters and define operational signals for a later phase. | Logging path inspected. | Open. |
| AUD-09 | P1 | The merged production model previously contained both the development wildcard frontend publish and the intended loopback publish on port 8080. | The conflicting bindings can prevent startup or expose the frontend outside the intended reverse-proxy boundary. | Replace the inherited ports list in the production overlay. Assert the merged port and flag values in CI. | Merged model before and after, without starting production. | Fixed in worktree. |
| AUD-10 | P2 | The overlapping password-reset regression observes two mock delivery calls and one stored OTP record. | A requester can receive multiple codes from overlapping attempts, with only one backed by the current record. | Review delivery coordination separately. | Reproduced using the isolated OTP concurrency fixture with the unique index installed. | Open. |

## Database and operational findings

The running catalog contained the user email and enrollment, enrollment reservation, refresh token, connection, Listing, Messages, Notes, and Campus Issues indexes inspected in the audit. Campus Issues has its partial owner/submission-key unique index, and the isolated cold-start regression was included in the backend run. The original OTP catalog mismatch was a gap between the running schema and integration setup. The registration integration explicitly builds its fixture indexes. The live local OTP index has since been reconciled in Phase 4.9B.

Read-only development counts found no open Community Requests with offers and one Campus Issue with evidence. The development evidence flag was enabled and test deletion was disabled. The audit did not retrieve that evidence or reuse any existing assets.

Compose health reported the backend, frontend, and MongoDB healthy. The development proxy ports were checked independently. The backend and MongoDB had no host-published port. The development frontend published 8080 on all interfaces, which remains relevant to local network access. The corrected production model publishes the frontend on loopback only. Its `!override` tag requires Docker Compose 2.24.4 or newer. [Docker Compose merge rules](https://docs.docker.com/reference/compose-file/merge/).

The persistent mount was `campus_swap_mongodb_data`. The original audit and Phase 4.9C performed read-only runtime checks. The separately authorized Phase 4.9B window briefly paused the same backend container and added the single OTP index. The Nginx config in use matched the worktree by SHA-256 and passed `nginx -t`.

## Performance measurements

Windows loopback, Node 22.17.0, Mongoose 8.24.8, MongoDB 8.2.3, 1,000 synthetic rows per collection, single-client sequential requests. Each endpoint used three warmups and 24 measured requests. Latency covers request start through response body consumption. Body sizes are uncompressed and provider calls were excluded. The API was running with the audit source changes. These samples are development baselines rather than capacity estimates.

| API page of 12 | p50 | p95 | Body bytes |
| --- | ---: | ---: | ---: |
| Marketplace browse | 6.4 ms | 9.8 ms | 6,540 |
| Marketplace text search | 7.0 ms | 7.9 ms | 6,540 |
| Community Requests | 9.3 ms | 17.1 ms | 5,045 |
| Campus Issues recent | 7.1 ms | 12.4 ms | 4,540 |
| Campus Issues History | 9.0 ms | 14.5 ms | 4,768 |

Vite reported a 414.35 kB main JavaScript chunk (138.61 kB gzip) and a separate 160.92 kB Campus Map chunk (50.36 kB gzip). A separate headless Chromium 159 run at 1280 × 900 used one warmup and seven navigations per route in one browser context. Time from navigation start to the expected visible heading was 63 ms median for Login (79 ms max), 213 ms for Marketplace (397 ms max), and 168 ms for Campus Issues (179 ms max). These are warm loopback route timings from a small browser fixture dataset. No bundle or database query optimization was applied based on these samples. Production load, network throttling, long-session memory, and real-user timing were outside the measurements.

## Responsive and accessibility scope

Chromium sampled 16 representative public, student, and admin screens at 320, 390, 768, 1024, 1280, and 1920 pixels. All 96 combinations passed the viewport width check. Existing navigation tests and the Campus Issues photo and admin deletion workflows cover selected menu and form interactions. The Notes dialog check covered the close control, Escape, and restored focus. Screen-reader compatibility and systematic contrast measurements remain outside the evidence.

## Historical Phase 4.9 verification results

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Full backend, including MongoDB and cold startup | 220 | 0 | 2 |
| Dedicated isolated MongoDB suites | 11 | 0 | 0 |
| Separately gated HTTP proxy and Socket.IO integration | 2 | 0 | 0 |
| Focused CORS, evidence validation, and Community Requests regressions | 15 | 0 | 0 |
| Disposable OTP unique-index verification | 1 | 0 | 0 |
| Full frontend | 118 | 0 | 0 |
| Full Chromium run 1 | 13 | 1 | 0 |
| Full Chromium run 2 | 13 | 1 | 0 |
| Final focused Chromium run on fresh fixtures | 3 | 0 | 0 |
| Frontend production build | 1 | 0 | 0 |
| Production dependency audits | 2 | 0 | 0 |
| Development, E2E, and production Compose validation | 3 | 0 | 0 |
| Merged production port and flag assertions | 1 | 0 | 0 |
| Running Nginx config syntax and file hash | 1 | 0 | 0 |
| Both localhost health, origin, and unauthenticated profile checks | 2 | 0 | 0 |
| Git diff check | 1 | 0 | 0 |

The two cases skipped in the main backend run passed on their dedicated loopback fixtures. The Vite integration used a disposable upstream. Both dependency audits reported zero known vulnerabilities. The merged-model CI assertions ran locally. The first Chromium run failed an assertion that expected 403 for non-owner listing edits. The existing API deliberately returns 404. The second failed because a Campus Issues assertion selected both the saved response and the editable textarea. The final focused run passed both corrected assertions and the responsive matrix. All 14 distinct browser cases passed across the recorded runs.

## Phase 4.9C final verification

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Full backend, with all integration gates enabled | 223 | 0 | 0 |
| Dedicated isolated MongoDB suites | 12 | 0 | 0 |
| Focused auth, evidence validation, socket authorization, and CORS rerun | 19 | 0 | 0 |
| Full frontend | 118 | 0 | 0 |
| Full Chromium suite in one execution | 14 | 0 | 0 |
| Frontend production build | 1 | 0 | 0 |
| Development, E2E, and production Compose validation | 3 | 0 | 0 |
| Merged production port and evidence flag assertions | 1 | 0 | 0 |
| Running Nginx config syntax and file hash | 1 | 0 | 0 |
| Localhost health, origin, and unauthorized profile checks on 8080 and 5173 | 2 | 0 | 0 |
| Git diff check | 1 | 0 | 0 |

The dedicated and focused suites overlap the full backend count. A supplemental focused run during concurrent fixture activity passed 17 cases and failed two CORS cases. The failure diagnostics from that run were filtered out, so the immediate cause was unconfirmed. All CORS cases passed in the full backend run and again in the unfiltered focused rerun. No assertions or security controls changed.

Chromium ran all 14 cases together on the production build against disposable fixtures, using one worker, with retries disabled. It completed in 3.4 minutes. The successful run covered Community Requests offer visibility, private Campus Issues evidence and admin review, Notes modal keyboard access and focus return, and the 96 viewport checks. The backend run included the real Socket.IO and Vite proxy integration cases and the Mongoose cold-start regression. Runtime proxy checks used read-only health and unauthorized profile requests.

The live index check confirmed database `campusswap`, collection `emailverifications`, and `email_1_kind_1` with keys `{ email: 1, kind: 1 }` and `unique: true`. The original `_id_`, `email_1`, and TTL `expiresAt_1` remained present. Aggregate preflight returned zero OTP documents, duplicate key groups, malformed keys, and conflicting indexes. Phase 4.9C performed no persistent database writes or index changes.

## Changed files

- `backend/controllers/requestController.js`, `backend/routes/requestRoutes.js`, and `backend/test/requestPosts.test.js` apply and test request response scoping while preserving public feed pagination.
- `docker-compose.production.yml` isolates the private evidence flag and replaces the inherited frontend port bindings. `.github/workflows/ci.yml` verifies those boundaries on the merged model.
- `frontend/src/pages/Notes.jsx`, `frontend/test/notesRestoration.test.js`, and `frontend/e2e/phase49-audit.spec.js` cover the keyboard preview, integration gaps, and viewport checks. `frontend/e2e/campus-issue-evidence.spec.js` now distinguishes the saved response paragraph from the editable textarea.
- This audit report. Phase 4.9C changed only this report.

## Release decision and next actions

The OTP index blocker is closed locally. No open P0 or P1 findings remain in the audited candidate. The application fixes were verified in the worktree and the running development stack was preserved. Open P2 findings are index provisioning gaps, client pagination gaps, chat retry deduplication, and OTP delivery deduplication. Request log redaction and observability remain P3 follow-ups.

Phase 5.0 should verify production HTTPS and DNS, ingress and secret handling, the production index catalog and approved provisioning procedure, backup and real restore, monitoring and alerting, and deployment and rollback rehearsal. Production deployment is a separate release decision.
