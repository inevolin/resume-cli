import * as fs from 'fs';
import * as path from 'path';
import { HistoryParser, Message, Session } from './types.js';

/** One line in a Claude Code JSONL history file. */
interface ClaudeRecord {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown; // string or array of content blocks
  };
}

/** Structured content block Claude sometimes uses instead of plain string. */
interface ContentBlock {
  type?: string;
  text?: string;
}

/**
 * Parses Claude Code session files stored under
 * ~/.claude/projects/<project-hash>/<uuid>.jsonl
 */
export class ClaudeParser implements HistoryParser {
  /**
   * Returns true for any .jsonl file inside a directory that looks like
   * a Claude project storage path.
   */
  canHandle(filePath: string): boolean {
    return filePath.endsWith('.jsonl') && filePath.includes('.claude');
  }

  /**
   * Reads a single .jsonl history file produced by Claude Code and returns
   * a slice containing exactly one Session.
   */
  async parse(filePath: string): Promise<Session[]> {
    const data = fs.readFileSync(filePath, 'utf8');
    const messages: Message[] = [];
    let sessionTime: Date | null = null;

    const lines = data.split('\n');
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();
      if (!line) continue;

      let rec: ClaudeRecord;
      try {
        rec = JSON.parse(line) as ClaudeRecord;
      } catch {
        // Skip malformed lines rather than failing the whole file.
        continue;
      }

      // Use the first timestamp found in any record as the session time.
      if (!sessionTime && rec.timestamp) {
        const t = new Date(rec.timestamp);
        if (!isNaN(t.getTime())) {
          sessionTime = t;
        }
      }

      let role = rec.type ?? '';
      if (rec.message?.role) {
        role = rec.message.role;
      }
      if (role !== 'user' && role !== 'assistant') {
        continue;
      }

      const content = extractClaudeContent(rec.message?.content);
      if (!content) continue;

      messages.push({ role, content });
    }

    const timestamp = sessionTime ?? new Date();

    // Attempt to decode the Claude-encoded project path back to a real filesystem path.
    // Claude encodes project paths by replacing all non-alphanumeric chars with '-':
    //   Unix:    "/Users/ilya/my-project"      → "-Users-ilya-my-project"
    //   Windows: "C:\Users\ilya\my-project"    → "C--Users-ilya-my-project"
    // The encoding is lossy (hyphens in dir names are indistinguishable from separators),
    // so we verify each candidate segment against the real filesystem.
    const encodedName = path.basename(path.dirname(filePath));
    const project = decodeClaudePath(encodedName);
    const sessionId = path.basename(filePath, '.jsonl');

    return [{ tool: 'Claude Code', project, timestamp, messages, sessionId, filePath }];
  }
}

/**
 * Decodes a Claude-encoded project directory name back to a real filesystem path.
 *
 * Claude encodes paths by replacing every non-alphanumeric character with '-':
 *   Unix:    /Users/ilya/my-project  →  -Users-ilya-my-project
 *   Windows: C:\Users\ilya\my-proj   →  C--Users-ilya-my-proj
 *
 * Because hyphens in directory names are indistinguishable from separators we
 * verify candidates against the real filesystem, greedily taking the longest
 * segment that exists at each level.
 */
function decodeClaudePath(encoded: string): string {
  let root: string;
  let rest: string;

  const winMatch = encoded.match(/^([A-Za-z])--(.*)$/);
  if (winMatch) {
    // Windows path: "C--Users-foo-bar" → root "C:\", rest "Users-foo-bar"
    root = winMatch[1].toUpperCase() + ':\\';
    rest = winMatch[2];
  } else if (encoded.startsWith('-')) {
    // Unix path: "-Users-foo-bar" → root "/", rest "Users-foo-bar"
    root = '/';
    rest = encoded.slice(1);
  } else {
    return encoded; // unrecognised format — return as-is
  }

  const sep = winMatch ? '\\' : '/';
  const parts = rest.split('-');
  let current = root;
  let i = 0;

  while (i < parts.length) {
    // Try progressively shorter joins (longest match first) so "resume-cli"
    // is preferred over treating "-" as a separator.
    let matched = false;
    for (let j = parts.length; j > i; j--) {
      const segment = parts.slice(i, j).join('-');
      const candidate = current + segment;
      if (fs.existsSync(candidate)) {
        current = candidate + sep;
        i = j;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Filesystem lookup failed — append remaining parts separated by sep.
      current += parts.slice(i).join(sep);
      break;
    }
  }

  return current.replace(/[/\\]$/, ''); // strip trailing separator
}

/**
 * Normalises the polymorphic content field (string or array of content blocks)
 * to a plain string.
 */
function extractClaudeContent(v: unknown): string {
  if (typeof v === 'string') {
    return v.trim();
  }
  if (Array.isArray(v)) {
    const parts: string[] = [];
    for (const item of v) {
      if (item && typeof item === 'object') {
        const block = item as ContentBlock;
        if (typeof block.text === 'string') {
          parts.push(block.text);
        }
      }
    }
    return parts.join('\n').trim();
  }
  return '';
}
