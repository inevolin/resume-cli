import * as path from 'path';
import { Config } from './config.js';
import { write } from './generator.js';
import { HistoryParser } from './parser/types.js';
import { ClaudeParser } from './parser/claude.js';
import { CursorParser } from './parser/cursor.js';

const DEBOUNCE_MS = 2000;

/** Ordered list of registered HistoryParsers. */
const parsers: HistoryParser[] = [
  new ClaudeParser(),
  new CursorParser(),
];

/**
 * Placeholder: file-watching is replaced by the MCP server architecture.
 * This module will be deleted in a subsequent task.
 */
export function run(_cfg: Config): Promise<void> {
  return Promise.reject(new Error('watcher is no longer supported; use the MCP server'));
}

/** Runs the parser + generator pipeline for a changed file. */
async function handleChange(filePath: string, outputDir: string): Promise<void> {
  const p = selectParser(filePath);
  if (!p) return;

  try {
    const sessions = await p.parse(filePath);
    if (sessions.length === 0) return;
    write(sessions, outputDir);
    console.log(`watcher: wrote ${sessions.length} session(s) from ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`watcher: error processing ${filePath}: ${err}`);
  }
}

/** Returns the first registered parser that can handle filePath. */
function selectParser(filePath: string): HistoryParser | null {
  for (const p of parsers) {
    if (p.canHandle(filePath)) return p;
  }
  return null;
}

/**
 * Coalesces rapid events for the same path into a single action that fires
 * DEBOUNCE_MS after the last event. A version counter ensures that stale
 * callbacks are discarded.
 */
class Debouncer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private versions = new Map<string, number>();

  trigger(key: string, fn: () => void): void {
    const existing = this.timers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const v = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, v);

    const timer = setTimeout(() => {
      if (this.versions.get(key) !== v) {
        // A newer trigger replaced us; skip this invocation.
        return;
      }
      this.timers.delete(key);
      this.versions.delete(key);
      fn();
    }, DEBOUNCE_MS);

    this.timers.set(key, timer);
  }
}
