import { jest, describe, it, expect, beforeAll } from '@jest/globals';

const FAKE_HOME = '/home/testuser';

jest.unstable_mockModule('os', () => ({
  default: { homedir: () => FAKE_HOME },
  homedir: () => FAKE_HOME,
}));

describe('getEntries', () => {
  let getEntries: () => import('./discovery.js').DiscoveryEntry[];

  beforeAll(async () => {
    const mod = await import('./discovery.js');
    getEntries = mod.getEntries;
  });

  it('includes claude-code pointing at ~/.claude/projects', () => {
    const entry = getEntries().find((e) => e.tool === 'claude-code');
    expect(entry).toBeDefined();
    expect(entry!.paths).toContain(`${FAKE_HOME}/.claude/projects`);
  });

  it('includes copilot pointing at ~/.copilot/session-state', () => {
    const entry = getEntries().find((e) => e.tool === 'copilot');
    expect(entry!.paths).toContain(`${FAKE_HOME}/.copilot/session-state`);
  });

  it('includes codex pointing at ~/.codex/sessions', () => {
    const entry = getEntries().find((e) => e.tool === 'codex');
    expect(entry!.paths).toContain(`${FAKE_HOME}/.codex/sessions`);
  });

  it('returns exactly 3 entries', () => {
    expect(getEntries()).toHaveLength(3);
  });

  it('does not include cursor', () => {
    expect(getEntries().find((e) => e.tool === 'cursor')).toBeUndefined();
  });
});
