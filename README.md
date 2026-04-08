# resume-cli

Interactive TUI for picking up where you left off across AI coding tools. Lists your recent sessions from Claude Code, Codex, and Copilot in one place — select one, choose a tool, and continue.

```
▶ Claude Code    Apr 07 14:32  2h ago    refactor the auth middleware
  Copilot        Apr 07 11:05  5h ago    add pagination to the API
  Codex          Apr 06 09:14  1d ago    fix the flaky test in parser

Continue in: ◀ Claude Code ▶   ↑↓ navigate · tab: switch tool · ↵ launch · q quit
```

## Quick start

Add the `resume` shell function to your shell profile — then just type `resume` from anywhere.

**bash** — add to `~/.bashrc`:
```bash
resume() {
  local cmd
  cmd=$(npx ai-resume-cli@latest 2>/dev/tty)
  [ $? -eq 0 ] && [ -n "$cmd" ] && eval "$cmd"
}
```

**zsh** — add to `~/.zshrc`:
```zsh
resume() {
  local cmd
  cmd=$(npx ai-resume-cli@latest 2>/dev/tty)
  [ $? -eq 0 ] && [ -n "$cmd" ] && eval "$cmd"
}
```

**fish** — add to `~/.config/fish/config.fish`:
```fish
function resume
    set cmd (npx ai-resume-cli@latest 2>/dev/tty)
    if test $status -eq 0; and test -n "$cmd"
        eval $cmd
    end
end
```

**PowerShell (Windows)** — add to your `$PROFILE`:
```powershell
function resume {
    $cmd = npx ai-resume-cli@latest
    if ($LASTEXITCODE -eq 0 -and $cmd) { Invoke-Expression $cmd }
}
```

Reload your shell (or open a new terminal), then:

```bash
resume
```

## How to update

The `@latest` tag in the function means npx always fetches the newest version. No action needed.

If you want a specific version, replace `@latest` with e.g. `@1.1.0`.

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

The CLI prints the resulting command to stdout and exits. The shell function captures it and runs it in your current shell — this is why terminal ownership is always clean, on every platform.

## Requirements

- Node.js 18+
- macOS, Linux, or Windows (PowerShell or Git Bash)
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
npm run test:integration
```

## Contributing

Bug reports and pull requests welcome at [inevolin/resume-cli](https://github.com/inevolin/resume-cli).

## License

MIT
