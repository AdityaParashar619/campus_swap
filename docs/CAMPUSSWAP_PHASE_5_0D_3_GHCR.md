# CampusSwap GHCR release workflow

CampusSwap ships one same-origin `linux/amd64` image from `Dockerfile.same-origin`. The React bundle and Express API share the container and HTTP origin. The two Compose images still have independent CI security checks. The publication workflow ships only the same-origin image.

## Registry, visibility and cost

An image is a versioned application filesystem plus runtime configuration. A container is a running instance with its own process and writable layer. GitHub hosts the Git repository and review history. GHCR stores container configuration, manifests and layers that Docker can pull.

The canonical repository is `AdityaParashar619/campus_swap`. The public portfolio image is `ghcr.io/adityaparashar619/campusswap`. It supports credential-free pulls. Public visibility exposes available versions and their layers. GitHub does not support returning a public package to private visibility. [GHCR documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) · [Package access controls](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)

GitHub currently lists GHCR image storage and bandwidth as free. Standard runners are free for this public repository. Recheck terms before future releases. [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) · [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)

## Visibility incident closure

The owner approved retaining `ghcr.io/adityaparashar619/campusswap@sha256:98d289492c2557053c001f23300b66bf7b71010604d06562455ad0905f62ad82` as an intentionally public artifact. The first release was expected to be private. Review of the exact manifest, configuration, and seven image layers identified no sensitive application data. GitHub's initial visibility decision remains unconfirmed. Closure applies to this digest. Each future dispatch requires its own public-distribution approval. [Original release](https://github.com/AdityaParashar619/campus_swap/actions/runs/45570186380)

## What the workflow does

| Workflow line or step | What it means |
| --- | --- |
| `workflow_dispatch`, `commit_sha` and `confirm_public_distribution` | A maintainer dispatches from `main` with the reviewed full SHA and explicitly sets public approval to true. Approval defaults to false and is checked before the publication job starts. |
| Canonical repository and `refs/heads/main` guards | A copied workflow on a fork, a branch dispatch or a tag dispatch cannot run the release jobs. Main is the trusted code and workflow boundary. |
| `permissions: {}` | Start with an empty token permission set. |
| `verify-source` | Give the job `actions: read` and `contents: read` for the API checks. The SHA must equal the dispatch SHA and the current main tip. Query the newest CI push run for that SHA and require the expected five jobs to succeed. A PR merge-ref check cannot stand in for a main push check. |
| `needs: verify-source` | Failed, missing or skipped source CI leaves publishing blocked. |
| `publish` | The only job with `packages: write`. Checkout pins the commit and disables credential persistence. The job receives no deployment or cloud permissions. |
| `build-production-image.sh` | Shared with CI. Archive the committed tree into a temporary context, inject synthetic exclusion canaries, set and validate the OCI source/revision/version labels, and build one local image. Verify UID/GID, native imports and npm exclusion, then inspect layer material, config and history. |
| `install-trivy.sh` and scan step | Both workflows use the same pinned Trivy archive, checksum and policy. The release scan takes the local image ID, updates the vulnerability database and fails closed. It emits no raw reports. |
| Isolated smoke test | Start tmpfs MongoDB and the exact scanned image on an internal network with synthetic runtime settings. Verify liveness, readiness, SPA assets and restricted demo mode. Cleanup is scoped to those resources. |
| Registry step | Only this step receives the job's `GITHUB_TOKEN` for registry use. Docker reads it on standard input and stores credentials in a temporary Docker config. The resulting package is associated with the source workflow repository. |
| Digest and visibility verification | After the push, check the manifest's config hash and the tag-to-digest mapping. Fetch the exact digest using anonymous registry access and verify its bytes. The summary records the digest and observed public visibility. An inconclusive probe records `unverified` and fails the run. The image may already exist in that case. |

The ordinary five-job CI workflow stays read-only and verifies the source revision. The release job may produce a different image from CI even for the same commit because base package repositories and build metadata can change. Its own inspection, scan and runtime smoke test are the artifact-level gates. No raw scan report or SBOM is uploaded. [Workflow dispatch behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) · [GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)

OCI metadata exposes the public source URL and full commit SHA as the revision and version. It carries no build-time credentials. The shared build uses `git archive` to avoid including ignored environment files, real Git metadata, backups and untracked runbooks. Synthetic canaries cover those exclusions. The image inspection checks every layer for private filenames and canary bytes. The existing application-layer checks and Trivy filesystem and image configuration secret scanning remain active.

## Tags, digests and rollback

The full commit SHA **tag** provides readable traceability. Tags are registry pointers and can technically be reassigned. A **local image ID** identifies the image in the Docker daemon. The **config digest** hashes the image configuration, including its layer content identities. A **registry manifest digest** hashes the published manifest that references the configuration and compressed layer blobs. The Docker image store can report a local ID different from the config digest, so the workflow records and checks them separately. Use the registry-reported manifest digest for deployments. [Docker image digests](https://docs.docker.com/dhi/explore/security-concepts/digests)

Use this minimal Compose service on a prepared host. The external `campusswap-demo` Docker network connects the app to its isolated demo MongoDB service. MongoDB has no published port. Keep the runtime file operator-owned and outside Git. Use the demo environment template, a dedicated MongoDB URI, an exact HTTPS frontend origin, and independent JWT and OTP secrets. Provision indexes and a synthetic account only on the new demo database before first app startup.

```yaml
services:
  app:
    image: ${CAMPUSSWAP_IMAGE:?Set the approved digest reference}
    env_file: /opt/campusswap/runtime.env
    ports: ["127.0.0.1:8080:5000"]
    restart: unless-stopped
    networks: [demo]
networks:
  demo:
    external: true
    name: campusswap-demo
```

Record the current known-good digest before replacing the app. Run from the directory containing the prepared Compose file.

```sh
export CAMPUSSWAP_IMAGE=ghcr.io/adityaparashar619/campusswap@sha256:98d289492c2557053c001f23300b66bf7b71010604d06562455ad0905f62ad82
docker compose pull app
docker compose up -d --no-deps --force-recreate app
curl --fail --retry 15 --retry-connrefused http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/live
```

Confirm that the app serves the frontend and that synthetic login works through the intended HTTPS ingress. For an actual rollback, verify database compatibility with the prior release, set `CAMPUSSWAP_IMAGE` to its recorded manifest digest, and repeat the app-only replacement and checks. Keep the database and runtime configuration in place. Recreating or restarting the same digest tests service recovery. Switching to a different known-good digest tests release rollback. This is the first approved image, so cross-release rollback remains untested.

The local rehearsal pulled this digest anonymously and ran it with tmpfs MongoDB on an internal network. It provisioned all 49 indexes and passed liveness, readiness, SPA serving, invite-only login, protected profile access and refresh rotation before and after restart. A database network interruption returned readiness 503 while liveness stayed 200. Readiness and login recovered after reconnecting. The disposable containers and network were removed.

## Next AWS step

1. Verify the current AWS Free plan, remaining credits and expiration. Inventory existing instances, volumes and addresses in `us-east-1` before planning anything new. Check instance, EBS, IPv4 and transfer costs against the actual account.
2. Prepare one Terraform plan for an eligible **x86-64** EC2 instance, an encrypted root volume and one security group in a verified existing subnet. Start with operator-restricted SSH and keep the app on loopback. Add HTTPS ingress through the existing Nginx approach once a suitable hostname and certificate are available. Keep MongoDB on the host's private Docker network using a dedicated demo database and volume.
3. Review the saved plan and resource costs before approving an apply. Keep credentials out of Terraform state, user data and the repository. Install Docker and pull the approved public digest without a registry credential. Use the app-only procedure above and separately approve teardown of any resources created for the demo.

This plan uses one host and the existing tools. It requires no NAT gateway, managed load balancer, new registry, or paid account upgrade. [AWS Free plan terms](https://aws.amazon.com/free/free-tier-faqs/) · [EC2 eligibility](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html)
