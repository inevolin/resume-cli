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

## Why histd?

AI coding tools store conversation history in proprietary, tool-specific formats — JSONL, SQLite, JSON — scattered across your home directory. When you switch tools, your context is lost.

**histd** is an MCP server. When you start a session in a new AI tool, it can call `get_recent_context` to retrieve your recent conversations for the current project — regardless of which tool they came from.

No background process. No config file. Just add it to your MCP config once.

## Supported Tools

| Tool | Format | Auto-detected path |
|------|--------|--------------------|
| Claude Code | JSONL | `~/.claude/projects/` |
| Cursor | SQLite (`.vscdb`) | `~/.config/Cursor/User/workspaceStorage/` |
| GitHub Copilot (VS Code) | SQLite (`.vscdb`) | `~/.config/Code/User/workspaceStorage/` |
| OpenAI Codex CLI | JSON | `~/.codex/history/` |

macOS paths (`~/Library/Application Support/...`) are also detected automatically.

## Setup

Add histd to your MCP config. No installation required — `npx` fetches it on demand.

**Claude Desktop** (`~/.claude/claude_desktop_config.json`):
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

Restart your AI tool after updating the config.

## Usage

Once configured, your AI agent can call:

```
get_recent_context(project_path: "/Users/you/my-project", limit: 5)
```

Or just ask it naturally:

> "Check my recent history for this project before we start."

The agent will call `get_recent_context` with the current working directory and receive the last N conversation turns across all supported tools.

## Tool Reference

### `get_recent_context`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `project_path` | string | yes | Absolute path to the project directory |
| `limit` | number | no | Max sessions to return (default: 5, max: 50) |

**Returns:** Formatted text listing recent sessions, newest first:

```
[1] Claude Code — 2026-04-06T14:30:00Z — /Users/you/my-project
User: How do I refactor the database layer?
Assistant: Here's an approach using the repository pattern…

[2] Cursor — 2026-04-05T09:15:00Z — /Users/you/my-project
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
    ├── cursor.ts     — Cursor / Copilot SQLite parser
    └── codex.ts      — OpenAI Codex CLI JSON parser
```

## Development

```bash
npm install
npm run build   # compile TypeScript
npm test        # run tests
npm run lint    # type-check only
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE).
