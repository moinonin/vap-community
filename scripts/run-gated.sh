#!/usr/bin/env bash
# run-gated.sh <gate-name> <cmd...>
#
# Honest CI gate wrapper: never passes vacuously.
#   - If the tool (first word of <cmd...>) is NOT installed: print
#     "<gate-name> NOT CONFIGURED: <tool> not found" and exit 2.
#   - If the tool IS installed: run <cmd...> and propagate its exit code
#     (0 = pass, non-zero = fail).
#
# Exit codes: 0 pass · 1 gate/tool failure · 2 gate not configured.
set -u

name="${1:?usage: run-gated.sh <gate-name> <cmd...>}"
shift
tool="${1:?usage: run-gated.sh <gate-name> <cmd...>}"

if ! command -v "$tool" >/dev/null 2>&1; then
  echo "${name} NOT CONFIGURED: required tool '${tool}' not found in PATH (exit 2)" >&2
  exit 2
fi

echo "${name}: running: $*"
"$@"
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "${name} FAILED (exit ${rc})" >&2
else
  echo "${name} PASSED"
fi
exit "$rc"
