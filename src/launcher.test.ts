import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeSyntheticClaude, writeSyntheticCodex, writeSyntheticCopilot } from './launcher.js';
import type { Session } from './parser/types.js';

const session: Session = {
  tool: 'Codex',
  project: '/Users/ilya/histd',
  timestamp: new Date('2026-04-06T10:00:00Z'),
  messages: [
    { role: 'user', content: 'Hello from Codex' },
    { role: 'assistant', content: 'Response from Codex' },
  ],
  sessionId: 'original-codex-uuid',
};

describe('writeSyntheticClaude', () => {
  it('creates a JSONL file with user and assistant records', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-launcher-test-'));
    const uuid = writeSyntheticClaude(session, tmpDir);
    const filePath = path.join(tmpDir, `${uuid}.jsonl`);

    expect(fs.existsSync(filePath)).toBe(true);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.some((r) => r['type'] === 'user')).toBe(true);
    expect(lines.some((r) => r['type'] === 'assistant')).toBe(true);
    expect(lines.every((r) => r['sessionId'] === uuid)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('writeSyntheticCodex', () => {
  it('creates a JSONL with session_meta and response_item records', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-launcher-test-'));
    const { uuid, filePath } = writeSyntheticCodex(session, tmpDir);

    expect(fs.existsSync(filePath)).toBe(true);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines[0]['type']).toBe('session_meta');
    expect((lines[0]['payload'] as Record<string, unknown>)['id']).toBe(uuid);
    expect(lines.some((r) => r['type'] === 'response_item')).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('writeSyntheticCopilot', () => {
  it('creates events.jsonl with session.start and message records', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-launcher-test-'));
    const uuid = writeSyntheticCopilot(session, tmpDir);
    const filePath = path.join(tmpDir, uuid, 'events.jsonl');

    expect(fs.existsSync(filePath)).toBe(true);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines[0]['type']).toBe('session.start');
    expect(lines.some((r) => r['type'] === 'user.message')).toBe(true);
    expect(lines.some((r) => r['type'] === 'assistant.message')).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
