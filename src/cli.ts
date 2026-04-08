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

  // When stdout is captured by the shell function (pipe), chalk's color
  // detection sees a non-TTY stdout and strips colors. Force it on when
  // stderr (where we render) is a real terminal.
  if (process.stderr.isTTY && !process.env.FORCE_COLOR) {
    process.env.FORCE_COLOR = '1';
  }

  // Render TUI to stderr so stdout stays clean for command capture.
  // Shell function usage: cmd=$(npx ai-resume-cli@latest)
  //   stderr → /dev/tty (visible TUI), stdout → captured command string
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
    // User quit without selecting — shell function checks exit code and does nothing.
    process.exit(1);
  }

  const cmd = buildCommand(pendingLaunch.session, pendingLaunch.tool);

  // When stdout is a TTY the user ran us directly (not via shell function).
  // Print a hint so they know how to get seamless execution.
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
