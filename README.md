# resume-cli

Interactive TUI for picking up where you left off across AI coding tools. Lists your recent sessions from Claude Code, Codex, and Copilot in one place — select one, choose a tool, and continue.

```
▶ Claude Code    Apr 07 14:32  2h ago    refactor the auth middleware
  Copilot        Apr 07 11:05  5h ago    add pagination to the API
  Codex          Apr 06 09:14  1d ago    fix the flaky test in parser

Continue in: ◀ Claude Code ▶   ↑↓ navigate · tab: switch tool · ↵ launch · q quit
```

## Quick start

```bash
npx ai-resume-cli
```

No install required. Requires Node.js 18+.

**Optional global install:**

```bash
npm install -g ai-resume-cli
```

**Optional shell alias:**

```bash
echo "alias resume='npx ai-resume-cli'" >> ~/.zshrc && source ~/.zshrc
resume
```

## Controls

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate sessions |
| Tab | Cycle target tool |
| Enter | Launch selected session |
| q / Esc | Quit |

Only tools installed on your machine appear in the tool cycle.

## How it works

Sessions are read directly from each tool's local storage:

| Tool | Session directory |
|------|------------------|
| Claude Code | `~/.claude/projects/` |
| Codex | `~/.codex/sessions/` |
| Copilot | `~/.copilot/session-state/` |

**Same-tool resume** uses the tool's native `--resume <uuid>` flag — no data is copied or converted.

**Cross-tool resume** starts the target tool with an initial message pointing to the original session file. The AI reads it and continues from where you left off, with full conversation history as context.

## Requirements

- Node.js 18+
- macOS or Linux
- At least one of: [Claude Code](https://claude.ai/code), [Codex](https://github.com/openai/codex), [Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli)

## Local development

```bash
git clone https://github.com/inevolin/resume-cli
cd resume-cli
npm install
npm run build
node dist/cli.js
```

To use it globally from the local clone:

```bash
npm link
resume        # works in any directory
npm unlink -g ai-resume-cli  # remove when done
```

Run tests:

```bash
npm test
```

## Contributing

Bug reports and pull requests welcome at [inevolin/resume-cli](https://github.com/inevolin/resume-cli).

## License

MIT
