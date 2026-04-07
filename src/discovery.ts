import * as os from 'os';
import * as path from 'path';
import { HistoryParser } from './parser/types.js';
import { ClaudeParser } from './parser/claude.js';
import { CodexParser } from './parser/codex.js';
import { CopilotParser } from './parser/copilot.js';

export interface DiscoveryEntry {
  tool: string;
  paths: string[];
  parser: HistoryParser;
}

export function getEntries(): DiscoveryEntry[] {
  const home = os.homedir();
  return [
    {
      tool: 'claude-code',
      paths: [path.join(home, '.claude', 'projects')],
      parser: new ClaudeParser(),
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
