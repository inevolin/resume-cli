/**
 * We mock os.homedir and process.platform before importing discovery
 * so the module sees our controlled values at initialisation time.
 */

const FAKE_HOME = '/home/testuser';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => FAKE_HOME,
}));

describe('getEntries — Linux', () => {
  let getEntries: () => import('./discovery.js').DiscoveryEntry[];

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    jest.resetModules();
    ({ getEntries } = require('./discovery'));
  });

  it('includes claude-code pointing at ~/.claude/projects', () => {
    const entry = getEntries().find((e) => e.tool === 'claude-code');
    expect(entry).toBeDefined();
    expect(entry!.paths).toContain(`${FAKE_HOME}/.claude/projects`);
  });

  it('includes cursor with Linux config path', () => {
    const entry = getEntries().find((e) => e.tool === 'cursor');
    expect(entry!.paths).toContain(
      `${FAKE_HOME}/.config/Cursor/User/workspaceStorage`
    );
  });

  it('includes copilot pointing at ~/.copilot/session-state', () => {
    const entry = getEntries().find((e) => e.tool === 'copilot');
    expect(entry!.paths).toContain(`${FAKE_HOME}/.copilot/session-state`);
  });

  it('includes codex pointing at ~/.codex/sessions', () => {
    const entry = getEntries().find((e) => e.tool === 'codex');
    expect(entry!.paths).toContain(`${FAKE_HOME}/.codex/sessions`);
  });

  it('returns exactly 4 entries', () => {
    expect(getEntries()).toHaveLength(4);
  });
});

describe('getEntries — macOS', () => {
  let getEntries: () => import('./discovery.js').DiscoveryEntry[];

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    jest.resetModules();
    ({ getEntries } = require('./discovery'));
  });

  it('uses Library/Application Support path for cursor', () => {
    const entry = getEntries().find((e) => e.tool === 'cursor');
    expect(entry!.paths).toContain(
      `${FAKE_HOME}/Library/Application Support/Cursor/User/workspaceStorage`
    );
  });

  it('uses ~/.copilot/session-state for copilot (same on all platforms)', () => {
    const entry = getEntries().find((e) => e.tool === 'copilot');
    expect(entry!.paths).toContain(`${FAKE_HOME}/.copilot/session-state`);
  });
});
