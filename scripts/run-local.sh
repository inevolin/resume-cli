#!/usr/bin/env bash
# Local test runner — builds and launches resume-cli via the shell-function pattern.
# Usage: bash scripts/run-local.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "Building..."
cd "$ROOT"
npm run build

echo "Launching..."
cmd=$(node dist/cli.js 2>/dev/tty)
if [ $? -eq 0 ] && [ -n "$cmd" ]; then
  echo "Running: $cmd"
  eval "$cmd"
fi
