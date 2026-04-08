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

  let launched = false;

  const { waitUntilExit } = render(
    React.createElement(App, {
      sessions,
      installedTools,
      onLaunch: (session: Session, tool: string) => {
        launched = true;
        process.stderr.write(`resume-cli: launching ${tool}\n`);
        launch(session, tool);
      },
    })
  );

  await waitUntilExit();

  if (!launched) {
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`resume-cli: fatal: ${err}\n`);
  process.exit(1);
});
