#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import * as childProcess from 'child_process';
import { collectAllSessions } from './sessions.js';
import { launch } from './launcher.js';
import type { Session } from './parser/types.js';
import { App } from './tui/App.js';

async function detectInstalledTools(): Promise<string[]> {
  const candidates: Array<{ name: string; check: () => boolean }> = [
    { name: 'Claude Code', check: () => commandExists('claude') },
    { name: 'Codex', check: () => commandExists('codex') },
    { name: 'Copilot', check: () => commandExists('copilot') },
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

  const { waitUntilExit } = render(
    React.createElement(App, {
      sessions,
      installedTools,
      onLaunch: (session: Session, tool: string) => {
        pendingLaunch = { session, tool };
      },
    })
  );

  await waitUntilExit();

  // Launch AFTER Ink has fully restored the terminal (raw mode off, cursor restored).
  // On Windows, spawning before Ink finishes cleanup causes the Console to become
  // unresponsive because two processes race over raw-mode ownership.
  if (pendingLaunch) {
    process.stderr.write(`resume-cli: launching ${pendingLaunch.tool}\n`);
    launch(pendingLaunch.session, pendingLaunch.tool);
  } else {
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`resume-cli: fatal: ${err}\n`);
  process.exit(1);
});
