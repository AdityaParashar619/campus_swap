# CampusSwap DevSecOps and Trivy

Phase 5.0D.2 adds local and CI security gates to the publication worktree. The first verification rejected existing container findings. Phase 5.0D.2A corrected those blockers, and the revised artifacts passed the same gate locally on 25 November 2026. Publication is pending review.

## Security baseline

The five existing CI jobs cover frontend tests and build, backend tests with disposable MongoDB, isolated Chromium, merged production Compose, and same-origin image inspection. The image already runs as `node`, installs backend production dependencies with `npm ci --omit=dev`, and copies built frontend assets into the runtime stage. Build context exclusions and five synthetic canaries check that environment files, backups, private media and browser traces stay out of the image. Application checks include environment-scoped CORS, authentication, authorization and security headers. Previously CI had no continuous software composition, secret or Dockerfile misconfiguration scan, and no image SBOM.

## How the checks work

DevOps automates build, verification and delivery. DevSecOps adds security feedback and a release policy to those same steps. Software composition analysis (SCA) identifies third-party packages and matches their versions to advisory data. A CVE identifies a publicly catalogued vulnerability. CVSS estimates technical severity given a set of assumptions. Actual exposure depends on which code runs, which inputs reach it, what permissions it has and what other protections apply.

Direct dependencies are declared in a project's manifest. Transitive dependencies are pulled in by those dependencies. A lockfile pins both and distinguishes production from development entries. The repository scans include both groups because development dependencies execute in CI and can affect builds. The image scan answers a different question by inspecting the final Alpine package inventory and installed Node package manifests. It sees npm's own bundled dependencies too. Separately, the frontend lockfile scan covers libraries used to build the browser bundle because minified assets typically lack installed-package manifests. A zero-result scan covers the selected inputs and advisory data available at scan time.

The scanner uses [Trivy v0.76.2](https://github.com/aquasecurity/trivy/releases/tag/v0.76.2). The workflow downloads the official Linux amd64 archive and verifies a hard-coded SHA-256 from the immutable release. Local verification used the official Windows archive, also checksum-verified. No Trivy action wrapper is required. The [official vulnerability DB](https://trivy.dev/docs/latest/configuration/db/) is initialized before each vulnerability scan. Trivy uses its OCI mirrors and decides when to refresh from DB metadata. The script also requires DB schema 2 and an update within 48 hours. A failed required download, invalid metadata or missing package coverage is an execution failure. Dockerfile checks use the pinned binary's embedded rules so the selected policies are reproducible across machines.

The source snapshot contains tracked working-tree files and the two named candidate files during local review. The snapshot guards against tracked private archives, ignored environment paths and symlinked files. It excludes Git history and untracked files such as local runbooks. Trivy checks the source and the image filesystem for known secret patterns. The image check also inspects image configuration. Raw findings stay in temporary files, with only rule identifiers, safe locations and package/version fields logged. Secret-pattern detection cannot establish whether a credential is live. Treat detections as blocking until reviewed.

Trivy checks the three Dockerfiles. Existing Compose validation evaluates the merged configuration and asserts loopback-only frontend ingress, no published backend or database ports, disabled private evidence, no privileged or host-networked services, no added capabilities, and `no-new-privileges` for every service. The Render-specific assertions still check its deployment configuration. There is no Trivy Compose rule coverage claimed.

## GitHub Actions wiring

| Workflow entry | Purpose |
| --- | --- |
| `pull_request` and `push` for `main` and `develop` | Use the existing CI triggers. |
| `permissions: contents: read` | Limit the token to source reads. The workflow has no package publication, deployment, security-event or cloud permissions. |
| `ubuntu-24.04` and `timeout-minutes: 30` on the image job | Use a standard Linux runner with a bounded budget for the three image builds, database download and scans. |
| SHA-pinned checkout and setup-node | Reuse the existing pinned actions with checkout credential persistence disabled. |
| `id: production-image` | Identify the existing successful build and exclusion-canary checks before scanning its local image. |
| `Install checksum-pinned Trivy` | Fetch and hash-check the archive before extraction, verify the executable and add its temporary directory to the runner PATH. Compute a UTC date for the cache key. |
| SHA-pinned `actions/cache` v4.3.0 | Cache only `trivy-cache/db`, keyed by scanner version, OS and UTC date with a same-version restore prefix. A restored cache still goes through Trivy's refresh and the age check. GitHub scopes caches written by PRs to the PR merge ref. |
| `Scan publication files and Dockerfiles` | Apply the policy to the source snapshot, both npm lockfiles including dev dependencies, and all Dockerfiles in scope. |
| `Scan the inspected local production image` | Run even if the repository gate failed, provided installation and image inspection succeeded and the workflow was not cancelled. Resolve the exact local Docker image ID and disable registry fallback for the target. |
| Mandatory step exit codes | Code 0 means passed, 1 means policy findings blocked the scan, and 2 means verification could not complete. Either nonzero code fails CI. |

The checks use standard public-repository runners and public upstream data. CI does not upload raw security reports or SBOMs. The Docker image stays local to its runner.

## Quality policy

| Finding | Gate |
| --- | --- |
| CRITICAL vulnerability | Block. |
| HIGH vulnerability with a fixed version | Block. |
| HIGH vulnerability without a fixed version | Flag explicitly for documented risk review before release. |
| MEDIUM, LOW or unknown vulnerability | Report for triage. |
| Secret-pattern finding | Block and review privately. |
| HIGH or CRITICAL Dockerfile check failure | Block. Lower severities remain visible. |
| Scanner, database, coverage or report failure | Fail closed as an execution error. |

There are no exceptions. A future exception should name the exact vulnerability or rule and component, document the technical basis and mitigating controls, name a reviewer, and have an expiration or review date. Investigate false positives using package paths, execution context and vendor advisories before requesting a scoped exception.

## Local reproduction

Run these commands from the publication worktree using a POSIX shell. Put the checksum-verified Trivy binary on PATH for this session. The commands do not start a database or the application.

```sh
audit_dir="$(mktemp -d)"
node ops/scan-security.mjs repo "$audit_dir/cache"

docker build --pull --file Dockerfile.same-origin --tag campusswap-ci:security-local .
test "$(docker image inspect --format '{{.Config.User}}' campusswap-ci:security-local)" = node
node ops/inspectDeploymentImage.cjs campusswap-ci:security-local
node ops/scan-security.mjs image "$audit_dir/cache" campusswap-ci:security-local "$audit_dir/image.cdx.json"

npm --prefix backend audit --omit=dev
npm --prefix backend audit
npm --prefix frontend audit --omit=dev
npm --prefix frontend audit
actionlint .github/workflows/ci.yml
git diff --check
```

To reproduce the exclusion-canary test, copy a clean tracked snapshot to a disposable directory and use the workflow's existing five canary commands before building. Keep local reports and the SBOM outside the worktree. The wrapper will not overwrite a pre-existing SBOM.

## Findings and triage

| Target | Result |
| --- | --- |
| npm audit, backend and frontend, production and full | All four completed with zero advisories. |
| Trivy, both lockfiles with dev dependencies | Zero vulnerability findings. |
| Repository, image filesystem and image configuration | Zero secret findings. |
| Three Dockerfiles | One HIGH and two LOW configuration findings. |
| Same-origin image | Zero CRITICAL, ten HIGH, 19 MEDIUM and five LOW vulnerability findings (package/advisory pairs). No HIGH without a fix. |

Image checked locally: `sha256:19e85ca9e0159e84a222e7d39161aecfb4611b4d5c19376d0b0e3bb354c6cd65`. Trivy DB schema 2 was updated at `2026-11-24T13:06:50.432Z`. The image ran as `node` and inspection passed across eight layers and 160 application files.

All ten HIGH image matches were transitive dependencies of the npm CLI supplied by the Node base image. They were located under `/usr/local/lib/node_modules/npm/`. The server starts with `node server.js`, so it does not require the npm CLI to launch. The finding still matters for a distributable image.

| Advisory | Package, installed | Fixed reported by Trivy |
| --- | --- | --- |
| CVE-2026-102276, CVE-2026-102278, CVE-2026-13149, CVE-2026-14257, CVE-2026-69152 | `brace-expansion` 2.0.2 | 2.x fixes range from 2.1.2 to 2.1.6 across the HIGH matches. The MEDIUM CVE-2026-102277 reports 2.1.7. |
| CVE-2026-69192 | `ip-address` 10.1.0 | 10.3.1. MEDIUM findings report fixes through 10.7.4. |
| CVE-2026-9496 | `pacote` 19.0.2 and 20.0.1 | 21.5.1 |
| CVE-2026-33671 | `picomatch` 4.0.3 | 4.0.4 on the 4.x line |
| CVE-2026-48815 | `sigstore` 3.1.0 | 4.1.1 |

The smallest durable remediation for these HIGH findings is a Node 22 base digest that ships a verified patched npm dependency tree, if available. Otherwise use a matching Alpine final stage that copies the Node executable, app modules and required runtime libraries from pinned sources and omits the package manager from the shipped layers. Avoid independently rewriting npm's transitive tree. Several fixes cross version boundaries and may break npm itself. Verify the rebuilt image, non-root user, native bcrypt and Sharp loading, health and the same-origin application. [Node Docker image best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#smaller-images-without-npmyarn)

The 19 MEDIUM and five LOW image matches include Alpine `libcrypto3` and `libssl3` 3.5.9-r0 with fixes in 3.5.9-r1, and `zlib` 1.3.2-r1 with a reported fix in 1.4-r0. Prefer a patched base digest and verify the package is available in its Alpine release line. Other findings affect the bundled npm CLI, including `@sigstore/core`, `glob`, `minimatch`, `postcss-selector-parser` and several packages listed above. Review the installed versions and fixes when rescanning the replacement image.

The separate Nginx frontend Dockerfile triggers HIGH `DS-0002` because its runtime image defaults to root. It is part of the Compose topology. The same-origin production image already runs as `node`. Use an unprivileged Nginx runtime with an explicit non-root user and a compatible listener, PID/temp paths and health check. Keep the host binding on loopback and verify HTTP and WebSocket proxy behavior after changing the internal port. [NGINX unprivileged image configuration](https://github.com/nginx/docker-nginx-unprivileged#readme)

LOW `DS-0026` flags the missing image-native health check in the same-origin and backend Dockerfiles. Render already declares an HTTP health check for the same-origin image, and production Compose supplies the backend health check. A direct Docker invocation has no image-native health check. [Trivy health-check rule](https://avd.aquasec.com/misconfig/dockerfile/general/ds-0026/)

## Verification and the next phase

CycloneDX 1.7 generation produced 375 components, including 19 Alpine packages and the installed Express package. The wrapper verified the image identity and checked the SBOM for secret patterns. The local SBOM review also checked the synthetic exclusion canary and private-data markers. The SBOM is an inventory. A later GHCR workflow should bind it to the published manifest digest so it can be checked against new advisories without guessing which tag was scanned. Define report visibility before distributing SBOMs.

Local policy rehearsal verified that a disposable synthetic secret triggered a sanitized finding and exit 1. A missing binary and an unavailable vulnerability DB each produced exit 2. The original CI-only revision passed workflow lint, production Compose assertions, image canaries and Git whitespace checks. Hosted execution awaits publication approval.

## Phase 5.0D.2A container remediation

The original image's first layers matched the verified official `node:22-alpine` base at `sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a`. The candidate runs Node 22.23.5, npm 10.9.9 and Alpine 3.24.4. Scanning that exact candidate reproduced all ten HIGH findings in the npm CLI's dependency tree. The Node binary links against musl, libstdc++ and libgcc. The application package graphs were clean. A distro advisory can affect an image even when its application's npm audit passes. A HIGH advisory in a bundled installer also does not establish that an application request reaches it.

### Dockerfile and routing details

- The first `ARG` in the same-origin Dockerfile pins the Node base used by both build stages. The Compose images use the same base digest for their build stages. A tag describes intent and can move. The digest fixes the specific upstream artifact for review.
- The frontend stage still runs `npm ci` and emits the Vite bundle. The backend dependency stages still run `npm ci --omit=dev`, preserving runtime modules and their native builds. These are build-time uses of npm.
- Each Node final stage starts from pinned Alpine 3.24 at `sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf`. It installs the CA bundle and libstdc++ (which brings libgcc) and creates the existing Node numeric UID/GID 1000:1000. Its Alpine musl runtime matches the build ABI. npm and Yarn are absent because their base layers are confined to the builder.
- The selective `COPY` carries forward only the Node executable and Node's entrypoint wrapper from the builder. The existing application copies retain the production modules, source and, for the same-origin image, the static bundle. `USER node` preserves ownership and runtime permissions. The wrapper uses `exec`, so Docker delivers SIGTERM to the server process. The default command remains `node server.js`.
- The separate frontend final stage uses the upstream unprivileged Nginx Alpine image at `sha256:637c35e46af7bc0dd3d3bcf7162e004e13ab3b370fde7cd416e2ac410b5a985a` and declares user/group 101:101. Root is UID 0 and has broader privileges inside its namespace. Port 8080 also avoids the historical privileged port range below 1024. The upstream image writes its PID and temporary files under `/tmp`.
- `listen`, `EXPOSE` and the Nginx health probe now use internal port 8080. All Compose files map to that port. The development and production host defaults stay 8080, E2E stays 8081, and production and E2E remain bound to loopback. Nginx serves the static bundle, falls back to the SPA entry point for routes, and forwards API and Socket.IO traffic to the backend. Its HTTP/1.1 Upgrade headers remain intact.
- The CI workflow checks the new Compose target port and exercises UID/GID, native imports and npm exclusion in the same-origin image. The image job also builds and gates the two Compose images using the same Trivy database and severity policy. The wrapper verifies Alpine package coverage plus Express for Node images or Nginx for the frontend image.

[Official Node container build guidance](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#smaller-images-without-npmyarn) · [Upstream unprivileged Nginx behavior](https://github.com/nginx/docker-nginx-unprivileged#readme)

### Observed comparison

Same Trivy 0.76.2 database snapshot as the baseline. Sizes are the bytes reported by Docker image inspection and advisories are package/advisory pairs.

| Image | Bytes | Layers | CycloneDX components | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Previous same-origin | 355,070,132 | 8 | 375 | 0 | 10 | 19 | 5 |
| Corrected same-origin | 312,518,114 | 7 | 177 | 0 | 0 | 7 | 4 |
| Corrected Compose backend | 310,984,836 | 6 | — | 0 | 0 | 7 | 4 |
| Corrected Compose frontend | 91,724,299 | 11 | — | 0 | 0 | 1 | 0 |

Corrected image IDs used for verification:

- Same-origin `sha256:4c217e69457d1f4a90ea60900d8668c7bc02e8ff728f8ac4319b1a2b7aa80de3`.
- Compose backend `sha256:a4b28443861f27051612cc825b8f683b18018af46cea88f107ca29bdca25ccb5`.
- Compose frontend `sha256:6076167a052e12e6cd36dccfb0eef2b0e730d54e368abc30888ca0084b9a825e`.

Both npm lockfiles remained clean and all four gates exited 0. The remaining image findings are the Alpine OpenSSL library and zlib matches described above. The separate frontend has only the zlib match. Dockerfile root finding `DS-0002` no longer appears. The two LOW `DS-0026` reports remain because Render checks same-origin readiness and Compose already defines Node health checks. A standalone `docker run` of the Node images still requires an external probe. The Nginx image retains its own probe. No scan exclusions, severity exceptions or application dependency changes were used.

The corrected CycloneDX 1.7 SBOM matched the scanned image ID and includes the Alpine package inventory and Express. It stayed local. The corrected same-origin image passed five private-data exclusion canaries across all seven layers and retained 160 application files. Registry publication should verify the eventual registry manifest digest, and regular rebuilds should refresh upstream pins and package indexes. The base manifests are pinned, but Alpine package downloads during build can change with repository updates.

### Reproduce the corrected scans

From the publication worktree, using the verified Trivy binary on PATH and an external audit directory as above:

```sh
docker build --pull -f Dockerfile.same-origin -t campusswap-ci:phase50d2a-local .
docker build --pull -f backend/Dockerfile -t campusswap-ci:phase50d2a-backend backend
docker build --pull -f frontend/Dockerfile -t campusswap-ci:phase50d2a-frontend frontend
docker image inspect --format '{{.Id}} {{.Size}} {{len .RootFS.Layers}} {{.Config.User}}' \
  campusswap-ci:phase50d2a-local campusswap-ci:phase50d2a-backend campusswap-ci:phase50d2a-frontend
node ops/scan-security.mjs repo "$audit_dir/cache"
node ops/scan-security.mjs image "$audit_dir/cache" campusswap-ci:phase50d2a-local "$audit_dir/production.cdx.json"
node ops/scan-security.mjs compose-backend "$audit_dir/cache" campusswap-ci:phase50d2a-backend
node ops/scan-security.mjs compose-frontend "$audit_dir/cache" campusswap-ci:phase50d2a-frontend
```

The isolated regression runs completed with 226 backend, 118 frontend and 14 Chromium passes, zero failures or skips, and zero Chromium flakes. The production frontend build, all three Compose configurations and workflow lint passed.

The three scanned image IDs were also used in an internal Docker network with tmpfs MongoDB. The same-origin demo provisioned all 49 indexes and one synthetic account. Both HTTP topologies served assets and SPA fallbacks, passed liveness and database readiness, logged in and rotated a Secure, HttpOnly refresh cookie, and authorized Socket.IO over an upgraded WebSocket. Demo registration was rejected. Both Node containers performed a bcrypt round trip and a Sharp WebP conversion. Nginx ran as 101:101, used a writable PID location under `/tmp`, and passed its image health check. All three containers exited zero and passed the route and authentication checks after restarting. The split topology used synthetic production provider settings inside the network because restricted demo mode requires same-origin serving. The smoke test exercised the application's forwarded HTTPS contract without a public TLS ingress.
