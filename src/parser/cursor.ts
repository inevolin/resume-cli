import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { HistoryParser, Message, Session } from './types';

/** Shape of each tab entry stored in the Cursor DB. */
interface CursorTab {
  tabId?: string;
  chatTitle?: string;
  lastSendTime?: number;
  bubbles?: CursorBubble[];
}

interface CursorBubble {
  type?: string;   // "user" | "ai"
  text?: string;
  rawText?: string;
}

/**
 * Parses Cursor (and Windsurf) workspace storage.
 *
 * Cursor stores chat history in SQLite databases inside:
 *   ~/.config/Cursor/User/workspaceStorage/<hash>/state.vscdb
 *
 * The relevant rows in ItemTable have keys prefixed with
 * "interactive.sessions" or "workbench.panel.aichat".
 *
 * For workspaces that only leave JSON files (e.g. Windsurf), the parser also
 * reads any *.json file that contains a top-level "tabs" or "messages" array.
 */
export class CursorParser implements HistoryParser {
  canHandle(filePath: string): boolean {
    const base = path.basename(filePath);
    if (base === 'state.vscdb') return true;
    if (
      base.endsWith('.json') &&
      (filePath.includes('Cursor') || filePath.includes('Windsurf'))
    ) {
      return true;
    }
    return false;
  }

  async parse(filePath: string): Promise<Session[]> {
    if (filePath.endsWith('.vscdb')) {
      return parseCursorDB(filePath);
    }
    return parseCursorJSON(filePath);
  }
}

// ---- SQLite path -------------------------------------------------------

function parseCursorDB(filePath: string): Session[] {
  let db: Database.Database;
  try {
    db = new Database(filePath, { readonly: true });
  } catch {
    throw new Error(`cursor parser: opening ${filePath}`);
  }

  let rows: Array<{ value: string }>;
  try {
    rows = db
      .prepare(
        `SELECT value FROM ItemTable
         WHERE key LIKE 'interactive.sessions%'
            OR key LIKE 'workbench.panel.aichat%'
            OR key LIKE 'aiService.prompts%'`
      )
      .all() as Array<{ value: string }>;
  } catch {
    db.close();
    throw new Error(`cursor parser: querying ${filePath}`);
  }
  db.close();

  const sessions: Session[] = [];
  for (const row of rows) {
    try {
      const s = decodeCursorValue(row.value, filePath);
      sessions.push(...s);
    } catch {
      // Skip unrecognised shapes
    }
  }
  return sessions;
}

/** Tries several known JSON shapes from Cursor's DB. */
function decodeCursorValue(raw: string, dbPath: string): Session[] {
  // Shape 1: top-level array of tab objects.
  try {
    const tabs = JSON.parse(raw) as CursorTab[];
    if (Array.isArray(tabs) && tabs.length > 0) {
      return tabsToSessions(tabs, dbPath);
    }
  } catch {
    // fall through
  }

  // Shape 2: object with a "tabs" field.
  try {
    const wrapper = JSON.parse(raw) as { tabs?: CursorTab[] };
    if (wrapper.tabs && Array.isArray(wrapper.tabs) && wrapper.tabs.length > 0) {
      return tabsToSessions(wrapper.tabs, dbPath);
    }
  } catch {
    // fall through
  }

  throw new Error('unrecognised cursor value shape');
}

function tabsToSessions(tabs: CursorTab[], dbPath: string): Session[] {
  const project = path.dirname(path.dirname(dbPath));
  const sessions: Session[] = [];

  for (const tab of tabs) {
    const msgs: Message[] = [];
    for (const b of tab.bubbles ?? []) {
      let content = b.text ?? '';
      if (!content) content = b.rawText ?? '';
      content = content.trim();
      if (!content) continue;

      const role = b.type === 'ai' ? 'assistant' : 'user';
      msgs.push({ role, content });
    }
    if (msgs.length === 0) continue;

    let timestamp = new Date();
    if (tab.lastSendTime && tab.lastSendTime > 0) {
      // Cursor stores milliseconds since epoch.
      timestamp = new Date(tab.lastSendTime);
    }

    sessions.push({ tool: 'Cursor', project, timestamp, messages: msgs });
  }
  return sessions;
}

// ---- JSON path ---------------------------------------------------------

function parseCursorJSON(filePath: string): Session[] {
  const data = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error(`cursor parser: invalid JSON in ${filePath}`);
  }

  // Try decoding as an array of tab objects.
  if (Array.isArray(parsed) && parsed.length > 0) {
    const project = path.dirname(path.dirname(filePath));
    const fakePath = path.join(project, 'state.vscdb');
    return tabsToSessions(parsed as CursorTab[], fakePath);
  }

  // Try decoding as an object with a "messages" array (simpler shape).
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as { messages?: Array<{ role?: string; content?: string }> };
    if (obj.messages && Array.isArray(obj.messages) && obj.messages.length > 0) {
      const msgs: Message[] = [];
      for (const m of obj.messages) {
        if (!m.content) continue;
        msgs.push({ role: m.role ?? 'user', content: m.content });
      }
      const project = path.dirname(path.dirname(filePath));
      return [{ tool: 'Cursor', project, timestamp: new Date(), messages: msgs }];
    }
  }

  throw new Error(`cursor parser: unrecognised JSON shape in ${filePath}`);
}
