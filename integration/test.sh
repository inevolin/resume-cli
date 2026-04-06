#!/usr/bin/env bash
# integration/test.sh — local-only cross-CLI session detection test for histd
#
# Tests every source→reader direction:
#   claude → codex, copilot
#   codex  → claude, copilot
#   copilot → claude, codex
#
# Each test:
#   1. Runs the source CLI non-interactively with a unique marker in the prompt.
#   2. Queries histd directly (via MCP) to verify it parsed the session.
#   3. Runs the reader CLI and asks it to call the histd MCP tool, then verifies
#      the marker appears in the MCP tool result (not just the LLM output).
#
# Prerequisites: claude, codex, gh (with copilot extension), node, npm
# All CLIs must have histd configured as an MCP server (see README).
#
# Usage:
#   ./integration/test.sh               # run all directions
#   ./integration/test.sh --only-parse  # skip the live CLI→MCP round-trip tests

set -euo pipefail

HISTD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUERY="node $HISTD_DIR/integration/query.mjs"
ONLY_PARSE=0

for arg in "$@"; do
  case $arg in
    --only-parse) ONLY_PARSE=1 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── helpers ──────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
PASS=0; FAIL=0; SKIP=0

pass()  { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail()  { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
skip()  { echo -e "${YELLOW}~${NC} $1 (skipped: $2)"; SKIP=$((SKIP+1)); }
header(){ echo -e "\n${YELLOW}── $1 ──${NC}"; }

has_cmd() { command -v "$1" &>/dev/null; }

# Create a canonical temp directory (resolves macOS /tmp → /private/tmp symlink).
make_test_dir() {
  local d; d=$(mktemp -d)
  realpath "$d"
}

# Query histd for $1 (project path); print raw output.
query_histd() { $QUERY "$1" 2>/dev/null; }

# Returns 0 if the marker is found in histd output for $1.
histd_has_marker() {
  local project="$1" marker="$2"
  query_histd "$project" | grep -qF "$marker"
}

# Run Codex non-interactively and check if the histd MCP tool result contains
# the marker. Checks the Codex session JSONL directly so we don't depend on the
# LLM paraphrasing the tool output verbatim.
codex_histd_has_marker() {
  local project="$1" marker="$2"

  # Stamp a reference file so we can find the session created by this run.
  local ref; ref=$(mktemp)

  codex exec \
    "Call the histd get_recent_context tool with project_path='$project'." \
    --yolo --skip-git-repo-check -C "$project" \
    2>/dev/null || true

  # Find the newest Codex session file written after our reference stamp.
  local session_file
  session_file=$(find ~/.codex/sessions -name "*.jsonl" -newer "$ref" \
    2>/dev/null | sort | tail -1)
  rm -f "$ref"

  [[ -z "$session_file" ]] && return 1

  # Look for the marker inside any function_call_output record in the session.
  python3 - "$session_file" "$marker" <<'EOF'
import json, sys
path, marker = sys.argv[1], sys.argv[2]
with open(path) as f:
    for line in f:
        try:
            r = json.loads(line)
            p = r.get('payload', {})
            if p.get('type') == 'function_call_output' and marker in p.get('output', ''):
                sys.exit(0)
        except Exception:
            pass
sys.exit(1)
EOF
}

# ── build ─────────────────────────────────────────────────────────────────────

header "Building histd"
cd "$HISTD_DIR"
npm run build --silent
pass "histd built"

# ── source: claude ───────────────────────────────────────────────────────────

header "Source: Claude Code"

if ! has_cmd claude; then
  skip "Claude session creation" "claude not in PATH"
else
  CLAUDE_DIR=$(make_test_dir)
  CLAUDE_MARKER="histd-claude-src-$$"
  trap 'rm -rf "$CLAUDE_DIR"' EXIT

  echo "  Creating Claude session in $CLAUDE_DIR ..."
  (cd "$CLAUDE_DIR" && claude -p "Reply with exactly one word: $CLAUDE_MARKER" \
      --dangerously-skip-permissions \
      --output-format text 2>/dev/null) || true

  sleep 1

  if histd_has_marker "$CLAUDE_DIR" "$CLAUDE_MARKER"; then
    pass "histd parses Claude session (marker found)"
  else
    fail "histd did NOT find Claude session for $CLAUDE_DIR"
    echo "  histd output:"
    query_histd "$CLAUDE_DIR" | head -10 | sed 's/^/    /'
  fi

  if [[ $ONLY_PARSE -eq 0 ]]; then
    if ! has_cmd codex; then
      skip "Codex reads Claude session" "codex not in PATH"
    else
      echo "  Asking Codex to read Claude session via histd ..."
      if codex_histd_has_marker "$CLAUDE_DIR" "$CLAUDE_MARKER"; then
        pass "Codex → histd → Claude session (marker in MCP tool result)"
      else
        fail "Codex did NOT surface Claude session marker"
      fi
    fi

    if ! has_cmd gh; then
      skip "Copilot reads Claude session" "gh not in PATH"
    else
      echo "  Asking Copilot to read Claude session via histd ..."
      COPILOT_OUT=$(cd "$CLAUDE_DIR" && gh copilot -- \
        -p "Call the histd get_recent_context tool with project_path='$CLAUDE_DIR'. Print the EXACT verbatim text returned by the tool, do not summarize." \
        --yolo --silent 2>/dev/null || true)
      if echo "$COPILOT_OUT" | grep -qF "$CLAUDE_MARKER"; then
        pass "Copilot → histd → Claude session (marker found in Copilot output)"
      else
        fail "Copilot did NOT surface Claude session marker"
      fi
    fi
  fi
fi

# ── source: codex ─────────────────────────────────────────────────────────────

header "Source: Codex"

if ! has_cmd codex; then
  skip "Codex session creation" "codex not in PATH"
else
  CODEX_DIR=$(make_test_dir)
  CODEX_MARKER="histd-codex-src-$$"
  trap 'rm -rf "$CODEX_DIR"' EXIT

  echo "  Creating Codex session in $CODEX_DIR ..."
  codex exec "Reply with exactly one word: $CODEX_MARKER" \
    --yolo --skip-git-repo-check -C "$CODEX_DIR" \
    2>/dev/null || true

  sleep 1

  if histd_has_marker "$CODEX_DIR" "$CODEX_MARKER"; then
    pass "histd parses Codex session (marker found)"
  else
    fail "histd did NOT find Codex session for $CODEX_DIR"
    echo "  histd output:"
    query_histd "$CODEX_DIR" | head -10 | sed 's/^/    /'
  fi

  if [[ $ONLY_PARSE -eq 0 ]]; then
    if ! has_cmd claude; then
      skip "Claude reads Codex session" "claude not in PATH"
    else
      echo "  Asking Claude to read Codex session via histd ..."
      CLAUDE_OUT=$(cd "$CODEX_DIR" && claude -p \
        "Call the histd-local get_recent_context tool with project_path='$CODEX_DIR'. Print the EXACT verbatim text returned by the tool, do not summarize." \
        --dangerously-skip-permissions --output-format text 2>/dev/null || true)
      if echo "$CLAUDE_OUT" | grep -qF "$CODEX_MARKER"; then
        pass "Claude → histd → Codex session (marker found in Claude output)"
      else
        fail "Claude did NOT surface Codex session marker"
      fi
    fi

    if ! has_cmd gh; then
      skip "Copilot reads Codex session" "gh not in PATH"
    else
      echo "  Asking Copilot to read Codex session via histd ..."
      COPILOT_OUT=$(cd "$CODEX_DIR" && gh copilot -- \
        -p "Call the histd get_recent_context tool with project_path='$CODEX_DIR'. Print the EXACT verbatim text returned by the tool, do not summarize." \
        --yolo --silent 2>/dev/null || true)
      if echo "$COPILOT_OUT" | grep -qF "$CODEX_MARKER"; then
        pass "Copilot → histd → Codex session (marker found in Copilot output)"
      else
        fail "Copilot did NOT surface Codex session marker"
      fi
    fi
  fi
fi

# ── source: copilot ───────────────────────────────────────────────────────────

header "Source: Copilot"

if ! has_cmd gh; then
  skip "Copilot session creation" "gh not in PATH"
else
  COPILOT_DIR=$(make_test_dir)
  COPILOT_MARKER="histd-copilot-src-$$"
  trap 'rm -rf "$COPILOT_DIR"' EXIT

  echo "  Creating Copilot session in $COPILOT_DIR ..."
  (cd "$COPILOT_DIR" && gh copilot -- \
    -p "Reply with exactly one word: $COPILOT_MARKER" \
    --yolo --silent 2>/dev/null) || true

  sleep 1

  if histd_has_marker "$COPILOT_DIR" "$COPILOT_MARKER"; then
    pass "histd parses Copilot session (marker found)"
  else
    fail "histd did NOT find Copilot session for $COPILOT_DIR"
    echo "  histd output:"
    query_histd "$COPILOT_DIR" | head -10 | sed 's/^/    /'
  fi

  if [[ $ONLY_PARSE -eq 0 ]]; then
    if ! has_cmd claude; then
      skip "Claude reads Copilot session" "claude not in PATH"
    else
      echo "  Asking Claude to read Copilot session via histd ..."
      CLAUDE_OUT=$(cd "$COPILOT_DIR" && claude -p \
        "Call the histd-local get_recent_context tool with project_path='$COPILOT_DIR'. Print the EXACT verbatim text returned by the tool, do not summarize." \
        --dangerously-skip-permissions --output-format text 2>/dev/null || true)
      if echo "$CLAUDE_OUT" | grep -qF "$COPILOT_MARKER"; then
        pass "Claude → histd → Copilot session (marker found in Claude output)"
      else
        fail "Claude did NOT surface Copilot session marker"
      fi
    fi

    if ! has_cmd codex; then
      skip "Codex reads Copilot session" "codex not in PATH"
    else
      echo "  Asking Codex to read Copilot session via histd ..."
      if codex_histd_has_marker "$COPILOT_DIR" "$COPILOT_MARKER"; then
        pass "Codex → histd → Copilot session (marker in MCP tool result)"
      else
        fail "Codex did NOT surface Copilot session marker"
      fi
    fi
  fi
fi

# ── summary ───────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────"
echo -e "  ${GREEN}Passed${NC}: $PASS"
[[ $SKIP -gt 0 ]] && echo -e "  ${YELLOW}Skipped${NC}: $SKIP"
[[ $FAIL -gt 0 ]] && echo -e "  ${RED}Failed${NC}: $FAIL"
echo "────────────────────────────────"

[[ $FAIL -eq 0 ]]
