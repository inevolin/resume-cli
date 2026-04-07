import React from 'react';
import { render } from 'ink-testing-library';
import { Footer } from './Footer.js';

describe('Footer', () => {
  it('renders the target tool name between angle brackets', () => {
    const { lastFrame } = render(
      <Footer tools={['Claude Code', 'Codex', 'Copilot']} toolIndex={1} />
    );
    expect(lastFrame()).toContain('◀ Codex ▶');
  });

  it('renders key hints', () => {
    const { lastFrame } = render(
      <Footer tools={['Claude Code']} toolIndex={0} />
    );
    expect(lastFrame()).toContain('tab: switch tool');
    expect(lastFrame()).toContain('↵ launch');
    expect(lastFrame()).toContain('q quit');
  });

  it('shows first tool when toolIndex is 0', () => {
    const { lastFrame } = render(
      <Footer tools={['Claude Code', 'Codex']} toolIndex={0} />
    );
    expect(lastFrame()).toContain('◀ Claude Code ▶');
  });
});
