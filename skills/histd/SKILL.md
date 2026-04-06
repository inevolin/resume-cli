---
name: histd
description: Restore context from recent AI coding sessions for this project. Call this when switching between AI tools (Claude Code, Codex, Copilot, Cursor) to see what was worked on recently.
---

# histd — session context restore

## What this skill does

Calls the `histd` MCP tool to retrieve recent AI coding session history for the current project, then presents a concise summary so you can continue work seamlessly after switching tools.

## Instructions

1. Determine the current project path (the working directory of this session).

2. Call the `get_recent_context` MCP tool:
   - In **Claude Code**: the server is named `histd-local` — call `histd-local: get_recent_context`
   - In **Codex** or **Copilot**: the server is named `histd` — call `histd: get_recent_context`
   - Pass `project_path` as the absolute path to the current working directory.
   - Use the default limit (5 sessions).

3. For each session returned, output one line:
   `<tool> — <date> — <one-sentence summary of what was worked on>`

4. After the list, add a short paragraph (2–4 sentences) highlighting any decisions made, open questions, or next steps visible across the sessions.

5. If no sessions are found, say so clearly and suggest the user check that histd is configured as an MCP server.

## Example output

```
Claude Code — 2026-04-06 — Rewrote CodexParser to target ~/.codex/sessions and fixed matchesProject encoding bug.
Codex       — 2026-04-05 — Reviewed MCP architecture, decided to drop the background daemon in favour of a pure MCP server.
Copilot     — 2026-04-04 — Added integration tests covering all 6 cross-CLI directions.

The main theme is stabilising the histd parsers after the MCP rewrite. The matchesProject fix for paths containing dots/dashes is recent and worth keeping in mind. No open blockers were noted.
```
