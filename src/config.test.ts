import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { defaultConfig, load } from './config';

describe('defaultConfig', () => {
  it('should have non-empty output_dir', () => {
    const cfg = defaultConfig();
    expect(cfg.output_dir).toBeTruthy();
  });

  it('should have non-empty watches', () => {
    const cfg = defaultConfig();
    expect(cfg.watch.length).toBeGreaterThan(0);
    for (const w of cfg.watch) {
      expect(w.tool).toBeTruthy();
    }
  });
});

describe('load', () => {
  it('should create default config file if absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
    const cfgPath = path.join(dir, 'config.toml');

    const cfg = load(cfgPath);
    expect(cfg.output_dir).toBeTruthy();
    expect(fs.existsSync(cfgPath)).toBe(true);

    fs.rmSync(dir, { recursive: true });
  });

  it('should round-trip: second load reads the file created by first load', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
    const cfgPath = path.join(dir, 'config.toml');

    const first = load(cfgPath);
    const second = load(cfgPath);

    expect(first.output_dir).toBe(second.output_dir);

    fs.rmSync(dir, { recursive: true });
  });
});
