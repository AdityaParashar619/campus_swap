#!/usr/bin/env bash
set -euo pipefail

version=0.76.2
archive="trivy_${version}_Linux-64bit.tar.gz"
bin="${RUNNER_TEMP:?}/trivy-bin"
mkdir -p "$bin"
cd "$bin"
curl --fail --silent --show-error --location --retry 3 --max-time 120 \
  "https://github.com/aquasecurity/trivy/releases/download/v${version}/$archive" --output "$archive"
echo "bc0fc726e017b8927a62b2d3531d7a84ee01769daf5c99ed866dced54089fdbf  $archive" | sha256sum --check --strict
tar -xzf "$archive" trivy
./trivy --version
echo "$bin" >> "${GITHUB_PATH:?}"
echo "cache-day=$(date -u +%F)" >> "${GITHUB_OUTPUT:?}"
