# resume-cli

Interactive TUI session picker for AI coding tools. Lists your recent sessions from Claude Code, Codex, and Copilot in one place — pick one and continue it in any tool.

![demo](assets/demo.gif)

## Quick Start

```bash
npx github:inevolin/resume-cli
```

No install required. Requires Node.js 18+.

**Optional shell alias** (use any name you like):

```bash
echo "alias resume='npx github:inevolin/resume-cli'" >> ~/.zshrc
source ~/.zshrc
```

## Usage

```
resume
```

- **↑ / ↓** — navigate sessions
- **Tab** — cycle target tool (Claude Code → Codex → Copilot)
- **Enter** — launch selected session in the chosen tool
- **q** — quit

Only tools that are installed on your machine appear in the tool cycle list.

## Local development

To run from a local clone (e.g. to test a branch before merging):

```bash
git clone https://github.com/inevolin/resume-cli
cd resume-cli
npm install
npm run build
node dist/cli.js
```

Or link it globally so you can type `resume` anywhere:

```bash
npm link            # run once inside the repo
resume              # works in any directory
npm unlink -g resume-cli  # remove when done
```

## Slash command (Claude Code / Codex / Copilot)

Install the `/resume` slash command so you can trigger the session picker from within any AI tool:

```bash
npx skills add inevolin/resume-cli
```

Then use `/resume` in Claude Code, Codex, or Copilot to open the picker.

## How it works

Sessions are read from each tool's local storage directory:

| Tool | Session directory |
|------|------------------|
| Claude Code | `~/.claude/projects/` |
| Codex | `~/.codex/sessions/` |
| Copilot | `~/.copilot/session-state/` |

**Same-tool resume:** uses the tool's native `--resume <uuid>` flag — no data is copied.

**Cross-tool resume:** writes the source session's messages into the target tool's session format under a new UUID, then resumes with that UUID. The imported session appears in the target tool's own history.

## Requirements

- Node.js 18+
- macOS or Linux

## License

MIT
