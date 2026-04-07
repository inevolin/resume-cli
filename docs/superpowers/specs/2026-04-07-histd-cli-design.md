# histd CLI — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

## Overview

Rewrite histd from an MCP server into a standalone CLI tool (`histd`). When invoked, it gathers recent AI coding sessions from all detected tools (Claude Code, Codex, Copilot), presents an interactive TUI list, and launches the selected session in the chosen tool using native `--resume`.

---

## Architecture

```
src/
  cli.ts              ← entrypoint: loads sessions, mounts Ink TUI
  tui/
    App.tsx           ← root Ink component, manages state + keyboard input
    SessionList.tsx   ← scrollable list of sessions
    Footer.tsx        ← persistent bottom bar: target tool + key hints
  launcher.ts         ← writes synthetic session file (if needed) + spawns tool
  discovery.ts        ← (existing) remove project_path filter; return all sessions
  parser/
    claude.ts         ← (existing)
    codex.ts          ← (existing)
    copilot.ts        ← (existing)
    types.ts          ← (existing)
```

`package.json` adds `"bin": { "histd": "dist/cli.js" }`. `dist/` is committed so `npx github:inevolin/histd` works without publishing to npm.

The MCP server (`src/index.ts`) is removed entirely.

---

## TUI (Ink / Layout A)

**Framework:** Ink (React for terminals). Handles raw mode, resize, and clean exit.

**State (in `App.tsx`):**
- `sessions: Session[]` — loaded on mount, sorted by timestamp descending, max 50
- `cursor: number` — index of highlighted row
- `toolIndex: number` — index into the list of detected installed tools

**Key bindings:**
- `↑` / `↓` — move cursor
- `Tab` — cycle `toolIndex` forward
- `Enter` — launch (see Launcher)
- `q` / `Ctrl-C` — exit

**`SessionList.tsx`** — one row per session, up to ~20 visible rows with scrolling:
```
▶ Claude Code   Apr 06   Fixed parser bugs and rewrote CodexParser
  Codex         Apr 05   Analyzed MCP vs daemon architecture
  Copilot       Apr 04   Added cross-CLI integration tests
```

**`Footer.tsx`** — single persistent line at bottom:
```
Continue in: ◀ Claude Code ▶   ↑↓ navigate · tab: switch tool · ↵ launch · q quit
```

The `◀ tool ▶` brackets update live as the user tabs. Only tools that are detected as installed appear in the cycle list.

---

## Launcher & Context Injection

`launcher.ts` receives the selected `Session` and the target tool name.

### Same-tool resume

Use the original session's UUID with native resume — no file writing:

| Target | Command |
|--------|---------|
| Claude Code | `claude --resume <sessionId>` |
| Codex | `codex resume <sessionId>` |
| Copilot | `gh copilot -- --resume=<sessionId>` |

### Cross-tool resume (synthetic session files)

Write the source session's messages into the target tool's native session file format under a fresh UUID, then resume with that UUID. The session file is written before spawning the process and left in place (it becomes a real entry in the tool's history).

**Claude Code target** — write `~/.claude/projects/<encoded-cwd>/<new-uuid>.jsonl`:
- `encoded-cwd`: current working directory with all non-alphanumeric chars replaced by `-`
- Records: one `user` + one `assistant` JSON line per message turn (minimal required fields: `type`, `uuid`, `parentUuid`, `sessionId`, `timestamp`, `message.role`, `message.content`)
- Launch: `claude --resume <new-uuid>`

**Codex target** — write `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<ts>.jsonl`:
- First record: `session_meta` with `session_id: <new-uuid>`
- Subsequent records: `event_msg` / `response_item` per turn
- Launch: `codex resume <new-uuid>`

**Copilot target** — write `~/.copilot/session-state/<new-uuid>/events.jsonl`:
- First record: `session.start` with `data.startTime` and `data.context.cwd`
- Subsequent records: `user.message` / `assistant.message` per turn
- Launch: `gh copilot -- --resume=<new-uuid>`

### Context content

Always use the full message transcript. Auto-compact is a runtime behavior and leaves no detectable record in session JSONL files, so there is nothing to detect or special-case.

---

## Tool Detection

At startup, `cli.ts` checks which tools are available by running `which claude`, `which codex`, `which gh` (and verifying `gh copilot` is installed). Only detected tools appear in the footer cycle list. If only one tool is detected, Tab is a no-op.

---

## Distribution

- `npx github:inevolin/histd` — runs without publish step (`dist/` committed)
- Shell alias: `alias histd='npx github:inevolin/histd'`
- `skills/histd/SKILL.md` updated to invoke `histd` via the shell tool instead of calling an MCP server

---

## What is removed

- `src/index.ts` (MCP server)
- MCP server configuration from README install instructions
- `integration/` tests that rely on MCP — the directory can be removed; manual smoke testing is sufficient for a dev tool of this scope
