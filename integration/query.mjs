#!/usr/bin/env node
/**
 * Calls histd's get_recent_context tool via MCP stdio and prints the result.
 * Usage: node integration/query.mjs <project_path> [limit]
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTD = join(__dirname, '..', 'dist', 'index.js');

const projectPath = process.argv[2];
const limit = parseInt(process.argv[3] ?? '10', 10);

if (!projectPath) {
  process.stderr.write('Usage: query.mjs <project_path> [limit]\n');
  process.exit(1);
}

const proc = spawn('node', [HISTD], { stdio: ['pipe', 'pipe', 'inherit'] });
const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
let answered = false;

rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  // Step 2: initialize response → send notifications/initialized + tools/call
  if (msg.id === 1 && msg.result) {
    send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    send({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'get_recent_context', arguments: { project_path: projectPath, limit } },
    });
    return;
  }

  // Step 3: tool result
  if (msg.id === 2) {
    answered = true;
    if (msg.result?.content) {
      for (const c of msg.result.content) {
        if (c.text) process.stdout.write(c.text + '\n');
      }
    } else if (msg.error) {
      process.stderr.write(`MCP error: ${JSON.stringify(msg.error)}\n`);
      proc.kill();
      process.exit(1);
    }
    proc.stdin.end();
  }
});

proc.on('close', () => {
  if (!answered) {
    process.stderr.write('histd exited without answering the tool call\n');
    process.exit(1);
  }
  process.exit(0);
});

function send(obj) {
  proc.stdin.write(JSON.stringify(obj) + '\n');
}

// Step 1: initialize
send({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'integration-test', version: '1.0' },
  },
});
