#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import * as childProcess from 'child_process';
import { collectAllSessions } from './sessions.js';
import { launch } from './launcher.js';
import { App } from './tui/App.js';
async function detectInstalledTools() {
    const candidates = [
        { name: 'Claude Code', check: () => commandExists('claude') },
        { name: 'Codex', check: () => commandExists('codex') },
        { name: 'Copilot', check: () => commandExists('gh') && copilotInstalled() },
    ];
    return candidates.filter((t) => t.check()).map((t) => t.name);
}
function commandExists(cmd) {
    try {
        childProcess.execSync(`which ${cmd}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function copilotInstalled() {
    try {
        childProcess.execSync('gh copilot --help', { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
async function main() {
    const [sessions, installedTools] = await Promise.all([
        collectAllSessions(50),
        detectInstalledTools(),
    ]);
    if (installedTools.length === 0) {
        process.stderr.write('histd: no supported AI tools detected (claude, codex, gh copilot)\n');
        process.exit(1);
    }
    let launched = false;
    const { waitUntilExit } = render(React.createElement(App, {
        sessions,
        installedTools,
        onLaunch: (session, tool) => {
            launched = true;
            launch(session, tool);
        },
    }));
    await waitUntilExit();
    if (!launched) {
        process.exit(0);
    }
}
main().catch((err) => {
    process.stderr.write(`histd: fatal: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map