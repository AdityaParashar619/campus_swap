#!/usr/bin/env bash
set -euo pipefail

image=${1:?Supply a local image tag}
revision=$(git rev-parse --verify HEAD)
source_url=https://github.com/AdityaParashar619/campus_swap
[[ $revision =~ ^[a-f0-9]{40}$ ]]

# Build from the committed tree. Canary files exist only inside this disposable context.
context=$(mktemp -d "${TMPDIR:-/tmp}/campusswap-image.XXXXXXXX")
trap 'rm -rf -- "$context"' EXIT
git archive --format=tar "$revision" | tar -xf - -C "$context"
canary=$(node -p 'require("node:crypto").randomUUID()')
mkdir -p "$context"/{.git,docs,backend/backups,frontend/src/private-attachments,frontend/test-results}
printf '%s\n' "$canary" > "$context/.git/canary"
printf '%s\n' "$canary" > "$context/docs/ci-private-runbook.md"
printf '%s\n' "$canary" > "$context/backend/.env.ci-canary"
printf 'VITE_SOCKET_URL=https://%s.example.invalid\n' "$canary" > "$context/frontend/.env.production.local"
printf '%s\n' "$canary" > "$context/backend/backups/ci-canary.archive"
printf '%s\n' "$canary" > "$context/frontend/src/private-attachments/ci-canary.js"
printf '%s\n' "$canary" > "$context/frontend/test-results/trace.zip"

docker buildx build --load --platform linux/amd64 --provenance=false --tag "$image" \
  --label "org.opencontainers.image.source=$source_url" \
  --label "org.opencontainers.image.revision=$revision" \
  --label "org.opencontainers.image.version=$revision" \
  --file "$context/Dockerfile.same-origin" "$context"

id=$(docker image inspect --format '{{.Id}}' "$image")
[[ $id =~ ^sha256:[a-f0-9]{64}$ ]]
metadata=$(docker image inspect --format '{{.Os}}/{{.Architecture}} {{.Config.User}} {{index .Config.Labels "org.opencontainers.image.source"}} {{index .Config.Labels "org.opencontainers.image.revision"}} {{index .Config.Labels "org.opencontainers.image.version"}}' "$id")
test "$metadata" = "linux/amd64 node $source_url $revision $revision"
docker run --rm --network none --entrypoint sh "$id" -ec '
  test "$(id -u):$(id -g)" = 1000:1000
  test -z "$(command -v npm || true)"
  test ! -e /usr/local/lib/node_modules/npm
  node -e "require(\"bcrypt\"); require(\"sharp\")"
'
DEPLOYMENT_AUDIT_CANARIES="$canary" node ops/inspectDeploymentImage.cjs "$id"
if [[ -n ${GITHUB_OUTPUT:-} ]]; then
  printf 'image-id=%s\n' "$id" >> "$GITHUB_OUTPUT"
fi
printf 'Inspected %s for source %s\n' "$id" "$revision"
