#!/usr/bin/env bash
# Regenerates the root sprint7-spec.yaml from the canonical copy at
# docs/sprint-07/spec.yaml. Root file exists only because
# `githeri verify-exec --spec sprint7-spec.yaml` parses it; edit the docs copy.
set -eu
cd "$(dirname "$0")/.."
{
  echo "# GENERATED from docs/sprint-07/spec.yaml by scripts/sync-sprint7-spec.sh"
  echo "# Do not edit directly — edit the canonical copy and re-run that script."
  cat docs/sprint-07/spec.yaml
} > sprint7-spec.yaml
echo "sprint7-spec.yaml synced from docs/sprint-07/spec.yaml"
