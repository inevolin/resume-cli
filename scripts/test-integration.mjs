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

  // Normalise path for embedding in shell strings (Windows backslashes → forward slashes).
  const sessionFileShell = sessionFile.replace(/\\/g, '/');

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

  check('cross-tool launch → claude "<prompt with path>"', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Codex', sessionId: undefined, filePath: sessionFile },
      'Claude Code',
    );
    assert(cmd.startsWith('claude "'), `expected claude "..., got: ${cmd}`);
    assert(cmd.includes(sessionFileShell), `path missing in: ${cmd}`);
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

  check('cross-tool launch → codex "<prompt with path>"', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Claude Code', sessionId: undefined, filePath: sessionFile },
      'Codex',
    );
    assert(cmd.startsWith('codex "'), `expected codex "..., got: ${cmd}`);
    assert(cmd.includes(sessionFileShell), `path missing in: ${cmd}`);
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

  check('cross-tool launch → copilot -i "<prompt with path>"', () => {
    const cmd = buildCommand(
      { ...base, tool: 'Claude Code', sessionId: undefined, filePath: sessionFile },
      'Copilot',
    );
    assert(cmd.startsWith('copilot -i "'), `expected copilot -i "..., got: ${cmd}`);
    assert(cmd.includes(sessionFileShell), `path missing in: ${cmd}`);
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
