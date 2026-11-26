#!/usr/bin/env bash
set -euo pipefail
umask 077

mode=${1:-}
digest=${2:-}
payload=${3:-}
if [[ $# -ne 3 || ! "$mode" =~ ^(diagnostic|deploy)$ || ! "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  printf 'SESSION_EXECUTOR_ERROR=arguments\nSESSION_REMOTE_EXIT=64\n' >&2
  exit 64
fi
scratch=$(mktemp -d) || { printf 'SESSION_EXECUTOR_ERROR=temporary_storage\nSESSION_REMOTE_EXIT=1\n' >&2; exit 1; }
trap 'rm -f -- "$scratch/stdout" "$scratch/stderr"; rmdir -- "$scratch"' EXIT
printf 'SESSION_EXECUTOR_STARTED\n'
status=0
{ printf '%s' "$payload" | /usr/bin/base64 --decode |
  /usr/bin/timeout --kill-after=150s 420s /usr/bin/bash -s -- "$digest" "$mode"; } \
  >"$scratch/stdout" 2>"$scratch/stderr" || status=$?
stdout_pattern='DEPLOYMENT_(SUCCEEDED|UNCHANGED|FAILED|BUSY|ROLLED_BACK|ROLLBACK_FAILED|DIAGNOSTIC_OK)'
stderr_pattern='DEPLOYMENT_(DIAGNOSTIC_STDERR_OK|ERROR=(arguments|diagnostic|filesystem|preflight|candidate|activation))'
grep -Ex "$stdout_pattern" "$scratch/stdout" || true
grep -Ex "$stderr_pattern" "$scratch/stderr" >&2 || true
if grep -Eqvx "$stdout_pattern" "$scratch/stdout"; then printf 'SESSION_STDOUT_REDACTED\n'; fi
if grep -Eqvx "$stderr_pattern" "$scratch/stderr"; then printf 'SESSION_STDERR_REDACTED\n' >&2; fi
printf 'SESSION_REMOTE_EXIT=%s\n' "$status"
exit "$status"
