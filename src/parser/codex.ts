import * as fs from 'fs';
import * as path from 'path';
import { HistoryParser, Message, Session } from './types.js';

interface RawMessage {
  role?: unknown;
  content?: unknown;
}

/**
 * Parses OpenAI Codex CLI session files stored under ~/.codex/history/.
 *
 * Supports two JSON shapes:
 *   1. Top-level array of {role, content} objects
 *   2. Wrapper object with a "messages" or "conversation" key
 *
 * Content may be a plain string or an array of {type, text} blocks.
 */
export class CodexParser implements HistoryParser {
  canHandle(filePath: string): boolean {
    return filePath.includes('.codex') && filePath.endsWith('.json');
  }

  async parse(filePath: string): Promise<Session[]> {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }

    const rawMessages = extractMessageArray(raw);
    const messages: Message[] = [];

    for (const item of rawMessages) {
      if (!item || typeof item !== 'object') continue;
      const m = item as RawMessage;
      const role = typeof m.role === 'string' ? m.role : '';
      if (role !== 'user' && role !== 'assistant') continue;
      const content = extractContent(m.content);
      if (!content) continue;
      messages.push({ role, content });
    }

    if (messages.length === 0) return [];

    const project = path.dirname(filePath);
    const timestamp = fileTimestamp(filePath);

    return [{ tool: 'Codex', project, timestamp, messages }];
  }
}

function extractMessageArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['messages', 'conversation', 'history']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

function extractContent(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    return v
      .filter((b): b is { type: string; text: string } =>
        b != null && typeof b === 'object' && typeof (b as Record<string, unknown>).text === 'string'
      )
      .map((b) => b.text)
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
