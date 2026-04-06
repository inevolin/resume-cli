import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClaudeParser } from '../parser/claude';

describe('ClaudeParser.canHandle', () => {
  const p = new ClaudeParser();

  it('should handle .jsonl files inside .claude', () => {
    expect(p.canHandle('/home/user/.claude/projects/abc123/session.jsonl')).toBe(true);
  });

  it('should not handle .json files', () => {
    expect(p.canHandle('/home/user/.claude/projects/abc123/session.json')).toBe(false);
  });

  it('should not handle cursor files', () => {
    expect(p.canHandle('/home/user/cursor/state.vscdb')).toBe(false);
  });
});

describe('ClaudeParser.parse', () => {
  it('should parse a basic JSONL session', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
    const lines = [
      {
        type: 'user',
        timestamp: '2026-04-06T10:00:00Z',
        message: { role: 'user', content: 'Hello, world!' },
      },
      {
        type: 'assistant',
        timestamp: '2026-04-06T10:00:05Z',
        message: { role: 'assistant', content: 'Hi there!' },
      },
    ];
    const jsonl = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
    const filePath = path.join(dir, 'session.jsonl');
    fs.writeFileSync(filePath, jsonl);

    const p = new ClaudeParser();
    const sessions = await p.parse(filePath);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].tool).toBe('Claude Code');
    expect(sessions[0].messages).toHaveLength(2);
    expect(sessions[0].messages[0].role).toBe('user');
    expect(sessions[0].messages[0].content).toBe('Hello, world!');

    fs.rmSync(dir, { recursive: true });
  });

  it('should parse structured content blocks', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
    const line = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'Part one' },
          { type: 'text', text: 'Part two' },
        ],
      },
    };
    const filePath = path.join(dir, 'structured.jsonl');
    fs.writeFileSync(filePath, JSON.stringify(line) + '\n');

    const p = new ClaudeParser();
    const sessions = await p.parse(filePath);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages).toHaveLength(1);
    const content = sessions[0].messages[0].content;
    expect(content).toContain('Part one');
    expect(content).toContain('Part two');

    fs.rmSync(dir, { recursive: true });
  });

  it('should set project to the immediate parent directory', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
    // Simulate ~/.claude/projects/-Users-ilya-myproject/session.jsonl
    const projectDir = path.join(base, '-Users-ilya-myproject');
    fs.mkdirSync(projectDir, { recursive: true });
    const line = {
      type: 'user',
      timestamp: '2026-04-06T10:00:00Z',
      message: { role: 'user', content: 'Hello' },
    };
    const filePath = path.join(projectDir, 'session.jsonl');
    fs.writeFileSync(filePath, JSON.stringify(line) + '\n');

    const p = new ClaudeParser();
    const sessions = await p.parse(filePath);

    expect(sessions[0].project).toBe(projectDir);

    fs.rmSync(base, { recursive: true });
  });
});
