import React from 'react';
import { render } from 'ink-testing-library';
import { SessionList } from './SessionList.js';
import type { Session } from '../parser/types.js';

const makeSessions = (): Session[] => [
  {
    tool: 'Claude Code',
    project: '/Users/ilya/histd',
    timestamp: new Date('2026-04-06T10:00:00Z'),
    messages: [{ role: 'user', content: 'Fixed parser bugs and rewrote CodexParser' }],
    sessionId: 'uuid-1',
  },
  {
    tool: 'Codex',
    project: '/Users/ilya/histd',
    timestamp: new Date('2026-04-05T10:00:00Z'),
    messages: [{ role: 'user', content: 'Analyzed MCP vs daemon architecture' }],
    sessionId: 'uuid-2',
  },
];

describe('SessionList', () => {
  it('renders the selected row with an arrow indicator', () => {
    const { lastFrame } = render(
      <SessionList sessions={makeSessions()} cursor={0} visibleRows={20} />
    );
    expect(lastFrame()).toContain('▶');
    expect(lastFrame()).toContain('Claude Code');
  });

  it('renders the tool name and date for each session', () => {
    const { lastFrame } = render(
      <SessionList sessions={makeSessions()} cursor={0} visibleRows={20} />
    );
    expect(lastFrame()).toContain('Codex');
    expect(lastFrame()).toContain('Apr');
  });

  it('renders a one-line summary from the first user message', () => {
    const { lastFrame } = render(
      <SessionList sessions={makeSessions()} cursor={0} visibleRows={20} />
    );
    expect(lastFrame()).toContain('Fixed parser bugs');
  });

  it('truncates long summaries at 80 characters', () => {
    const sessions: Session[] = [{
      tool: 'Claude Code',
      project: '/p',
      timestamp: new Date(),
      messages: [{ role: 'user', content: 'A'.repeat(200) }],
    }];
    const { lastFrame } = render(
      <SessionList sessions={sessions} cursor={0} visibleRows={20} />
    );
    // 200 A's should not appear — it's truncated
    expect(lastFrame()).not.toContain('A'.repeat(85));
  });
});
