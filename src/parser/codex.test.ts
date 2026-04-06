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

describe('CodexParser.canHandle', () => {
  it('accepts .json files under .codex', () => {
    expect(parser.canHandle('/home/user/.codex/history/abc.json')).toBe(true);
  });

  it('rejects non-.json files', () => {
    expect(parser.canHandle('/home/user/.codex/history/abc.txt')).toBe(false);
  });

  it('rejects .json files not in .codex directory', () => {
    expect(parser.canHandle('/home/user/.other/history/abc.json')).toBe(false);
  });
});

describe('CodexParser.parse', () => {
  function makeFile(name: string, content: unknown): string {
    const dir = path.join(tmpDir, '.codex', 'history');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(content));
    return file;
  }

  it('parses a flat message array', async () => {
    const file = makeFile('session.json', [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tool).toBe('Codex');
    expect(sessions[0].messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]);
  });

  it('parses a wrapped { messages: [...] } object', async () => {
    const file = makeFile('session.json', {
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'there' },
      ],
    });
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(2);
  });

  it('parses a wrapped { conversation: [...] } object', async () => {
    const file = makeFile('session.json', {
      conversation: [
        { role: 'user', content: 'test' },
      ],
    });
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(1);
  });

  it('returns empty array for malformed JSON', async () => {
    const dir = path.join(tmpDir, '.codex', 'history');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, 'not valid json {{');
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(0);
  });

  it('skips non-user/assistant roles', async () => {
    const file = makeFile('session.json', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'real message' },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(1);
    expect(sessions[0].messages[0].role).toBe('user');
  });

  it('handles content as an array of text blocks', async () => {
    const file = makeFile('session.json', [
      { role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'text', text: 'part two' }] },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages[0].content).toContain('part one');
    expect(sessions[0].messages[0].content).toContain('part two');
  });

  it('returns empty array when no user/assistant messages present', async () => {
    const file = makeFile('empty.json', []);
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(0);
  });

  it('sets project to the history directory', async () => {
    const file = makeFile('session.json', [
      { role: 'user', content: 'hello' },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].project).toBe(path.dirname(file));
  });
});
