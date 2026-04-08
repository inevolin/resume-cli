#!/usr/bin/env node
/**
 * Integration tests for resume-cli launcher.
 *
 * Spawns each AI tool for real (with stdio:pipe) and verifies the process
 * starts without errors. Kills it after a timeout.
 *
 * Run:  npm run test:integration
 *
 * Result codes:
 *   PASS — process spawned and was still running after the timeout (ideal)
 *   WARN — process spawned but exited before timeout (bad args, not a spawn failure)
 *   FAIL — spawn itself threw (ENOENT, EINVAL, etc.) — the tool is broken
 */

import { launch } from '../dist/launcher.js';
import { spawn, execSync } from 'child_process';
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
  s === 'WARN' ? `${C.yellow}${C.bold}WARN${C.reset}` :
                 `${C.red}${C.bold}FAIL${C.reset}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const isWin = process.platform === 'win32';

function findCommand(cmd) {
  try {
    const out = execSync(isWin ? `where ${cmd}` : `which ${cmd}`, { stdio: 'pipe' });
    return out.toString().trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

// ── Core test runner ──────────────────────────────────────────────────────────

const TIMEOUT_MS = 4000;

function testLaunch(session, targetTool) {
  return new Promise((resolve) => {
    let proc        = null;
    let spawnError  = null;
    let spawned     = false;
    let stdout      = '';
    let stderr      = '';
    let exitCode    = null;
    let exitSignal  = null;

    /** Drop-in replacement for childProcess.spawn that uses stdio:'pipe' */
    const testSpawnFn = (cmd, args, opts) => {
      try {
        proc = spawn(cmd, args, { ...opts, stdio: 'pipe' });
        spawned = true;
        proc.stdout?.on('data', (d) => { stdout += d.toString(); });
        proc.stderr?.on('data', (d) => { stderr += d.toString(); });
        proc.on('error',  (err)          => { spawnError = err; });
        proc.on('exit',   (code, signal) => { exitCode = code; exitSignal = signal; });
      } catch (err) {
        spawnError = err;
      }
      // launch() ignores the return value, but return something safe
      return proc ?? { on: () => {}, kill: () => {} };
    };

    try {
      launch(session, targetTool, testSpawnFn);
    } catch (err) {
      return resolve({
        status: 'FAIL',
        reason: `launch() threw: ${err.message}`,
        stdout, stderr,
      });
    }

    setTimeout(() => {
      try { proc?.kill(); } catch { /* already dead */ }

      if (spawnError) {
        resolve({
          status: 'FAIL',
          reason: `spawn error [${spawnError.code}]: ${spawnError.message}`,
          stdout, stderr,
        });
      } else if (!spawned) {
        resolve({
          status: 'FAIL',
          reason: 'launch() returned without spawning a process',
          stdout, stderr,
        });
      } else if (exitCode !== null) {
        // Process died before timeout — spawn worked, but tool rejected the args.
        // "not a terminal" means the tool needs a real TTY — spawn succeeded, classify as PASS.
        const needsTty = /not a terminal|not a tty|no tty/i.test(stdout + stderr);
        resolve({
          status: (exitCode === 0 || needsTty) ? 'PASS' : 'WARN',
          reason: needsTty
            ? `exited early — requires TTY (expected when piped; will work in real use)`
            : `exited early — code=${exitCode}${exitSignal ? ` signal=${exitSignal}` : ''}`,
          stdout, stderr,
        });
      } else {
        // Still running after timeout — perfect.
        resolve({ status: 'PASS', reason: 'running after timeout (killed)', stdout, stderr });
      }
    }, TIMEOUT_MS);
  });
}

// ── Pretty printer ────────────────────────────────────────────────────────────

let passed = 0, warned = 0, failed = 0;

async function run(description, session, targetTool) {
  process.stdout.write(`  ${C.dim}…${C.reset} ${description}\r`);
  const r = await testLaunch(session, targetTool);

  if (r.status === 'PASS') passed++;
  else if (r.status === 'WARN') warned++;
  else failed++;

  console.log(`  ${badge(r.status)}  ${description}`);

  if (r.reason)
    console.log(`         ${C.dim}→ ${r.reason}${C.reset}`);
  if (r.stdout.trim())
    console.log(`         ${C.dim}stdout: ${r.stdout.trim().slice(0, 300)}${C.reset}`);
  if (r.stderr.trim())
    console.log(`         ${C.dim}stderr: ${r.stderr.trim().slice(0, 300)}${C.reset}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}resume-cli integration tests${C.reset}  platform=${process.platform}\n`);

  // Temp file used as the "source session file" in cross-tool tests
  const tmpDir = mkdtempSync(join(tmpdir(), 'resume-cli-'));
  const sessionFile = join(tmpDir, 'session.jsonl');
  writeFileSync(sessionFile, JSON.stringify({ role: 'user', content: 'test' }) + '\n');

  // Use a well-formed UUID so tools that validate format (e.g. Copilot) don't
  // reject the argument before even attempting a lookup.
  const fakeSessionId = '00000000-0000-0000-0000-000000000001';

  const base = {
    project:   process.cwd(),
    timestamp: new Date(),
    messages:  [{ role: 'user', content: 'hello' }],
  };

  // ── 1. Command detection ───────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}1. Command detection${C.reset}  (using ${isWin ? 'where' : 'which'})`);
  const cmds = { claude: 'Claude Code', codex: 'Codex', copilot: 'Copilot' };
  for (const [cmd, name] of Object.entries(cmds)) {
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
  await run('same-tool resume  → claude --resume <id>', {
    ...base, tool: 'Claude Code', sessionId: fakeSessionId, filePath: sessionFile,
  }, 'Claude Code');
  await run('cross-tool launch → claude "<prompt with spaces and path>"', {
    ...base, tool: 'Codex', sessionId: undefined, filePath: sessionFile,
  }, 'Claude Code');
  console.log();

  // ── 3. Codex ──────────────────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}3. Codex${C.reset}`);
  await run('same-tool resume  → codex resume <id>', {
    ...base, tool: 'Codex', sessionId: fakeSessionId, filePath: sessionFile,
  }, 'Codex');
  await run('cross-tool launch → codex "<prompt with spaces and path>"', {
    ...base, tool: 'Claude Code', sessionId: undefined, filePath: sessionFile,
  }, 'Codex');
  console.log();

  // ── 4. Copilot ────────────────────────────────────────────────────────────
  console.log(`${C.cyan}${C.bold}4. Copilot${C.reset}`);
  await run('same-tool resume  → copilot --resume=<id>', {
    ...base, tool: 'Copilot', sessionId: fakeSessionId, filePath: sessionFile,
  }, 'Copilot');
  await run('cross-tool launch → copilot -i "<prompt with spaces and path>"', {
    ...base, tool: 'Claude Code', sessionId: undefined, filePath: sessionFile,
  }, 'Copilot');
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(
    `${C.bold}Results:${C.reset}  ` +
    `${C.green}${passed} passed${C.reset}  ` +
    `${C.yellow}${warned} warned${C.reset}  ` +
    `${C.red}${failed} failed${C.reset}\n`
  );
  console.log(`${C.dim}WARN = process spawned but exited before timeout (bad args, not a spawn error)${C.reset}\n`);

  try { rmSync(tmpDir, { recursive: true }); } catch { /* cleanup best-effort */ }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.stack ?? err}`);
  process.exit(1);
});
