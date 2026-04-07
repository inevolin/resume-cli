import { jest, describe, it, expect } from '@jest/globals';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { Session } from '../parser/types.js';

const sessions: Session[] = [
  {
    tool: 'Claude Code',
    project: '/p',
    timestamp: new Date('2026-04-06T10:00:00Z'),
    messages: [{ role: 'user', content: 'Test session one' }],
    sessionId: 'uuid-1',
  },
  {
    tool: 'Codex',
    project: '/p',
    timestamp: new Date('2026-04-05T10:00:00Z'),
    messages: [{ role: 'user', content: 'Test session two' }],
    sessionId: 'uuid-2',
  },
];

const noopLaunch = jest.fn();

describe('App', () => {
  it('renders session list and footer', () => {
    const { lastFrame } = render(
      <App sessions={sessions} installedTools={['Claude Code', 'Codex']} onLaunch={noopLaunch} />
    );
    expect(lastFrame()).toContain('Claude Code');
    expect(lastFrame()).toContain('Test session one');
    expect(lastFrame()).toContain('◀');
  });

  it('shows "No sessions found" when list is empty', () => {
    const { lastFrame } = render(
      <App sessions={[]} installedTools={['Claude Code']} onLaunch={noopLaunch} />
    );
    expect(lastFrame()).toContain('No sessions found');
  });
});
