<p align="center">
  <h1 align="center">histd</h1>
  <p align="center">
    A lightweight daemon that syncs your AI coding sessions into searchable Markdown files.<br/>
    Switch between Claude Code, Cursor, and Copilot without losing context.
  </p>
</p>

<p align="center">
  <a href="https://github.com/inevolin/histd/actions/workflows/ci.yml"><img src="https://github.com/inevolin/histd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://goreportcard.com/report/github.com/inevolin/histd"><img src="https://goreportcard.com/badge/github.com/inevolin/histd" alt="Go Report Card"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://pkg.go.dev/github.com/inevolin/histd"><img src="https://pkg.go.dev/badge/github.com/inevolin/histd.svg" alt="Go Reference"></a>
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
- **No cgo** — pure-Go SQLite driver; compiles anywhere Go compiles
- **Lightweight** — single binary, minimal dependencies

## Quick Start

### Install from source

```bash
go install github.com/inevolin/histd@latest
```

### Build from repository

```bash
git clone https://github.com/inevolin/histd.git
cd histd
go build -o histd .
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
histd
├── main.go                        # Entry point, flag parsing, daemon start
└── internal/
    ├── config/config.go           # TOML config loading with auto-creation
    ├── parser/
    │   ├── parser.go              # HistoryParser interface + shared types
    │   ├── claude.go              # Claude Code JSONL parser
    │   └── cursor.go             # Cursor/Windsurf SQLite + JSON parser
    ├── generator/generator.go     # Markdown renderer with YAML frontmatter
    └── watcher/watcher.go         # fsnotify watcher with debouncing
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

- Go 1.25 or later

### Build & Test

```bash
# Build
go build ./...

# Run tests (with race detector)
go test -v -race ./...

# Lint
go vet ./...

# Check formatting
gofmt -l .
```

### Project Structure

| Package | Responsibility |
|---------|---------------|
| `main` | CLI entry point and daemon orchestration |
| `internal/config` | Configuration loading, defaults, and persistence |
| `internal/parser` | Tool-specific history file parsing |
| `internal/generator` | Markdown file generation |
| `internal/watcher` | File-system monitoring and event debouncing |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
