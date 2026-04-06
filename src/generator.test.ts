import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { write } from './generator';
import { Session, Message } from './parser/types';

function makeSession(
  tool: string,
  project: string,
  ts: Date,
  ...msgs: Message[]
): Session {
  return { tool, project, timestamp: ts, messages: msgs };
}

describe('generator.write', () => {
  it('should create a file in the correct month subdirectory', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-gen-test-'));
    const ts = new Date('2026-04-06T14:30:00Z');
    const sessions = [
      makeSession(
        'Claude Code',
        '/home/dev/projects/my-app',
        ts,
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ),
    ];

    write(sessions, outDir);

    const monthDir = path.join(outDir, '2026-04');
    const entries = fs.readdirSync(monthDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^2026-04-06_/);
    expect(entries[0]).toMatch(/\.md$/);

    fs.rmSync(outDir, { recursive: true });
  });

  it('should write correct Markdown content with frontmatter', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-gen-test-'));
    const ts = new Date('2026-04-06T14:30:00Z');
    const sessions = [
      makeSession(
        'Cursor',
        '/Users/dev/projects/backend-api',
        ts,
        { role: 'user', content: 'Write a python script to reverse a string.' },
        {
          role: 'assistant',
          content: 'Here is the code:\n```python\ndef reverse_string(s):\n    return s[::-1]\n```',
        }
      ),
    ];

    write(sessions, outDir);

    const monthDir = path.join(outDir, '2026-04');
    const entries = fs.readdirSync(monthDir);
    const content = fs.readFileSync(path.join(monthDir, entries[0]), 'utf8');

    expect(content).toContain('tool: "Cursor"');
    expect(content).toContain('project:');
    expect(content).toContain('timestamp:');
    expect(content).toContain('## User');
    expect(content).toContain('## Assistant');
    expect(content).toContain('reverse a string');
    expect(content).toContain('reverse_string');

    fs.rmSync(outDir, { recursive: true });
  });

  it('should be idempotent (write twice without error)', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-gen-test-'));
    const ts = new Date('2026-04-07T09:00:00Z');
    const sessions = [
      makeSession('Claude Code', '/home/dev/project', ts, {
        role: 'user',
        content: 'First run',
      }),
    ];

    expect(() => write(sessions, outDir)).not.toThrow();
    expect(() => write(sessions, outDir)).not.toThrow();

    fs.rmSync(outDir, { recursive: true });
  });

  it('should write multiple sessions to separate files', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-gen-test-'));
    const ts = new Date('2026-04-08T10:00:00Z');
    const sessions = [
      makeSession('Cursor', '/projects/alpha', ts, { role: 'user', content: 'alpha question' }),
      makeSession('Claude Code', '/projects/beta', ts, { role: 'user', content: 'beta question' }),
    ];

    write(sessions, outDir);

    const monthDir = path.join(outDir, '2026-04');
    const entries = fs.readdirSync(monthDir);
    expect(entries).toHaveLength(2);

    fs.rmSync(outDir, { recursive: true });
  });
});
