import * as fs from 'fs';
import * as path from 'path';
import { HistoryParser, Message, Session } from './types.js';

/**
 * One record in a Codex session JSONL file.
 * Codex stores sessions under ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 */
interface CodexRecord {
  timestamp?: string;
  type?: string;
  payload?: {
    id?: string;
    timestamp?: string;
    cwd?: string;
    role?: string;
    content?: unknown; // string or array of {type, text} blocks
  };
}

interface ContentBlock {
  type?: string;
  text?: string;
}

/**
 * Parses Codex CLI session files stored under
 * ~/.codex/sessions/<year>/<month>/<day>/rollout-*.jsonl
 */
export class CodexParser implements HistoryParser {
  canHandle(filePath: string): boolean {
    return (
      filePath.endsWith('.jsonl') &&
      filePath.includes(`${path.sep}.codex${path.sep}sessions${path.sep}`)
    );
  }

  async parse(filePath: string): Promise<Session[]> {
    const data = fs.readFileSync(filePath, 'utf8');
    const messages: Message[] = [];
    let sessionTime: Date | null = null;
    let projectCwd: string | null = null;

    for (const line of data.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let rec: CodexRecord;
      try {
        rec = JSON.parse(trimmed) as CodexRecord;
      } catch {
        continue;
      }

      // session_meta carries the canonical start time and working directory.
      if (rec.type === 'session_meta' && rec.payload) {
        if (!sessionTime) {
          const raw = rec.payload.timestamp ?? rec.timestamp;
          if (raw) {
            const t = new Date(raw);
            if (!isNaN(t.getTime())) sessionTime = t;
          }
        }
        if (!projectCwd && rec.payload.cwd) {
          projectCwd = rec.payload.cwd;
        }
      }

      if (rec.type !== 'response_item') continue;
      const payload = rec.payload;
      if (!payload) continue;

      const role = typeof payload.role === 'string' ? payload.role : '';
      if (role !== 'user' && role !== 'assistant') continue;

      const content = extractContent(payload.content);
      if (!content) continue;

      messages.push({ role, content });
    }

    if (messages.length === 0) return [];

    const timestamp = sessionTime ?? fileTimestamp(filePath);
    const project = projectCwd ?? path.dirname(filePath);

    return [{ tool: 'Codex', project, timestamp, messages }];
  }
}

function extractContent(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    return v
      .filter((b): b is ContentBlock =>
        b != null && typeof b === 'object' && typeof (b as ContentBlock).text === 'string'
      )
      .map((b) => b.text as string)
      .join('\n')
      .trim();
  }
  return '';
}

function fileTimestamp(filePath: string): Date {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return new Date();
  }
}
