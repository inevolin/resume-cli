# Shell-Function Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace subprocess-spawning with stdout command output so a shell function wrapper can `eval` the result cleanly, eliminating cross-platform terminal ownership issues on Windows, macOS, and Linux.

**Architecture:** The CLI renders its TUI to `process.stderr` (always the terminal) and prints the resolved shell command to `process.stdout` on selection. Shell function wrappers for bash/zsh/fish/PowerShell capture stdout and `eval`/`Invoke-Expression` it. Exit code 0 = command printed; exit code 1 = user cancelled.

**Tech Stack:** TypeScript, Ink 6 (`render` options), Node.js 18+. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/launcher.ts` | Replace `launch()` + `spawnWindows()` with `buildCommand()` + `shellEscape()`. Remove all `child_process` usage. |
| `src/launcher.test.ts` | Replace spawn-mock tests with pure string-output tests against `buildCommand()`. |
| `src/cli.ts` | Pass `{ stdout: process.stderr }` to `render`; import `buildCommand` instead of `launch`; print command to stdout; exit 0/1. |
| `scripts/test-integration.mjs` | Rewrite to call `buildCommand()` and verify the returned string; no spawning needed. |
| `README.md` | Replace `alias` with shell functions for bash/zsh/fish/PowerShell; add Windows to Requirements. |

---

## Task 1: Rewrite `launcher.ts` — `buildCommand()` replaces `launch()`

**Files:**
- Modify: `src/launcher.ts`
- Modify: `src/launcher.test.ts`

- [ ] **Step 1.1: Write failing tests for `buildCommand()`**

Replace the contents of `src/launcher.test.ts` with:

```typescript
import { describe, it, expect } from '@jest/globals';
import { buildCommand } from './launcher.js';
import type { Session } from './parser/types.js';

const copilotSession: Session = {
  tool: 'Copilot',
  project: '/Users/ilya/project',
  timestamp: new Date('2026-04-06T10:00:00Z'),
  messages: [
    { role: 'user', content: 'Hello from Copilot' },
    { role: 'assistant', content: 'Response from Copilot' },
  ],
  sessionId: 'copilot-uuid',
  filePath: '/Users/ilya/.copilot/session-state/copilot-uuid/events.jsonl',
};

const claudeSession: Session = {
  tool: 'Claude Code',
  project: '/Users/ilya/project',
  timestamp: new Date('2026-04-06T10:00:00Z'),
  messages: [
    { role: 'user', content: 'Hello from Claude' },
    { role: 'assistant', content: 'Response from Claude' },
  ],
  sessionId: 'claude-uuid',
  filePath: '/Users/ilya/.claude/projects/-Users-ilya-project/claude-uuid.jsonl',
};

describe('buildCommand — same-tool resume', () => {
  it('returns claude --resume command', () => {
    expect(buildCommand(claudeSession, 'Claude Code')).toBe('claude --resume claude-uuid');
  });

  it('returns codex resume command', () => {
    const codexSession: Session = { ...claudeSession, tool: 'Codex', sessionId: 'codex-uuid' };
    expect(buildCommand(codexSession, 'Codex')).toBe('codex resume codex-uuid');
  });

  it('returns copilot --resume= command', () => {
    expect(buildCommand(copilotSession, 'Copilot')).toBe('copilot --resume=copilot-uuid');
  });
});

describe('buildCommand — cross-tool (fresh start)', () => {
  it('starts Claude Code with the source file path quoted in prompt', () => {
    const cmd = buildCommand(copilotSession, 'Claude Code');
    expect(cmd).toMatch(/^claude ".*copilot-uuid.*"$/s);
  });

  it('starts Codex with the source file path quoted in prompt', () => {
    const cmd = buildCommand(claudeSession, 'Codex');
    expect(cmd).toMatch(/^codex ".*claude-uuid.*"$/s);
  });

  it('starts Copilot with -i flag and quoted prompt', () => {
    const cmd = buildCommand(claudeSession, 'Copilot');
    expect(cmd).toMatch(/^copilot -i ".*claude-uuid.*"$/s);
  });
});

describe('buildCommand — same-tool without sessionId', () => {
  it('falls back to fresh command when sessionId is missing', () => {
    const sessionWithoutId: Session = { ...copilotSession, sessionId: undefined };
    const cmd = buildCommand(sessionWithoutId, 'Copilot');
    expect(cmd).toMatch(/^copilot -i ".*"$/s);
  });
});

describe('shellEscape — via buildCommand output', () => {
  it('does not quote simple alphanumeric UUIDs', () => {
    expect(buildCommand(claudeSession, 'Claude Code')).toBe('claude --resume claude-uuid');
  });

  it('double-quotes strings with spaces', () => {
    const session: Session = {
      ...claudeSession,
      tool: 'Codex',
      sessionId: undefined,
      filePath: '/path with spaces/file.jsonl',
    };
    const cmd = buildCommand(session, 'Codex');
    expect(cmd).toContain('"');
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=launcher 2>&1
```

Expected: FAIL — `buildCommand is not a function` or similar import error.

- [ ] **Step 1.3: Rewrite `src/launcher.ts`**

Replace the entire file:

```typescript
import type { Session } from './parser/types.js';

/**
 * Builds the shell command string to launch the given tool for a session.
 * The caller (shell function wrapper) should eval/Invoke-Expression this string.
 *
 * Exit contract for the CLI:
 *   stdout: the raw command (one line, no trailing text)
 *   stderr: TUI output + any hints
 */
export function buildCommand(session: Session, targetTool: string): string {
  const isSameTool = normalizeTool(session.tool) === normalizeTool(targetTool);

  if (isSameTool && session.sessionId) {
    const [cmd, args] = buildResumeArgs(targetTool, session.sessionId);
    // UUIDs and flags are always shell-safe — no quoting needed.
    return [cmd, ...args].join(' ');
  }

  // Cross-tool or same-tool without sessionId: fresh start with context prompt.
  const sourceFile = session.filePath ?? 'unknown';
  const prompt =
    `Continue the conversation from the session history stored in this file: ${sourceFile}\n\n` +
    `Read that file to understand our previous conversation, then let me know you're ready to continue.`;
  const [cmd, args] = buildFreshArgs(targetTool, prompt);
  return [cmd, ...args.map(shellEscape)].join(' ');
}

/**
 * Escapes a string for safe inclusion in a shell command line.
 * Uses double-quote style which is valid in bash, zsh, fish, and PowerShell
 * Invoke-Expression.
 */
function shellEscape(s: string): string {
  // Short-circuit: tokens that need no quoting in any shell.
  if (/^[\w./:@=+\-]+$/.test(s)) return s;
  // Normalise newlines to spaces, then wrap in double quotes.
  const safe = s.replace(/\r?\n/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${safe}"`;
}

function normalizeTool(tool: string): string {
  return tool.toLowerCase().replace(/\s+/g, '');
}

function buildResumeArgs(targetTool: string, sessionId: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude', ['--resume', sessionId]];
  if (norm === 'codex')      return ['codex',  ['resume',   sessionId]];
  if (norm === 'copilot')    return ['copilot', [`--resume=${sessionId}`]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}

function buildFreshArgs(targetTool: string, prompt: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude',  [prompt]];
  if (norm === 'codex')      return ['codex',   [prompt]];
  if (norm === 'copilot')    return ['copilot', ['-i', prompt]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=launcher 2>&1
```

Expected: all launcher tests PASS.

- [ ] **Step 1.5: Run full test suite**

```bash
npm test 2>&1
```

Expected: all tests pass (App, Footer, SessionList, discovery, sessions, parser tests unaffected).

- [ ] **Step 1.6: Commit**

```bash
git add src/launcher.ts src/launcher.test.ts
git commit -m "refactor(ISSUE-003): replace launch() with buildCommand() — no more subprocess spawning"
```

---

## Task 2: Update `cli.ts` — render to stderr, print command to stdout

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 2.1: Rewrite `src/cli.ts`**

Replace the entire file:

```typescript
#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import * as childProcess from 'child_process';
import { collectAllSessions } from './sessions.js';
import { buildCommand } from './launcher.js';
import type { Session } from './parser/types.js';
import { App } from './tui/App.js';

async function detectInstalledTools(): Promise<string[]> {
  const candidates: Array<{ name: string; check: () => boolean }> = [
    { name: 'Claude Code', check: () => commandExists('claude') },
    { name: 'Codex',       check: () => commandExists('codex') },
    { name: 'Copilot',     check: () => commandExists('copilot') },
  ];
  return candidates.filter((t) => t.check()).map((t) => t.name);
}

function commandExists(cmd: string): boolean {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    childProcess.execSync(check, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const [sessions, installedTools] = await Promise.all([
    collectAllSessions(50),
    detectInstalledTools(),
  ]);

  if (installedTools.length === 0) {
    process.stderr.write('resume-cli: no supported AI tools detected (claude, codex, copilot)\n');
    process.exit(1);
  }

  let pendingLaunch: { session: Session; tool: string } | null = null as { session: Session; tool: string } | null;

  // Render TUI to stderr so stdout stays clean for command capture.
  // Shell function: cmd=$(npx ai-resume-cli@latest) — stderr visible, stdout captured.
  const { waitUntilExit } = render(
    React.createElement(App, {
      sessions,
      installedTools,
      onLaunch: (session: Session, tool: string) => {
        pendingLaunch = { session, tool };
      },
    }),
    { stdout: process.stderr },
  );

  await waitUntilExit();

  if (!pendingLaunch) {
    // User quit without selecting.
    process.exit(1);
  }

  const cmd = buildCommand(pendingLaunch.session, pendingLaunch.tool);

  // When stdout is a TTY the user ran us directly (not via shell function).
  // Print the command so they can copy-paste it, and add a hint to stderr.
  if (process.stdout.isTTY) {
    process.stderr.write('\nTo run automatically, use the resume shell function:\n');
    process.stderr.write('https://github.com/inevolin/resume-cli#quick-start\n\n');
  }

  process.stdout.write(cmd + '\n');
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`resume-cli: fatal: ${err}\n`);
  process.exit(1);
});
```

- [ ] **Step 2.2: Build to verify no TypeScript errors**

```bash
npm run build 2>&1
```

Expected: exits 0, no errors.

- [ ] **Step 2.3: Run full test suite**

```bash
npm test 2>&1
```

Expected: all tests pass.

- [ ] **Step 2.4: Commit**

```bash
git add src/cli.ts
git commit -m "refactor(ISSUE-003): render TUI to stderr, print command to stdout"
```

---

## Task 3: Rewrite integration test — test `buildCommand()` string output

The old integration test called `launch()` with a spawn mock to verify processes started. Now `buildCommand()` is pure (no spawn), so we verify the returned string instead.

**Files:**
- Modify: `scripts/test-integration.mjs`

- [ ] **Step 3.1: Rewrite `scripts/test-integration.mjs`**

Replace the entire file:

```javascript
#!/usr/bin/env node
/**
 * Integration tests for resume-cli buildCommand().
 *
 * Verifies that the correct shell command strings are produced for each
 * tool/scenario. No processes are spawned.
 *
 * Run:  npm run test:integration
 */

import { buildCommand } from '../dist/launcher.js';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ── ANSI colours ──────────────────────────────────────────────────────────────

const C = {
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  reset:  '\x1b[0m',
};

const badge = (s) =>
  s === 'PASS' ? `${C.green}${C.bold}PASS${C.reset}` :
                 `${C.red}${C.bold}FAIL${C.reset}`;

const isWin = process.platform === 'win32';

function findCommand(cmd) {
  try {
    const out = execSync(isWin ? `where ${cmd}` : `which ${cmd}`, { stdio: 'pipe' });
    return out.toString().trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function check(description, fn) {
  try {
    fn();
    console.log(`  ${badge('PASS')}  ${description}`);
    passed++;
  } catch (err) {
    console.log(`  ${badge('FAIL')}  ${description}`);
    console.log(`         ${C.dim}→ ${err.message}${C.reset}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}resume-cli integration tests${C.reset}  platform=${process.platform}\n`);

  const tmpDir = mkdtempSync(join(tmpdir(), 'resume-cli-'));
  const sessionFile = join(tmpDir, 'session.jsonl');
  writeFileSync(sessionFile, JSON.stringify({ role: 'user', content: 'test' }) + '\n');

  const fakeSessionId = '00000000-0000-0000-0000-000000000001';
  const base = {
    project:   process.cwd(),
    timestamp: new Date(),
    messages:  [{ role: 'user', content: 'hello' }],
  };

  // ── 1. Command detection ───────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}1. Command detection${C.reset}  (using ${isWin ? 'where' : 'which'})`);
  for (const [cmd, name] of [['claude', 'Claude Code'], ['codex', 'Codex'], ['copilot', 'Copilot']]) {
    const found = findCommand(cmd);
    if (found) {
      console.log(`  ${badge('PASS')}  ${name} → ${C.dim}${found}${C.reset}`);
      passed++;
    } else {
      console.log(`  ${badge('FAIL')}  ${name} → not found in PATH`);
      failed++;
    }
  }
  console.log();

  // ── 2. Claude Code ────────────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}2. Claude Code${C.reset}`);

  check('same-tool resume → claude --resume <id>', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Claude Code', sessionId: fakeSessionId, filePath: sessionFile },
      'Claude Code',
    );
    assert(cmd === `claude --resume ${fakeSessionId}`, `got: ${cmd}`);
  });

  check('cross-tool launch → claude "<prompt>"', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Codex', sessionId: undefined, filePath: sessionFile },
      'Claude Code',
    );
    assert(cmd.startsWith('claude "'), `got: ${cmd}`);
    assert(cmd.includes(sessionFile.replace(/\\/g, '\\\\')), `path missing in: ${cmd}`);
  });
  console.log();

  // ── 3. Codex ──────────────────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}3. Codex${C.reset}`);

  check('same-tool resume → codex resume <id>', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Codex', sessionId: fakeSessionId, filePath: sessionFile },
      'Codex',
    );
    assert(cmd === `codex resume ${fakeSessionId}`, `got: ${cmd}`);
  });

  check('cross-tool launch → codex "<prompt>"', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Claude Code', sessionId: undefined, filePath: sessionFile },
      'Codex',
    );
    assert(cmd.startsWith('codex "'), `got: ${cmd}`);
    assert(cmd.includes(sessionFile.replace(/\\/g, '\\\\')), `path missing in: ${cmd}`);
  });
  console.log();

  // ── 4. Copilot ────────────────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}4. Copilot${C.reset}`);

  check('same-tool resume → copilot --resume=<id>', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Copilot', sessionId: fakeSessionId, filePath: sessionFile },
      'Copilot',
    );
    assert(cmd === `copilot --resume=${fakeSessionId}`, `got: ${cmd}`);
  });

  check('cross-tool launch → copilot -i "<prompt>"', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Claude Code', sessionId: undefined, filePath: sessionFile },
      'Copilot',
    );
    assert(cmd.startsWith('copilot -i "'), `got: ${cmd}`);
    assert(cmd.includes(sessionFile.replace(/\\/g, '\\\\')), `path missing in: ${cmd}`);
  });
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(
    `${C.bold}Results:${C.reset}  ` +
    `${C.green}${passed} passed${C.reset}  ` +
    `${C.red}${failed} failed${C.reset}\n`,
  );

  try { rmSync(tmpDir, { recursive: true }); } catch { /* cleanup best-effort */ }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.stack ?? err}`);
  process.exit(1);
});
```

- [ ] **Step 3.2: Run integration test to verify**

```bash
npm run test:integration 2>&1
```

Expected: command-string assertions pass; command-detection may FAIL if a tool isn't installed (that's fine — it's an environment check, not a code defect).

- [ ] **Step 3.3: Commit**

```bash
git add scripts/test-integration.mjs
git commit -m "test(ISSUE-003): rewrite integration test for buildCommand() string output"
```

---

## Task 4: Update README — shell functions for all platforms, Windows support

**Files:**
- Modify: `README.md`

- [ ] **Step 4.1: Replace README contents**

Replace the entire file:

````markdown
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

**PowerShell** — add to your `$PROFILE`:
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

If you want a specific version, replace `@latest` with e.g. `@1.0.3`.

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
````

- [ ] **Step 4.2: Commit**

```bash
git add README.md
git commit -m "docs(ISSUE-003): replace alias with shell functions for bash/zsh/fish/PowerShell; add Windows support"
```

---

## Task 5: Bump version and final verification

- [ ] **Step 5.1: Bump version in `package.json` to `1.1.0`**

In `package.json`, change:
```json
"version": "1.0.3",
```
to:
```json
"version": "1.1.0",
```

- [ ] **Step 5.2: Run full test suite**

```bash
npm test 2>&1
```

Expected: all tests pass.

- [ ] **Step 5.3: Run build**

```bash
npm run build 2>&1
```

Expected: exits 0.

- [ ] **Step 5.4: Run integration test**

```bash
npm run test:integration 2>&1
```

Expected: buildCommand assertions pass.

- [ ] **Step 5.5: Commit and push**

```bash
git add package.json
git commit -m "chore(ISSUE-003): bump version to 1.1.0 — shell-function redesign"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Shell function pattern (no spawning) — Tasks 1 + 2
- ✅ TUI renders to stderr — Task 2
- ✅ Command printed to stdout — Task 2
- ✅ Exit codes: 0 = selected, 1 = cancelled — Task 2
- ✅ bash/zsh/fish/PowerShell shell functions — Task 4
- ✅ Windows in Requirements — Task 4
- ✅ Tests updated — Tasks 1 + 3
- ✅ Version bump — Task 5

**Placeholder scan:** None found.

**Type consistency:** `buildCommand(session: Session, targetTool: string): string` defined in Task 1, imported in Task 2 and Task 3 — consistent throughout.
