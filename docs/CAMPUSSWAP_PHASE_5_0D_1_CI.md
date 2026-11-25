# CampusSwap Phase 5.0D.1 — Reproducible CI

## What the hosted baseline measured

Run [45449813805](https://github.com/AdityaParashar619/campus_swap/actions/runs/45449813805) supplied `TEST_MONGO_URI` for registration, notices and academic resources, plus a synthetic JWT key and mock OTP delivery. It recorded 213 passes and nine skipped parent tests, for 222 outcomes. The private Campus Issues evidence parent contains four `t.test` cases. When its fixture is enabled, those four cases are reported separately, bringing the full inventory to 226. The previous 226-pass local run used these fixtures. There is no assertion or test removal in this change.

| Integration | Environment setting | Fixture |
| --- | --- | --- |
| Registration, Notices, Academic Resources | `TEST_MONGO_URI` | Shared MongoDB service for this job with a random test namespace. Individual tests scope their records. |
| Administrator rotation | `ADMIN_ROTATION_TEST_MONGO_URI` | Guarded port 27019 and a fixture-specific name. The test generates an additional random namespace. |
| Campus Issues HTTP lifecycle | `CAMPUS_ISSUE_TEST_MONGO_URI` | `campusswap_issues_test` in this job’s disposable MongoDB. |
| Private evidence and History | `CAMPUS_ISSUE_E4_TEST_MONGO_URI` | `campusswap_e4_integration_test`, with Cloudinary mocked. Enables the four nested cases. |
| Cold startup | `CAMPUS_ISSUE_STARTUP_TEST_MONGO_URI` | `campusswap_issue_init_test` and a separate app process. |
| Campus Locations | `CAMPUS_LOCATION_TEST_MONGO_URI` | `campusswap_locations_test` with synthetic student and admin identities. |
| Deployment index provisioning | `DEPLOYMENT_INDEX_TEST_MONGO_URI` | `campusswap_demo` on the disposable listener. The test creates its own randomly named demo namespaces. |
| Concurrent OTP issuance | `OTP_INDEX_REHEARSAL_URI` | `campusswap_otp_index_rehearsal_test`. The runner creates the unique email and kind index before running the test. |
| HTTP and WebSocket proxy | `CORS_PROXY_TEST_URL` | Real Vite proxy at port 5189 and the seeded fixture API on port 5194. The assertions exercise Vite and Socket.IO. Production Compose configuration is checked separately. |
| Socket.IO expiry and revocation | `PHASE44B_SOCKET_URL` | Separate authenticated Socket.IO fixture on port 5198 with a three-second token lifetime and its own random database. |

The previous workflow ran `npm test` for the frontend. That command runs Node’s test runner. The Playwright suite has a separate command and requires a browser and running services. Two Chromium tests also require `CAMPUS_ISSUE_E4_BROWSER=1` and the guarded fixture server.

## Read the workflow from top to bottom

| YAML entry | What it does in CampusSwap |
| --- | --- |
| `name: CI` | Names the workflow in the Actions UI. The file defines one workflow with five jobs. |
| `on.pull_request.branches` | Runs when a PR targets `main` or `develop`, including draft PR updates. |
| `on.push.branches` | Also checks direct changes to those two branches. A push to a feature branch with an open PR is checked via the PR event. |
| `permissions.contents: read` | Lets each job read the checkout. The workflow has no package publishing, deployment, or cloud identity permission. |
| `concurrency.group` and `cancel-in-progress` | Group runs by workflow and Git ref. New changes on the same ref cancel stale work while other refs keep their own runs. |
| `jobs.<id>.name` | Gives each job a stable, human-readable label to use when selecting required checks. |
| `runs-on: ubuntu-24.04` and `timeout-minutes` | Request a fresh standard Linux runner for each job and put a finite limit on stalled runs. There is no `needs` between these jobs. Their independent checks can run in parallel. |
| `steps` | Commands and actions within one job run in sequence and share that job’s checkout. The separate jobs do not share containers, files, or process state. |
| `actions/checkout@<SHA>` and `persist-credentials: false` | Use the verified action revision and avoid leaving Git checkout credentials in repository configuration for later scripts. |
| `actions/setup-node@<SHA>`, `node-version` and `cache-dependency-path` | Use the verified Node setup action, Node 22, and cache keys based on the applicable package lockfiles. The cache contains npm downloads. `npm ci` still installs from the lockfile on every job. |
| Frontend `defaults.run.working-directory` | Runs npm commands inside the frontend project. It tests the source and checks that a production bundle builds. |
| Backend and Chromium `services.mongodb` | Start MongoDB 8 for that job alone. Port 27019 is bound to loopback. Data and config directories are tmpfs. The health command exits successfully only when MongoDB answers a ping. GitHub Actions tears down the service at job completion. |
| `env.CI_TEST_MONGO_CONTAINER` | Tells the runner which MongoDB service to inspect before it can connect. It is a container identifier rather than a login secret. The runner refuses persistent mounts, non-loopback bindings or an unhealthy service. |
| Backend fixture step | Assembles the fixture environment from scratch, exercises API and proxy readiness, starts the short-lived Socket.IO fixture, then runs the full Node inventory. Fixed test database names are distinct within each disposable service. Names used by the shared, browser and socket fixtures are random. |
| Chromium install and fixture steps | Playwright installs its lockfile-matched Chromium and Linux libraries on the runner. The fixture starts the mock evidence API and a same-origin Vite proxy, checks readiness, then runs all Chromium specs with one worker and no retries. The production bundle is checked by the frontend job. |
| Production Compose validation | Renders the existing merged configuration and asserts that only the frontend is published to loopback. It also checks that the production override keeps private evidence disabled. |
| Deployment image build and inspection | Validates the manual Render blueprint, places synthetic canaries in forbidden build-context paths, and builds and inspects a same-origin image on the runner. The image must run as a non-root user and exclude forbidden files. |

## Isolation, failures and artifacts

The fixture runner refuses real dotenv files in its worktree. It passes child processes a limited environment with generated JWT and OTP values, test-only databases and mock mail. Private evidence uses the existing in-memory Cloudinary mock. A preload blocks off-host TCP connections in Node fixtures and tests. Chromium’s test proxy blocks public requests while loopback and explicitly mocked browser routes remain available. No GitHub repository secrets are required. This guard protects the test processes from accidental egress. It is not a sandbox for arbitrary code.

Tests begin only after health checks succeed. A failed child process, a nonzero test exit, a malformed report, an unexpected skip or a flaky Chromium result fails the corresponding job. The ordinary test scripts keep their legitimate opt-in guards for developers running without fixtures. The CI runner prints aggregate counts and failing test locations or names. It does not publish raw fixture output or Playwright traces, screenshots, videos or HTML reports. Browser artifacts can capture registration input, JWTs or private evidence, even in a synthetic run. All fixtures are local to the job, and the runner stops its child processes on completion.

## Proposed checks for main

After the updated workflow runs on GitHub, select these five GitHub Actions checks in the branch protection rule or ruleset for `main`.

- Frontend tests and production build
- Backend tests and integrations
- Chromium end-to-end
- Production Compose validation
- Deployment image build and inspection

Require the PR branch to be up to date before merge and confirm the check names in the first hosted run. This phase changes no repository settings. Standard hosted runners in the public repository keep this workflow within the ₹0 target. It publishes no images and creates no cloud resources.

## Local verification scope

The Node fixture entry points can run locally with an already healthy MongoDB 8 container using the same loopback port and tmpfs mounts. Supply that disposable container ID through `CI_TEST_MONGO_CONTAINER`, use a fresh container for each job, and stop only those containers after the run. Playwright must already have the lockfile-matched browser available locally. Local validation exercises the fixtures and assertions. The first hosted run still needs to confirm service-container behavior and browser dependencies on Ubuntu.

| Local check | Verified result |
| --- | --- |
| Backend with the complete fixture set | 226 tests passed. Zero failures, cancellations, skips or todos. |
| Frontend | 118 tests passed. Zero failures, cancellations, skips or todos. Production build passed. |
| Chromium | 14 passed in one complete run. Zero failures, flaky results or skips. |
| Compose | Base and E2E syntax passed. Merged production assertions passed. |
| Deployment image | Build passed. Image uses the `node` user. The exclusion-canary inspection passed across eight layers and 160 application files. |
| Workflow | Checksum-verified actionlint 1.7.12 passed. Both pinned action commits were checked against their upstream release tags. |
| Test harness guards | Rejected a missing disposable-container ID before connecting. Blocked a non-loopback TCP connection before DNS lookup. |

The first local fixture attempt exposed a Windows quoting problem in the Node preload path. The path was normalized and both end-to-end test commands passed in the final isolated run. Hosted verification is pending publication approval.
