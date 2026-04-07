---
name: resume
description: Interactive session picker — opens resume in the terminal to browse recent AI coding sessions across all tools and resume the selected one.
---

# resume — session picker

**Announce at start:** "I'm launching resume to show your recent session history."

Run the following shell command to open the interactive picker:

```bash
npx github:inevolin/resume-cli
```

This opens an interactive TUI in the terminal:
- **↑ / ↓** — navigate sessions
- **Tab** — cycle the target tool (Claude Code / Codex / Copilot)
- **Enter** — launch the selected session in the chosen tool
- **q** — quit without launching

The picker lists sessions from all detected tools across all projects. Selecting a session and pressing Enter will launch the target tool with the full session context loaded via native `--resume`.

No further action is needed — the tool handles everything.
