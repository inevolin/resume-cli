import * as os from 'os';
import * as path from 'path';
import { HistoryParser } from './parser/types.js';
import { ClaudeParser } from './parser/claude.js';
import { CursorParser } from './parser/cursor.js';
import { CodexParser } from './parser/codex.js';
import { CopilotParser } from './parser/copilot.js';

export interface DiscoveryEntry {
  /** Internal kebab-case identifier (e.g. 'claude-code'). Distinct from Session.tool, which is the human-readable display name set by each parser (e.g. 'Claude Code'). */
  tool: string;
  /** Directories to scan; non-existent paths are silently skipped by the caller. */
  paths: string[];
  parser: HistoryParser;
}

/**
 * Returns one DiscoveryEntry per supported AI tool.
 * Paths that do not exist on the current machine are silently skipped by
 * the caller (src/index.ts); this function only computes the expected paths.
 */
export function getEntries(): DiscoveryEntry[] {
  const home = os.homedir();
  const mac = process.platform === 'darwin';

  // Windows is not currently in scope; Windows paths (%APPDATA%\...) would need a third branch.
  const appSupport = (app: string) =>
    mac
      ? path.join(home, 'Library', 'Application Support', app, 'User', 'workspaceStorage')
      : path.join(home, '.config', app, 'User', 'workspaceStorage');

  return [
    {
      tool: 'claude-code',
      paths: [path.join(home, '.claude', 'projects')],
      parser: new ClaudeParser(),
    },
    {
      tool: 'cursor',
      paths: [appSupport('Cursor')],
      parser: new CursorParser(),
    },
    {
      tool: 'copilot',
      paths: [path.join(home, '.copilot', 'session-state')],
      parser: new CopilotParser(),
    },
    {
      tool: 'codex',
      paths: [path.join(home, '.codex', 'sessions')],
      parser: new CodexParser(),
    },
  ];
}
