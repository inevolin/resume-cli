---
name: histd
description: Interactive session picker — shows recent AI coding sessions for this project across all tools (Claude Code, Codex, Copilot, Cursor) and lets the user select one to continue from.
---

# histd — session picker

**Announce at start:** "I'm using histd to fetch your recent session history."

## Step 1 — Fetch sessions

Call the `get_recent_context` MCP tool:
- **Claude Code:** server is `histd-local` → call `histd-local: get_recent_context`
- **Codex / Copilot:** server is `histd` → call `histd: get_recent_context`
- Pass `project_path` = current working directory
- Pass `limit` = 10

Save the full raw output — you will need it in Step 3.

## Step 2 — Present the picker

If no sessions were found:
```
No session history found for this project.
Make sure histd is configured as an MCP server in your tool's config.
```
Stop.

Otherwise, display a numbered list. For each session show one line:

```
[N] <Tool> — <date> — <one-sentence summary of what was worked on>
```

Then ask:

```
Which session would you like to continue with? (enter a number, or 0 to skip)
```

Wait for the user's response before proceeding.

## Step 3 — Load the selected session

**If the user enters 0 or skips:** stop, no further action.

**Otherwise:** from the raw output saved in Step 1, extract the full content of the chosen session (all User/Assistant turns) and display it in full so the context is visible.

Then say:

```
Ready. Continuing from the [Tool] session on [date].
```

## Guidelines

- Keep the summaries in Step 2 tight — one sentence, focus on *what* was being worked on, not tool names or timestamps (those are already shown).
- Do not truncate or paraphrase the session content in Step 3 — show it verbatim so nothing is lost.
- If the user picks a number out of range, ask again.
