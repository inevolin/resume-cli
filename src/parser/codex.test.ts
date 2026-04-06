import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodexParser } from './codex';

const parser = new CodexParser();
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-codex-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function sessionDir(): string {
  const dir = path.join(tmpDir, '.codex', 'sessions', '2026', '04', '06');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeFile(records: object[]): string {
  const dir = sessionDir();
  const file = path.join(dir, 'rollout-2026-04-06T00-00-00-abc.jsonl');
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n'));
  return file;
}

const SESSION_META = {
  type: 'session_meta',
  payload: {
    id: 'abc',
    timestamp: '2026-04-06T10:00:00.000Z',
    cwd: '/Users/user/myproject',
  },
};

describe('CodexParser.canHandle', () => {
  it('accepts .jsonl files under .codex/sessions', () => {
    expect(parser.canHandle('/home/user/.codex/sessions/2026/04/06/rollout-abc.jsonl')).toBe(true);
  });

  it('rejects .json files', () => {
    expect(parser.canHandle('/home/user/.codex/sessions/2026/04/06/session.json')).toBe(false);
  });

  it('rejects .jsonl files not under .codex/sessions', () => {
    expect(parser.canHandle('/home/user/.codex/history/abc.jsonl')).toBe(false);
  });

  it('rejects .jsonl files in a directory that contains .codex as a substring', () => {
    expect(parser.canHandle('/home/user/.codex_backup/sessions/abc.jsonl')).toBe(false);
  });
});

describe('CodexParser.parse', () => {
  it('parses user and assistant response_item records', async () => {
    const file = makeFile([
      SESSION_META,
      { type: 'response_item', payload: { role: 'user', content: [{ type: 'input_text', text: 'hello' }] } },
      { type: 'response_item', payload: { role: 'assistant', content: [{ type: 'output_text', text: 'world' }] } },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tool).toBe('Codex');
    expect(sessions[0].messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]);
  });

  it('extracts timestamp from session_meta payload', async () => {
    const file = makeFile([
      SESSION_META,
      { type: 'response_item', payload: { role: 'user', content: 'hi' } },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].timestamp).toEqual(new Date('2026-04-06T10:00:00.000Z'));
  });

  it('extracts project cwd from session_meta', async () => {
    const file = makeFile([
      SESSION_META,
      { type: 'response_item', payload: { role: 'user', content: 'hi' } },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].project).toBe('/Users/user/myproject');
  });

  it('handles plain string content', async () => {
    const file = makeFile([
      SESSION_META,
      { type: 'response_item', payload: { role: 'user', content: 'hello' } },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages[0].content).toBe('hello');
  });

  it('skips non-response_item records for messages', async () => {
    const file = makeFile([
      SESSION_META,
      { type: 'event_msg', payload: { role: 'user', content: 'ignored' } },
      { type: 'response_item', payload: { role: 'user', content: 'kept' } },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(1);
    expect(sessions[0].messages[0].content).toBe('kept');
  });

  it('skips developer role messages', async () => {
    const file = makeFile([
      SESSION_META,
      { type: 'response_item', payload: { role: 'developer', content: 'system prompt' } },
      { type: 'response_item', payload: { role: 'user', content: 'real message' } },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(1);
    expect(sessions[0].messages[0].role).toBe('user');
  });

  it('returns empty array when no user/assistant messages present', async () => {
    const file = makeFile([SESSION_META]);
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(0);
  });

  it('returns empty array for malformed JSON', async () => {
    const dir = sessionDir();
    const file = path.join(dir, 'rollout-bad.jsonl');
    fs.writeFileSync(file, 'not valid json {{');
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(0);
  });

  it('falls back to file mtime when no session_meta timestamp', async () => {
    const file = makeFile([
      { type: 'response_item', payload: { role: 'user', content: 'hi' } },
    ]);
    const sessions = await parser.parse(file);
    const mtime = fs.statSync(file).mtime;
    expect(sessions[0].timestamp).toEqual(mtime);
  });
});
