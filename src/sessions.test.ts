import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('collectAllSessions', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-sessions-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns sessions sorted by timestamp descending', async () => {
    // Use .claude in the path so ClaudeParser.canHandle returns true
    const claudeDir = path.join(tmpDir, '.claude', 'projects', '-tmp-proj');
    fs.mkdirSync(claudeDir, { recursive: true });

    const older = { timestamp: '2026-01-01T00:00:00.000Z', message: { role: 'user', content: 'hello old' }, type: 'user', uuid: 'uuid-old' };
    const newer = { timestamp: '2026-06-01T00:00:00.000Z', message: { role: 'user', content: 'hello new' }, type: 'user', uuid: 'uuid-new' };

    fs.writeFileSync(path.join(claudeDir, 'uuid-old.jsonl'), JSON.stringify(older) + '\n');
    fs.writeFileSync(path.join(claudeDir, 'uuid-new.jsonl'), JSON.stringify(newer) + '\n');

    const { ClaudeParser } = await import('./parser/claude.js');
    jest.unstable_mockModule('./discovery.js', () => ({
      getEntries: () => [{
        tool: 'claude-code',
        paths: [path.join(tmpDir, '.claude', 'projects')],
        parser: new ClaudeParser(),
      }],
    }));

    const { collectAllSessions } = await import('./sessions.js');
    const sessions = await collectAllSessions(10);

    expect(sessions.length).toBe(2);
    expect(sessions[0].timestamp.getTime()).toBeGreaterThan(sessions[1].timestamp.getTime());
  });

  it('respects the limit', async () => {
    // Use .claude in the path so ClaudeParser.canHandle returns true
    const claudeDir = path.join(tmpDir, '.claude', 'projects', '-tmp-proj2');
    fs.mkdirSync(claudeDir, { recursive: true });
    for (let i = 0; i < 5; i++) {
      const month = String(i + 1).padStart(2, '0');
      const rec = { timestamp: `2026-${month}-01T00:00:00.000Z`, message: { role: 'user', content: `msg ${i}` }, type: 'user', uuid: `uuid-${i}` };
      fs.writeFileSync(path.join(claudeDir, `uuid-${i}.jsonl`), JSON.stringify(rec) + '\n');
    }

    const { ClaudeParser } = await import('./parser/claude.js');
    jest.unstable_mockModule('./discovery.js', () => ({
      getEntries: () => [{
        tool: 'claude-code',
        paths: [path.join(tmpDir, '.claude', 'projects')],
        parser: new ClaudeParser(),
      }],
    }));

    const { collectAllSessions } = await import('./sessions.js');
    const sessions = await collectAllSessions(3);
    expect(sessions.length).toBe(3);
  });
});
