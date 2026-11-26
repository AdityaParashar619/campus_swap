#!/usr/bin/env bash
set -euo pipefail
umask 077

stage=arguments
trap 'printf "DEPLOYMENT_ERROR=%s\n" "$stage" >&2' ERR
digest=${1:-}
mode=${2:-deploy}
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ && "$mode" =~ ^(diagnostic|deploy)$ && $# -ge 1 && $# -le 2 ]]
if [[ "$mode" == diagnostic ]]; then
  stage=diagnostic
  [[ $EUID -eq 0 && -r /opt/campusswap/runtime.env && -w /opt/campusswap ]]
  printf 'DEPLOYMENT_DIAGNOSTIC_OK\n'
  printf 'DEPLOYMENT_DIAGNOSTIC_STDERR_OK\n' >&2
  exit 0
fi

stage=filesystem
cd /opt/campusswap
exec 9>.deploy.lock
flock -n 9 || { echo DEPLOYMENT_BUSY; exit 1; }

repository=ghcr.io/adityaparashar619/campusswap
baseline="$repository@sha256:249c8623b771dc9b5ac18196c1c87587c9048fa81a8b68552747f351d4f7b3ed"
verified_record=last-verified-image
candidate="$repository@$digest"
config=(docker compose -f compose.yml -f compose.release.yml)

app_id() { docker compose -f compose.yml ps -q app; }
running_image() { docker inspect --format '{{.Config.Image}}' "$(app_id)"; }

bounded_logs() {
  [[ $(docker inspect --format '{{.HostConfig.LogConfig.Type}}:{{index .HostConfig.LogConfig.Config "max-size"}}:{{index .HostConfig.LogConfig.Config "max-file"}}' "$(app_id)") == local:10m:3 ]]
}

stage=preflight
[[ $(stat -c '%u:%a' runtime.env) == 0:600 ]]
runtime_hash=$(sha256sum runtime.env)
public_ip=$(sed -n 's@^FRONTEND_URL=https://\([0-9.]*\)$@\1@p' runtime.env)
[[ "$public_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]

http_200() {
  [[ $(curl --disable --noproxy '*' --silent --max-time 3 --output /dev/null \
    --write-out '%{http_code}' "$@") == 200 ]]
}

healthy() {
  local route
  for route in live health; do
    http_200 "http://127.0.0.1:8080/$route" &&
      http_200 --connect-to "$public_ip:443:127.0.0.1:443" "https://$public_ip/$route" || return 1
  done
  curl --disable --noproxy '*' --silent --fail --max-time 3 \
    --connect-to "$public_ip:443:127.0.0.1:443" "https://$public_ip/api/auth/capabilities" |
    grep -Eq '"emailFlowsEnabled"[[:space:]]*:[[:space:]]*true'
}

wait_healthy() {
  local deadline=$((SECONDS + 60))
  until healthy; do
    ((SECONDS < deadline)) || return 1
    sleep 2
  done
}

write_atomic() {
  local path=$1 content=$2 temp
  temp=$(mktemp ".${path}.XXXXXXXX") || return 1
  if printf '%s\n' "$content" > "$temp" && mv -f -- "$temp" "$path"; then
    return 0
  fi
  rm -f -- "$temp"
  return 1
}

# Read-only startup checks use the same runtime and Atlas indexes as the live app.
faculty_compatible() {
  local image=$1
  timeout 45s docker run --rm --pull never --env-file /opt/campusswap/runtime.env --entrypoint node "$image" \
    --input-type=module -e '
      import mongoose from "mongoose";
      import { connectDB, isDatabaseReady } from "./config/db.js";
      import { env } from "./config/env.js";
      try {
        if (!env.facultyDemoMode || env.pilotModeEnabled || env.emailProvider !== "gmail" ||
            process.env.CLOUDINARY_ASSET_NAMESPACE !== "campusswap-faculty") process.exit(1);
        await connectDB();
        if (!isDatabaseReady() || mongoose.connection.db.databaseName !== "campusswap_demo") process.exitCode = 1;
      } catch { process.exitCode = 1; }
      finally { await mongoose.disconnect().catch(() => {}); }
    ' >/dev/null 2>&1
}

start_image() {
  local image=$1
  write_atomic compose.release.yml "$(printf 'services:\n  app:\n    image: %s\n    logging:\n      driver: local\n      options:\n        max-size: "10m"\n        max-file: "3"' "$image")" &&
    timeout 45s "${config[@]}" up -d --no-deps --force-recreate --pull never app >/dev/null 2>&1 &&
    [[ $(running_image) == "$image" ]] && bounded_logs && wait_healthy
}

# Only the reviewed faculty baseline or a digest recorded by a healthy CD rollout can be a rollback target.
current=$(running_image)
[[ "$current" == "$repository@"* && "${current##*@}" =~ ^sha256:[a-f0-9]{64}$ ]]
if [[ -f "$verified_record" ]]; then
  [[ "$current" == "$(< "$verified_record")" ]]
else
  [[ "$current" == "$baseline" ]]
fi
docker image inspect "$current" >/dev/null 2>&1
healthy
if [[ "$current" == "$candidate" ]] && bounded_logs; then
  write_atomic "$verified_record" "$current"
  echo DEPLOYMENT_UNCHANGED
  exit 0
fi
stage=candidate
if [[ "$current" != "$candidate" ]]; then
  auth=$(mktemp -d)
  trap 'rm -f -- "$auth/config.json"; rmdir -- "$auth"' EXIT
  printf '{"auths":{}}\n' > "$auth/config.json"
  timeout 90s docker --config "$auth" pull "$candidate" >/dev/null 2>&1
  trap - EXIT
  rm -f -- "$auth/config.json"
  rmdir -- "$auth"
fi
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$candidate" |
  grep -Fx "$candidate" >/dev/null
faculty_compatible "$candidate" || { echo DEPLOYMENT_FAILED; exit 1; }
[[ "$runtime_hash" == "$(sha256sum runtime.env)" ]]
if [[ "$current" != "$candidate" ]]; then write_atomic previous-image "$current"; fi

stage=activation
rollback_needed=1
finish() {
  local status=$?
  trap - EXIT
  trap '' INT TERM
  if ((rollback_needed)); then
    if start_image "$current" && write_atomic "$verified_record" "$current"; then
      echo DEPLOYMENT_ROLLED_BACK
    else
      echo DEPLOYMENT_ROLLBACK_FAILED
    fi
    exit 1
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! start_image "$candidate" || [[ "$runtime_hash" != "$(sha256sum runtime.env)" ]] || ! write_atomic "$verified_record" "$candidate"; then
  echo DEPLOYMENT_FAILED
  exit 1
fi
rollback_needed=0
echo DEPLOYMENT_SUCCEEDED
