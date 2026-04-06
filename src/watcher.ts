import * as path from 'path';
import chokidar from 'chokidar';
import { Config } from './config';
import { write } from './generator';
import { HistoryParser } from './parser/types';
import { ClaudeParser } from './parser/claude';
import { CursorParser } from './parser/cursor';

const DEBOUNCE_MS = 2000;

/** Ordered list of registered HistoryParsers. */
const parsers: HistoryParser[] = [
  new ClaudeParser(),
  new CursorParser(),
];

/**
 * Starts the file-watching loop. Returns a promise that rejects if the watcher
 * encounters a fatal error.
 */
export function run(cfg: Config): Promise<void> {
  return new Promise((_, reject) => {
    const paths = cfg.watch.map((e) => e.path);

    const watcher = chokidar.watch(paths, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
    });

    const debounce = new Debouncer();

    watcher.on('add', (filePath: string) => {
      debounce.trigger(filePath, () => handleChange(filePath, cfg.output_dir));
    });

    watcher.on('change', (filePath: string) => {
      debounce.trigger(filePath, () => handleChange(filePath, cfg.output_dir));
    });

    watcher.on('error', (err: unknown) => {
      reject(err);
    });

    for (const entry of cfg.watch) {
      console.log(`watcher: watching ${entry.path} (${entry.tool})`);
    }
  });
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
