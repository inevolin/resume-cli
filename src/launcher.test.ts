import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { launch } from './launcher.js';
import type { Session } from './parser/types.js';

const copilotSession: Session = {
  tool: 'Copilot',
  project: '/Users/ilya/project',
  timestamp: new Date('2026-04-06T10:00:00Z'),
  messages: [
    { role: 'user', content: 'Hello from Copilot' },
    { role: 'assistant', content: 'Response from Copilot' },
  ],
  sessionId: 'copilot-uuid',
  filePath: '/Users/ilya/.copilot/session-state/copilot-uuid/events.jsonl',
};

const claudeSession: Session = {
  tool: 'Claude Code',
  project: '/Users/ilya/project',
  timestamp: new Date('2026-04-06T10:00:00Z'),
  messages: [
    { role: 'user', content: 'Hello from Claude' },
    { role: 'assistant', content: 'Response from Claude' },
  ],
  sessionId: 'claude-uuid',
  filePath: '/Users/ilya/.claude/projects/-Users-ilya-project/claude-uuid.jsonl',
};

let spawnFn: jest.Mock;

beforeEach(() => {
  spawnFn = jest.fn();
});

describe('launch — same-tool resume', () => {
  it('resumes Claude Code with --resume flag', () => {
    launch(claudeSession, 'Claude Code', spawnFn as never);
    expect(spawnFn).toHaveBeenCalledWith(
      'claude',
      ['--resume', 'claude-uuid'],
      expect.objectContaining({ cwd: '/Users/ilya/project' })
    );
  });

  it('resumes Copilot with --resume flag', () => {
    launch(copilotSession, 'Copilot', spawnFn as never);
    expect(spawnFn).toHaveBeenCalledWith(
      'copilot',
      ['--resume=copilot-uuid'],
      expect.objectContaining({ cwd: '/Users/ilya/project' })
    );
  });
});

describe('launch — cross-tool resume', () => {
  it('starts Claude Code with the source file path in the prompt', () => {
    launch(copilotSession, 'Claude Code', spawnFn as never);
    const [cmd, args] = spawnFn.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('claude');
    expect(args[0]).toContain(copilotSession.filePath);
  });

  it('starts Copilot with -i flag and source file path', () => {
    launch(claudeSession, 'Copilot', spawnFn as never);
    const [cmd, args] = spawnFn.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('copilot');
    expect(args[0]).toBe('-i');
    expect(args[1]).toContain(claudeSession.filePath);
  });

  it('starts in the session project directory', () => {
    launch(copilotSession, 'Claude Code', spawnFn as never);
    expect(spawnFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ cwd: '/Users/ilya/project' })
    );
  });
});

describe('launch — same-tool without sessionId', () => {
  it('falls back to fresh command when sessionId is missing', () => {
    const sessionWithoutId: Session = { ...copilotSession, sessionId: undefined };
    launch(sessionWithoutId, 'Copilot', spawnFn as never);
    const [cmd, args] = spawnFn.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('copilot');
    expect(args[0]).toBe('-i');
  });
});
