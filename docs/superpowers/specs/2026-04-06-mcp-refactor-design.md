# histd MCP Refactor — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Overview

Refactor histd from a background file-watching daemon into a Model Context Protocol (MCP) server. The core value proposition — cross-tool AI session context continuity — is better served by an MCP server that AI agents can query directly than by a passive daemon writing Markdown files to disk.

## Goals

- Eliminate the persistent background process and all its operational burden (startup, crash recovery, file-watching edge cases)
- Expose a single queryable tool that AI agents call when they need prior context
- Support Claude Code, Cursor, Windsurf, GitHub Copilot, and OpenAI Codex CLI
- Zero config: auto-discover all well-known tool paths; skip paths that don't exist

## Non-goals

- Markdown file output (dropped entirely)
- TOML configuration file
- Full-text search across sessions
- Session management beyond read-only access

## Architecture

### File changes

**Deleted:**
```
src/config.ts
src/watcher.ts
src/generator.ts
src/config.test.ts
src/generator.test.ts
```

**Kept unchanged:**
```
src/parser/types.ts
src/parser/claude.ts
src/parser/cursor.ts
src/parser/claude.test.ts
src/parser/cursor.test.ts
```

**Rewritten:**
```
src/index.ts             — MCP server entry point (complete rewrite of daemon entry)
```

**Added:**
```
src/discovery.ts         — maps each tool to default FS paths + parser instance
src/parser/codex.ts      — OpenAI Codex CLI parser
src/parser/codex.test.ts — fixture-based tests
src/discovery.test.ts    — unit tests for path resolution
```

**Dependencies:**
- Remove: `chokidar`, `smol-toml`
- Add: `@modelcontextprotocol/sdk`, `zod`

### Component responsibilities

#### `src/discovery.ts`

Auto-discovers default paths per tool at runtime. Returns `DiscoveryEntry[]`:

```typescript
interface DiscoveryEntry {
  tool: string;
  paths: string[];    // directories to scan; non-existent paths are silently skipped
  parser: HistoryParser;
}
```

Tool → path → parser mapping:

| Tool | Path (macOS) | Path (Linux) | Parser |
|---|---|---|---|
| `claude-code` | `~/.claude/projects/` | same | `ClaudeParser` |
| `cursor` | `~/Library/Application Support/Cursor/User/workspaceStorage/` | `~/.config/Cursor/User/workspaceStorage/` | `CursorParser` |
| `copilot` | `~/Library/Application Support/Code/User/workspaceStorage/` | `~/.config/Code/User/workspaceStorage/` | `CursorParser` |
| `codex` | `~/.codex/` | same | `CodexParser` |

Copilot reuses `CursorParser` — GitHub Copilot (VS Code extension) stores conversations in the same `.vscdb` SQLite format as Cursor.

#### `src/parser/codex.ts`

Reads OpenAI Codex CLI conversations from `~/.codex/` as JSON files:

```
~/.codex/
└── history/
    └── <uuid>.json   — array of {role, content} message objects
```

Follows the same `HistoryParser` interface as existing parsers. Defensive parsing: unexpected JSON shapes are caught and skipped gracefully.

#### `src/index.ts` (MCP server)

Creates an MCP server with a single registered tool, connected via stdio transport.

**Tool:** `get_recent_context`

- **Input:** `project_path: string` (required), `limit: number` (optional, default 5)
- **Validation:** zod schema, rejects malformed input before any FS access
- **Pipeline:**
  1. `getEntries()` — get all discovery entries
  2. Glob files under each entry's paths
  3. `parser.canHandle(file)` → `parser.parse(file)` per file
  4. Filter sessions where `session.project === project_path` OR `session.project` ends with `project_path` OR `path.basename(session.project) === path.basename(project_path)`
  5. Sort by `timestamp` descending
  6. Return top `limit` sessions as formatted text

**Return format:**
```
[1] Claude Code — 2026-04-06T14:30:00Z — /Users/ilya/histd
User: How do I refactor the database layer?
Assistant: Here's an approach using...

[2] Cursor — 2026-04-05T09:15:00Z — /Users/ilya/histd
...
```

If no sessions are found, returns a clear informational message rather than an MCP error.

## Error handling

| Scenario | Behavior |
|---|---|
| Discovery path doesn't exist | Silently skipped |
| File parse failure | Caught per-file, logged to stderr, processing continues |
| No sessions found for project | Returns informational message (not an error) |
| Invalid tool input | zod rejects at MCP layer before FS access |

## Testing

| File | What it tests |
|---|---|
| `src/parser/claude.test.ts` | Unchanged |
| `src/parser/cursor.test.ts` | Unchanged |
| `src/parser/codex.test.ts` | Fixture-based parsing, handles malformed input |
| `src/discovery.test.ts` | Path resolution per tool, platform variants (mock `os.homedir()`) |

`src/index.ts` (server wiring) is not unit tested — it's a thin integration layer with no logic.

## User installation

```json
// ~/.claude/claude_desktop_config.json (Claude Desktop)
// or ~/.cursor/mcp.json (Cursor)
{
  "mcpServers": {
    "histd": {
      "command": "npx",
      "args": ["histd"]
    }
  }
}
```

No persistent process to manage. The MCP host starts histd on demand and stops it when done.
