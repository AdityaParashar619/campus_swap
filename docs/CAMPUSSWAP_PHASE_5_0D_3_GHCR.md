# CampusSwap GHCR release workflow

CampusSwap ships one same-origin `linux/amd64` image from `Dockerfile.same-origin`. The React bundle and Express API share the container and HTTP origin. The two Compose images still have independent CI security checks. The publication workflow ships only the same-origin image.

## Registry, visibility and cost

An image is a versioned application filesystem plus runtime configuration. A container is a running instance with its own process and writable layer. GitHub hosts the Git repository and review history. GHCR stores container configuration, manifests and layers that Docker can pull.

The canonical repository is `AdityaParashar619/campus_swap`. The proposed image is `ghcr.io/adityaparashar619/campusswap`, using the owner's lowercase registry namespace. GitHub defaults a new container package to private even when the repository is public. Keep the first authorized package private for package association, layer inspection and access checks. After a separately approved public release review, public visibility would let faculty and portfolio reviewers pull anonymously. A public package can expose every available version and its layers, and GitHub does not allow changing a public package back to private. [GHCR authentication and visibility](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) · [Package access controls](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)

GitHub currently lists GHCR container image storage and bandwidth as free. Standard runners are free for this public repository. The workflow creates no paid resources or deployment service. Check the current terms before the first authorized publication and again if the package grows or the terms change. [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) · [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)

## What the workflow does

| Workflow line or step | What it means |
| --- | --- |
| `workflow_dispatch` and required `commit_sha` | A maintainer explicitly runs the workflow and gives the reviewed full SHA. An ordinary PR or push cannot publish. GitHub must first have this workflow on the default branch. |
| Canonical repository and `refs/heads/main` guards | A copied workflow on a fork, a branch dispatch or a tag dispatch cannot run the release jobs. Main is the trusted code and workflow boundary. |
| `permissions: {}` | Start with an empty token permission set. |
| `verify-source` | Give the job `actions: read` and `contents: read` for the API checks. The SHA must equal the dispatch SHA and the current main tip. Query the newest CI push run for that SHA and require the expected five jobs to succeed. A PR merge-ref check cannot stand in for a main push check. |
| `needs: verify-source` | Failed, missing or skipped source CI leaves publishing blocked. |
| `publish` | The only job with `packages: write`. Checkout pins the commit and disables credential persistence. The job receives no deployment or cloud permissions. |
| `build-production-image.sh` | Shared with CI. Archive the committed tree into a temporary context, inject synthetic exclusion canaries, set and validate the OCI source/revision/version labels, and build one local image. Verify UID/GID, native imports and npm exclusion, then inspect layer material, config and history. |
| `install-trivy.sh` and scan step | Both workflows use the same pinned Trivy archive, checksum and policy. The release scan takes the local image ID, updates the vulnerability database and fails closed. It emits no raw reports. |
| Isolated smoke test | Start tmpfs MongoDB and the exact scanned image on an internal network with synthetic runtime settings. Verify liveness, readiness, SPA assets and restricted demo mode. Cleanup is scoped to those resources. |
| Registry step | Only this step receives the job's `GITHUB_TOKEN` for registry use. Docker reads it on standard input and stores credentials in a temporary Docker config. The resulting package is associated with the source workflow repository. |
| Digest verification | Tag the validated local ID with the source SHA. After pushing, match the remote manifest's config digest to the config hash taken from the inspected image archive and check that the tag resolves to the digest returned by the push. The run summary records the immutable reference. No second build occurs. |

The ordinary five-job CI workflow stays read-only and verifies the source revision. The release job may produce a different image from CI even for the same commit because base package repositories and build metadata can change. Its own inspection, scan and runtime smoke test are the artifact-level gates. No raw scan report or SBOM is uploaded. [Workflow dispatch behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) · [GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)

OCI metadata exposes the public source URL and full commit SHA as the revision and version. It carries no build-time credentials. The shared build uses `git archive` to avoid including ignored environment files, real Git metadata, backups and untracked runbooks. Synthetic canaries cover those exclusions. The image inspection checks every layer for private filenames and canary bytes. The existing application-layer checks and Trivy filesystem and image configuration secret scanning remain active.

## Tags, digests and rollback

The full commit SHA **tag** provides readable traceability. Tags are registry pointers and can technically be reassigned. A **local image ID** identifies the image in the Docker daemon. The **config digest** hashes the image configuration, including its layer content identities. A **registry manifest digest** hashes the published manifest that references the configuration and compressed layer blobs. The Docker image store can report a local ID different from the config digest, so the workflow records and checks them separately. Use the registry-reported manifest digest for deployments. [Docker image digests](https://docs.docker.com/dhi/explore/security-concepts/digests)

After separately authorized publication, use these commands from a Bash shell. For a private package the Docker client must already have approved read access. The workflow creates no personal access token or long-lived registry credential.

```sh
image=ghcr.io/adityaparashar619/campusswap
: "${COMMIT_SHA:?Set the approved full commit SHA}"
: "${RELEASE_DIGEST:?Set the sha256 manifest digest from the release summary}"

docker pull "$image:$COMMIT_SHA"
docker pull "$image@$RELEASE_DIGEST"
docker buildx imagetools inspect "$image@$RELEASE_DIGEST"
docker image inspect --format '{{json .Config.Labels}}' "$image@$RELEASE_DIGEST"
docker run --rm --name campusswap --env-file /protected/campusswap.env \
  -p 127.0.0.1:8080:5000 "$image@$RELEASE_DIGEST"
```

The runtime environment file sits outside Git and the image. For a demo, set the same-origin production variables documented in the template, including a dedicated MongoDB URI, HTTPS frontend origin and independent signing and OTP secrets. Provision the required indexes on the intended isolated deployment database before first startup. For rollback, record each successfully released manifest digest in the release log. Retrieve the previous known-good digest, verify it still exists using `imagetools inspect`, and use it as `RELEASE_DIGEST` with the same approved runtime configuration. Verify database compatibility before switching images.

## Local rehearsal

Use a clean publication worktree and a checksum-verified Trivy binary on PATH. The build helper uses the checked-out committed application tree. During review, the current local helper and inspector can still be exercised before committing the workflow files.

```sh
audit_dir="$(mktemp -d)"
bash ops/build-production-image.sh campusswap-release:local
id="$(docker image inspect --format '{{.Id}}' campusswap-release:local)"
node ops/scan-security.mjs image "$audit_dir/trivy-cache" "$id"
actionlint .github/workflows/ci.yml .github/workflows/publish-ghcr.yml
git diff --check
```

The local rehearsal built and inspected seven layers and 160 application files from the reviewed source commit. The image passed Trivy 0.76.2 with zero CRITICAL, HIGH or secret findings, seven MEDIUM findings and four LOW findings. Its isolated runtime passed after provisioning all 49 indexes in disposable MongoDB. The archive's config hash matched the Buildx configuration digest. Offline fixtures exercised the actual source and registry workflow steps. Each accepted its valid case and rejected stale or failed CI, incorrect source, local image drift, and failed or mismatched registry responses as applicable. A separate invalid database cache exercise confirmed that the Trivy gate failed closed.

The proposed workflow still needs a separately approved main merge and successful main CI before its first hosted dispatch. The first authorized run must verify GitHub token write access, package association and visibility, GHCR's returned manifest digest and anonymous access behavior after any later visibility change.
