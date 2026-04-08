import { describe, it, expect } from '@jest/globals';
import { buildCommand } from './launcher.js';
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

describe('buildCommand — same-tool resume', () => {
  it('returns claude --resume command', () => {
    expect(buildCommand(claudeSession, 'Claude Code')).toBe('claude --resume claude-uuid');
  });

  it('returns codex resume command', () => {
    const codexSession: Session = { ...claudeSession, tool: 'Codex', sessionId: 'codex-uuid' };
    expect(buildCommand(codexSession, 'Codex')).toBe('codex resume codex-uuid');
  });

  it('returns copilot --resume= command', () => {
    expect(buildCommand(copilotSession, 'Copilot')).toBe('copilot --resume=copilot-uuid');
  });
});

describe('buildCommand — cross-tool (fresh start)', () => {
  it('starts Claude Code with the source file path quoted in prompt', () => {
    const cmd = buildCommand(copilotSession, 'Claude Code');
    expect(cmd).toMatch(/^claude ".*copilot-uuid.*"$/s);
  });

  it('starts Codex with the source file path quoted in prompt', () => {
    const cmd = buildCommand(claudeSession, 'Codex');
    expect(cmd).toMatch(/^codex ".*claude-uuid.*"$/s);
  });

  it('starts Copilot with -i flag and quoted prompt', () => {
    const cmd = buildCommand(claudeSession, 'Copilot');
    expect(cmd).toMatch(/^copilot -i ".*claude-uuid.*"$/s);
  });
});

describe('buildCommand — same-tool without sessionId', () => {
  it('falls back to fresh command when sessionId is missing', () => {
    const sessionWithoutId: Session = { ...copilotSession, sessionId: undefined };
    const cmd = buildCommand(sessionWithoutId, 'Copilot');
    expect(cmd).toMatch(/^copilot -i ".*"$/s);
  });
});

describe('shellEscape — via buildCommand output', () => {
  it('does not quote simple alphanumeric UUIDs', () => {
    expect(buildCommand(claudeSession, 'Claude Code')).toBe('claude --resume claude-uuid');
  });

  it('double-quotes strings with spaces', () => {
    const session: Session = {
      ...claudeSession,
      tool: 'Codex',
      sessionId: undefined,
      filePath: '/path with spaces/file.jsonl',
    };
    const cmd = buildCommand(session, 'Codex');
    expect(cmd).toContain('"');
  });
});
