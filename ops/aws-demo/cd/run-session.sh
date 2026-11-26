#!/usr/bin/env bash
set -euo pipefail
umask 077

mode=${1:-}
[[ $# -eq 1 && "$mode" =~ ^(diagnostic|deploy)$ && "$INSTANCE" =~ ^i-[a-f0-9]{17}$ && "$DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]]
command -v session-manager-plugin >/dev/null
parameters=$(jq -cn --arg mode "$mode" --arg digest "$DIGEST" '{Mode: [$mode], Digest: [$digest]}')
scratch=$(mktemp -d "${RUNNER_TEMP:?}/campusswap-session.XXXXXXXX")
trap 'rm -f -- "$scratch/stdout" "$scratch/stderr"; rmdir -- "$scratch"' EXIT
status=0
timeout 660s aws ssm start-session --document-name CampusSwapDeployDemo \
  --target "$INSTANCE" --parameters "$parameters" </dev/null >"$scratch/stdout" 2>"$scratch/stderr" || status=$?
printf 'SESSION_TRANSPORT_EXIT=%s\n' "$status"
pattern='DEPLOYMENT_(SUCCEEDED|UNCHANGED|FAILED|BUSY|ROLLED_BACK|ROLLBACK_FAILED|DIAGNOSTIC_OK|DIAGNOSTIC_STDERR_OK|ERROR=(arguments|diagnostic|filesystem|preflight|candidate|activation))|SESSION_(EXECUTOR_STARTED|EXECUTOR_ERROR=(arguments|temporary_storage)|STDOUT_REDACTED|STDERR_REDACTED|REMOTE_EXIT=[0-9]{1,3})'
stdout=$(tr -d '\r' <"$scratch/stdout" | grep -Ex "$pattern" || true)
stderr=$(tr -d '\r' <"$scratch/stderr" | grep -Ex "$pattern" || true)
printf '%s\n' "$stdout"
printf '%s\n' "$stderr" >&2
# The client may forward both remote streams on stdout. Never publish arbitrary client output.
for error in AccessDeniedException TargetNotConnected InvalidDocument InvalidParameters; do
  if grep -Fq "($error)" "$scratch/stderr"; then printf 'SESSION_CLIENT_ERROR=%s\n' "$error" >&2; fi
done
if [[ -s "$scratch/stderr" && -z "$stderr" ]]; then printf 'SESSION_CLIENT_STDERR_REDACTED\n' >&2; fi
markers=$(printf '%s\n%s\n' "$stdout" "$stderr")
[[ "$status" -eq 0 && $(grep -Ec '^SESSION_REMOTE_EXIT=' <<<"$markers") -eq 1 ]]
grep -Fxq 'SESSION_EXECUTOR_STARTED' <<<"$markers" || { printf 'SESSION_RESULT_ERROR=executor_marker_missing\n' >&2; exit 1; }
grep -Fxq 'SESSION_REMOTE_EXIT=0' <<<"$markers" || { printf 'SESSION_RESULT_ERROR=remote_failed\n' >&2; exit 1; }
if [[ "$mode" == diagnostic ]]; then
  grep -Fxq 'DEPLOYMENT_DIAGNOSTIC_OK' <<<"$markers"
  grep -Fxq 'DEPLOYMENT_DIAGNOSTIC_STDERR_OK' <<<"$markers"
else
  grep -Exq 'DEPLOYMENT_(SUCCEEDED|UNCHANGED)' <<<"$markers"
  if grep -Exq 'DEPLOYMENT_(FAILED|BUSY|ROLLED_BACK|ROLLBACK_FAILED)' <<<"$markers"; then exit 1; fi
fi
