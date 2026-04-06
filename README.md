<p align="center">
  <h1 align="center">histd</h1>
  <p align="center">
    An MCP server that lets AI agents query your cross-tool coding session history.<br/>
    Switch between Claude Code, Cursor, Copilot, and Codex without losing context.
  </p>
</p>

<p align="center">
  <a href="https://github.com/inevolin/histd/actions/workflows/ci.yml"><img src="https://github.com/inevolin/histd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/histd"><img src="https://img.shields.io/npm/v/histd.svg" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

## Quick Start

**1. Add histd to your AI tool's MCP config** (no install needed, `npx` runs it on demand):

```json
{ "mcpServers": { "histd": { "command": "npx", "args": ["histd"] } } }
```

See [MCP Setup](#mcp-setup) below for the exact file location for each tool.

**2. Install the `/histd` slash command:**

```bash
npx skills add inevolin/histd
```

That's it. Type `/histd` in Claude Code, Codex, or Copilot CLI to restore context from your last sessions.

---

## Why histd?

AI coding tools store conversation history in proprietary, tool-specific formats — JSONL, SQLite, JSON — scattered across your home directory. When you switch tools, your context is lost.

**histd** is an MCP server. When you start a session in a new AI tool, it can call `get_recent_context` to retrieve your recent conversations for the current project — regardless of which tool they came from.

No background process. No config file. Just add it to your MCP config once.

## Supported Tools

| Tool | Format | Auto-detected path |
|------|--------|--------------------|
| Claude Code | JSONL | `~/.claude/projects/` |
| Cursor | SQLite (`.vscdb`) | `~/.config/Cursor/User/workspaceStorage/` |
| GitHub Copilot CLI | JSONL | `~/.copilot/session-state/` |
| OpenAI Codex CLI | JSONL | `~/.codex/sessions/` |

macOS paths (`~/Library/Application Support/...`) are detected automatically for Cursor.

## MCP Setup

Add histd to each tool's MCP config. No installation required — `npx` fetches it on demand.

**Claude Code** (`~/.claude.json` → `mcpServers`):
```json
{
  "mcpServers": {
    "histd-local": {
      "command": "npx",
      "args": ["histd"]
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):
```toml
[mcp_servers.histd]
command = "npx"
args = ["histd"]

[mcp_servers.histd.tools.get_recent_context]
approval_mode = "auto"
```

**GitHub Copilot CLI** (`~/.copilot/mcp-config.json`):
```json
{
  "mcpServers": {
    "histd": {
      "type": "stdio",
      "command": "npx",
      "args": ["histd"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "histd": {
      "command": "npx",
      "args": ["histd"]
    }
  }
}
```

## Slash Command

Install the `/histd` slash command for one-step context restore in any supported AI CLI:

```bash
npx skills add inevolin/histd
```

Then type `/histd` in Claude Code, Codex, or Copilot CLI to get a one-line-per-session summary of recent work across all tools.

## Usage

### Slash command (recommended)

After running `npx skills add inevolin/histd`, type `/histd` at the start of any session:

```
/histd
```

The agent calls `get_recent_context` for the current directory and replies with a one-line summary per session plus a short recap of recent decisions.

### Natural language

Just ask at the start of a session:

> "Check my recent history for this project before we start."
> "What was I working on here last time?"
> "Restore context from my previous sessions."

### Direct tool call

You can also invoke the tool explicitly:

**Claude Code:**
```
Use the histd-local get_recent_context tool for /Users/you/my-project
```

**Codex / Copilot CLI:**
```
Call the histd get_recent_context tool with project_path='/Users/you/my-project'
```

**Non-interactive (scripting):**
```bash
# Claude Code
claude -p "Use the histd-local get_recent_context tool for $(pwd)" --dangerously-skip-permissions

# Codex
codex exec "Call the histd get_recent_context tool for $(pwd)" --yolo

# Copilot CLI
gh copilot -- -p "Call the histd get_recent_context tool for $(pwd)" --yolo --silent
```

## Tool Reference

### `get_recent_context`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_path` | string | yes | Absolute path to the project directory |
| `limit` | number | no | Max sessions to return (default: 5, max: 50) |

**Returns:** Formatted text listing recent sessions, newest first:

```
[1] Claude Code — 2026-04-06T14:30:00Z — /Users/you/my-project
User: How do I refactor the database layer?
Assistant: Here's an approach using the repository pattern…

[2] Codex — 2026-04-05T09:15:00Z — /Users/you/my-project
…
```

## Architecture

```
src/
├── index.ts          — MCP server entry point; registers get_recent_context
├── discovery.ts      — Maps each tool to its default FS paths + parser
└── parser/
    ├── types.ts      — HistoryParser interface + Session/Message types
    ├── claude.ts     — Claude Code JSONL parser
    ├── cursor.ts     — Cursor SQLite parser
    ├── copilot.ts    — GitHub Copilot CLI JSONL parser
    └── codex.ts      — OpenAI Codex CLI JSONL parser
```

## Development

```bash
npm install
npm run build        # compile TypeScript
npm test             # run unit tests
```

### Integration tests

End-to-end tests that create real sessions in each CLI and verify cross-tool detection:

```bash
bash integration/test.sh               # full suite (requires claude, codex, gh)
bash integration/test.sh --only-parse  # fast parse-only check, no LLM round-trips
```

## License

MIT — see [LICENSE](LICENSE).
