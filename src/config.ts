import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as TOML from 'smol-toml';

/** A single path to watch with its associated tool name. */
export interface WatchEntry {
  path: string;
  tool: string;
}

/** Top-level configuration loaded from ~/.histd/config.toml. */
export interface Config {
  /** Directory where extracted Markdown sessions are written. */
  output_dir: string;
  /** List of source paths to monitor. */
  watch: WatchEntry[];
}

/** Returns the path to the ~/.histd directory. */
export function defaultConfigDir(): string {
  return path.join(os.homedir(), '.histd');
}

/** Returns ~/.histd/sessions. */
function defaultOutputDir(): string {
  return path.join(defaultConfigDir(), 'sessions');
}

/** Returns the default path for Claude Code's project storage. */
function defaultClaudePath(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

/** Returns the default path for Cursor's workspace storage. */
function defaultCursorPath(): string {
  return path.join(os.homedir(), '.config', 'Cursor', 'User', 'workspaceStorage');
}

/** Builds a Config populated with reasonable defaults. */
export function defaultConfig(): Config {
  return {
    output_dir: defaultOutputDir(),
    watch: [
      { path: defaultClaudePath(), tool: 'claude-code' },
      { path: defaultCursorPath(), tool: 'cursor' },
    ],
  };
}

/** Serialises cfg as TOML and saves it to filePath. */
function writeConfig(filePath: string, cfg: Config): void {
  const tomlStr = TOML.stringify(cfg as unknown as Record<string, TOML.TomlPrimitive>);
  fs.writeFileSync(filePath, tomlStr, 'utf8');
}

/** Writes a default config file and returns the resulting Config. */
function initDefault(filePath: string): Config {
  const cfg = defaultConfig();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeConfig(filePath, cfg);
  return cfg;
}

/** Reads the config file at filePath, creating it with defaults if absent. */
export function load(filePath: string): Config {
  if (!fs.existsSync(filePath)) {
    return initDefault(filePath);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = TOML.parse(raw) as unknown as Config;
  return parsed;
}
