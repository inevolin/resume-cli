#!/usr/bin/env node
/**
 * histd — a lightweight background daemon that monitors AI coding-agent
 * session directories (Claude Code, Cursor, Windsurf) and syncs the
 * conversation history to ~/.histd/sessions/ as standard Markdown files.
 *
 * Usage:
 *   histd [--config <path>]
 */
import * as fs from 'fs';
import * as path from 'path';
import { defaultConfigDir, load } from './config';
import { run } from './watcher';

function parseArgs(): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--config' || args[i] === '-config') && args[i + 1]) {
      return args[i + 1];
    }
  }
  return null;
}

async function main(): Promise<void> {
  let cfgPath = parseArgs();
  if (!cfgPath) {
    cfgPath = path.join(defaultConfigDir(), 'config.toml');
  }

  let cfg;
  try {
    cfg = load(cfgPath);
  } catch (err) {
    console.error(`histd: loading config: ${err}`);
    process.exit(1);
  }

  try {
    fs.mkdirSync(cfg.output_dir, { recursive: true });
  } catch (err) {
    console.error(`histd: creating output directory ${cfg.output_dir}: ${err}`);
    process.exit(1);
  }

  console.log(`histd: output directory: ${cfg.output_dir}`);
  console.log(`histd: config: ${cfgPath}`);
  console.log('histd: starting file watcher …');

  try {
    await run(cfg);
  } catch (err) {
    console.error(`histd: watcher error: ${err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`histd: unexpected error: ${err}`);
  process.exit(1);
});
