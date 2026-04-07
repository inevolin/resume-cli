#!/usr/bin/env bash
# Launches resume-cli with HOME and PATH overridden to use demo fixtures and stubs.
# This ensures no real user data is read and no real AI tools are launched.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec env \
  HOME="$SCRIPT_DIR/fixtures" \
  PATH="$SCRIPT_DIR/stubs:$PATH" \
  node "$REPO_ROOT/dist/cli.js"
