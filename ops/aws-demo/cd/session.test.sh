#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
scratch=$(mktemp -d)
trap 'rm -r -- "$scratch"' EXIT
digest=sha256:$(printf 'a%.0s' {1..64})
export DIGEST=$digest INSTANCE=i-0123456789abcdef0 RUNNER_TEMP=$scratch

# Session Manager shlex passes arguments to exec, so a raw pipe stays a literal operand.
old=$(printf '%s' fixture '|' /usr/bin/base64 -d)
[[ "$old" == 'fixture|/usr/bin/base64-d' ]]

# Reproduce the rendered Session Manager argv, with the shell program as one argument.
program=$(sed -n "s/^ *\/usr\/bin\/bash -c '\([^']*\)' -- .*/\1/p" main.tf)
[[ -n "$program" ]]
executor=$(base64 -w0 session-executor.sh)
payload=$(base64 -w0 <<'FIXTURE'
set -euo pipefail
[[ "$1" == "$DIGEST" ]]
printf '%s\n' synthetic-private-stdout
printf '%s\n' synthetic-private-stderr >&2
if [[ "$2" == diagnostic ]]; then
  printf 'DEPLOYMENT_DIAGNOSTIC_OK\n'
  printf 'DEPLOYMENT_DIAGNOSTIC_STDERR_OK\n' >&2
  exit 0
fi
printf 'DEPLOYMENT_ERROR=candidate\n' >&2
exit 42
FIXTURE
)
invoke() { /usr/bin/bash -c "$program" -- "$executor" "$1" "$digest" "$payload"; }
invoke diagnostic >"$scratch/remote.out" 2>"$scratch/remote.err"
grep -Fxq DEPLOYMENT_DIAGNOSTIC_OK "$scratch/remote.out"
grep -Fxq DEPLOYMENT_DIAGNOSTIC_STDERR_OK "$scratch/remote.err"
grep -Fxq SESSION_REMOTE_EXIT=0 "$scratch/remote.out"
! grep -Fq synthetic-private "$scratch/remote.out" "$scratch/remote.err"
status=0
invoke deploy >"$scratch/remote.out" 2>"$scratch/remote.err" || status=$?
[[ $status -eq 42 ]]
grep -Fxq SESSION_REMOTE_EXIT=42 "$scratch/remote.out"
grep -Fxq DEPLOYMENT_ERROR=candidate "$scratch/remote.err"
grep -Fxq SESSION_STDERR_REDACTED "$scratch/remote.err"
! grep -Fq synthetic-private "$scratch/remote.out" "$scratch/remote.err"

mkdir "$scratch/bin"
printf '#!/usr/bin/env bash\nexit 0\n' >"$scratch/bin/session-manager-plugin"
cat >"$scratch/bin/aws" <<'FIXTURE'
#!/usr/bin/env bash
printf 'SESSION_EXECUTOR_STARTED\n'
if [[ "$*" == *diagnostic* ]]; then
  printf 'DEPLOYMENT_DIAGNOSTIC_OK\nDEPLOYMENT_DIAGNOSTIC_STDERR_OK\nSESSION_REMOTE_EXIT=0\n'
elif [[ "$*" == *deploy* ]]; then
  printf 'DEPLOYMENT_ERROR=candidate\nSESSION_REMOTE_EXIT=42\n'
fi
printf 'synthetic-private-client-output\n' >&2
FIXTURE
# Keep mode visible to the AWS stub without using an AWS client.
cat >"$scratch/bin/jq" <<'FIXTURE'
#!/usr/bin/env bash
printf '%s\n' "$@"
FIXTURE
chmod 0700 "$scratch/bin/"*
export PATH="$scratch/bin:$PATH"
bash run-session.sh diagnostic >"$scratch/client.out" 2>"$scratch/client.err"
grep -Fxq SESSION_TRANSPORT_EXIT=0 "$scratch/client.out"
grep -Fxq DEPLOYMENT_DIAGNOSTIC_STDERR_OK "$scratch/client.out"
if bash run-session.sh deploy >"$scratch/client.out" 2>"$scratch/client.err"; then
  echo 'Runner accepted a nonzero remote exit' >&2
  exit 1
fi
grep -Fxq SESSION_REMOTE_EXIT=42 "$scratch/client.out"
grep -Fxq SESSION_CLIENT_STDERR_REDACTED "$scratch/client.err"
! grep -Fq synthetic-private "$scratch/client.out" "$scratch/client.err"
printf 'Session executor regression passed\n'
