import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CopilotParser } from './copilot.js';

const SESSION_UUID = 'abc123-uuid-test';

const SESSION_EVENTS = [
  JSON.stringify({ type: 'session.start', timestamp: '2026-04-06T10:00:00.000Z', data: { startTime: '2026-04-06T10:00:00.000Z', context: { cwd: '/Users/ilya/histd' } } }),
  JSON.stringify({ type: 'user.message', timestamp: '2026-04-06T10:01:00.000Z', data: { content: 'Hello from Copilot' } }),
  JSON.stringify({ type: 'assistant.message', timestamp: '2026-04-06T10:02:00.000Z', data: { content: 'Hello back from Copilot' } }),
].join('\n') + '\n';

describe('CopilotParser', () => {
  let tmpDir: string;
  let sessionDir: string;
  let eventsFile: string;
  let parser: CopilotParser;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-copilot-test-'));
    sessionDir = path.join(tmpDir, SESSION_UUID);
    fs.mkdirSync(sessionDir, { recursive: true });
    eventsFile = path.join(sessionDir, 'events.jsonl');
    fs.writeFileSync(eventsFile, SESSION_EVENTS, 'utf8');
    parser = new CopilotParser();
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('canHandle returns true for events.jsonl in .copilot/session-state', () => {
    const fakePath = path.join(os.homedir(), '.copilot', 'session-state', 'some-uuid', 'events.jsonl');
    expect(parser.canHandle(fakePath)).toBe(true);
  });

  it('parses user and assistant messages', async () => {
    const sessions = await parser.parse(eventsFile);
    expect(sessions).toHaveLength(1);
    const { messages } = sessions[0];
    expect(messages.some((m) => m.role === 'user' && m.content === 'Hello from Copilot')).toBe(true);
    expect(messages.some((m) => m.role === 'assistant' && m.content === 'Hello back from Copilot')).toBe(true);
  });

  it('sets timestamp from session.start.data.startTime', async () => {
    const sessions = await parser.parse(eventsFile);
    expect(sessions[0].timestamp.toISOString()).toBe('2026-04-06T10:00:00.000Z');
  });

  it('sets project from session.start.data.context.cwd', async () => {
    const sessions = await parser.parse(eventsFile);
    expect(sessions[0].project).toBe('/Users/ilya/histd');
  });

  it('sets sessionId from parent directory name', async () => {
    const sessions = await parser.parse(eventsFile);
    expect(sessions[0].sessionId).toBe(SESSION_UUID);
  });

  it('returns empty array for events.jsonl with no messages', async () => {
    const emptyDir = path.join(tmpDir, 'empty-uuid');
    fs.mkdirSync(emptyDir, { recursive: true });
    const emptyFile = path.join(emptyDir, 'events.jsonl');
    fs.writeFileSync(emptyFile, JSON.stringify({ type: 'session.start', timestamp: '2026-04-06T10:00:00.000Z', data: { startTime: '2026-04-06T10:00:00.000Z', context: { cwd: '/p' } } }) + '\n', 'utf8');
    const sessions = await parser.parse(emptyFile);
    expect(sessions).toHaveLength(0);
  });
});
