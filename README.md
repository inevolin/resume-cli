<p align="center">
  <h1 align="center">histd</h1>
  <p align="center">
    A lightweight daemon that syncs your AI coding sessions into searchable Markdown files.<br/>
    Switch between Claude Code, Cursor, and Copilot without losing context.
  </p>
</p>

<p align="center">
  <a href="https://github.com/inevolin/histd/actions/workflows/ci.yml"><img src="https://github.com/inevolin/histd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/histd"><img src="https://img.shields.io/npm/v/histd.svg" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

## Why histd?

Hit your Claude usage limits? Need to switch to Cursor or Copilot mid-session?

AI coding tools store conversation history in proprietary, tool-specific formats — JSONL, SQLite, JSON blobs — scattered across your home directory. When you switch tools, your context is lost.

**histd** runs in the background and continuously converts these proprietary histories into clean, organised Markdown files. Your conversations become portable, searchable, and version-controllable — letting you (or your next AI agent) pick up exactly where you left off.

## Features

- **Multi-tool support** — Claude Code, Cursor, and Windsurf out of the box
- **Real-time sync** — file-system watcher detects changes instantly
- **Clean Markdown output** — YAML frontmatter + readable conversation turns
- **Organised by date** — `YYYY-MM/YYYY-MM-DD_tool_project.md` layout
- **Idempotent** — re-runs are safe; files are overwritten, never duplicated
- **Zero-config start** — sensible defaults; just run `histd`
- **Lightweight** — minimal dependencies, runs anywhere Node.js runs

## Quick Start

### Install globally

```bash
npm install -g histd
```

### Or run without installing

```bash
npx histd
```

### Build from repository

```bash
git clone https://github.com/inevolin/histd.git
cd histd
npm install
npm run build
node dist/index.js
```

### Run

```bash
# Start with default config (~/.histd/config.toml, auto-created on first run)
histd

# Or specify a custom config path
histd --config /path/to/config.toml
```

histd will watch the default AI tool directories and write Markdown files to `~/.histd/sessions/`.

## Configuration

On first run, histd creates `~/.histd/config.toml` with sensible defaults:

```toml
output_dir = "/home/you/.histd/sessions"

[[watch]]
path = "/home/you/.claude/projects"
tool = "claude-code"

[[watch]]
path = "/home/you/.config/Cursor/User/workspaceStorage"
tool = "cursor"
```

| Key | Description |
|-----|-------------|
| `output_dir` | Directory where Markdown session files are written |
| `[[watch]].path` | Directory to monitor for AI tool history files |
| `[[watch]].tool` | Tool identifier (`claude-code`, `cursor`, etc.) |

You can add additional `[[watch]]` entries for other tools or custom paths.

## Output Format

Sessions are written as Markdown with YAML frontmatter:

```
~/.histd/sessions/
└── 2026-04/
    ├── 2026-04-05_claude-code_my-project.md
    └── 2026-04-06_cursor_my-project.md
```

Each file looks like:

```markdown
---
tool: "Claude Code"
project: "/home/you/projects/my-project"
timestamp: "2026-04-05T14:30:00Z"
---

## User

How do I refactor the database layer?

## Assistant

Here's an approach using the repository pattern…
```

## Architecture

```
histd/
├── src/
│   ├── index.ts                   # Entry point, flag parsing, daemon start
│   ├── config.ts                  # TOML config loading with auto-creation
│   ├── parser/
│   │   ├── types.ts               # HistoryParser interface + shared types
│   │   ├── claude.ts              # Claude Code JSONL parser
│   │   └── cursor.ts              # Cursor/Windsurf SQLite + JSON parser
│   ├── generator.ts               # Markdown renderer with YAML frontmatter
│   └── watcher.ts                 # chokidar watcher with debouncing
├── package.json
└── tsconfig.json
```

**Pipeline:** File change detected → Parser extracts sessions → Generator writes Markdown

## Supported Tools

| Tool | Format | Default Path |
|------|--------|--------------|
| Claude Code | JSONL | `~/.claude/projects/` |
| Cursor | SQLite (`.vscdb`) + JSON | `~/.config/Cursor/User/workspaceStorage/` |
| Windsurf | SQLite (`.vscdb`) + JSON | Shared with Cursor parser |

## Development

### Prerequisites

- Node.js 18 or later

### Build & Test

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type-check (lint)
npm run lint
```

### Project Structure

| Module | Responsibility |
|--------|---------------|
| `src/index.ts` | CLI entry point and daemon orchestration |
| `src/config.ts` | Configuration loading, defaults, and persistence |
| `src/parser/` | Tool-specific history file parsing |
| `src/generator.ts` | Markdown file generation |
| `src/watcher.ts` | File-system monitoring and event debouncing |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
