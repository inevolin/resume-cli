# histd MCP Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the background file-watching daemon with an MCP server exposing a single `get_recent_context` tool that AI agents can call directly.

**Architecture:** `src/index.ts` becomes an MCP stdio server. A new `src/discovery.ts` module maps each AI tool to its default file paths and parser. The `src/parser/` directory gains `codex.ts` for the Codex CLI; the Claude and Cursor parsers are kept as-is except for a one-line bug fix in ClaudeParser. All daemon infrastructure (`config.ts`, `watcher.ts`, `generator.ts`) is deleted.

**Tech Stack:** `@modelcontextprotocol/sdk` (MCP server), `zod` (input validation), `better-sqlite3` (retained for Cursor), TypeScript with `"module": "node16"` resolution.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `tsconfig.json` | Change `module` + add `moduleResolution: node16` for MCP SDK `.js` imports |
| Modify | `package.json` | Swap `chokidar`/`smol-toml` for `@modelcontextprotocol/sdk`/`zod`; update metadata |
| Modify | `src/parser/claude.ts` | One-line bug fix: `path.dirname(filePath)` not `path.dirname(path.dirname(filePath))` |
| Modify | `src/parser/claude.test.ts` | Add test asserting the decoded project path |
| Create | `src/parser/codex.ts` | Parses OpenAI Codex CLI JSON session files from `~/.codex/history/` |
| Create | `src/parser/codex.test.ts` | Fixture-based tests for CodexParser |
| Create | `src/discovery.ts` | Returns `DiscoveryEntry[]` mapping each tool to paths + parser |
| Create | `src/discovery.test.ts` | Unit tests for path resolution, mocking `os.homedir` and `process.platform` |
| Rewrite | `src/index.ts` | MCP server: registers `get_recent_context`, connects stdio transport |
| Delete | `src/config.ts` | No longer needed |
| Delete | `src/watcher.ts` | No longer needed |
| Delete | `src/generator.ts` | No longer needed |
| Delete | `src/config.test.ts` | No longer needed |
| Delete | `src/generator.test.ts` | No longer needed |

---

## Task 1: Update dependencies and tsconfig

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Swap dependencies**

```bash
npm uninstall chokidar smol-toml
npm install @modelcontextprotocol/sdk zod
```

Expected output: no errors, `node_modules/@modelcontextprotocol/sdk` and `node_modules/zod` present.

- [ ] **Step 2: Update tsconfig.json**

The MCP SDK uses subpath imports ending in `.js` (e.g. `@modelcontextprotocol/sdk/server/mcp.js`). TypeScript requires `"module": "node16"` to resolve these. Without `"type": "module"` in `package.json`, TypeScript still outputs CommonJS.

Replace the current `tsconfig.json` content with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "node16",
    "moduleResolution": "node16",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: zero errors. (Existing sources still compile; new files don't exist yet.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: swap daemon deps for MCP SDK + zod, use node16 module resolution"
```

---

## Task 2: Fix ClaudeParser project path

**Files:**
- Modify: `src/parser/claude.ts` (line 82)
- Modify: `src/parser/claude.test.ts`

**Background:** `ClaudeParser` currently sets `project = path.dirname(path.dirname(filePath))`, which resolves to `~/.claude/projects` for every session — making all Claude sessions indistinguishable by project. The correct value is `path.dirname(filePath)`, which gives the encoded project directory (e.g. `~/.claude/projects/-Users-ilya-histd`). The MCP server's matching logic handles decoding this.

- [ ] **Step 1: Write a failing test**

Add to `src/parser/claude.test.ts` (inside the existing `describe('ClaudeParser.parse', ...)` block):

```typescript
it('should set project to the immediate parent directory', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-test-'));
  // Simulate ~/.claude/projects/-Users-ilya-myproject/session.jsonl
  const projectDir = path.join(base, '-Users-ilya-myproject');
  fs.mkdirSync(projectDir, { recursive: true });
  const line = {
    type: 'user',
    timestamp: '2026-04-06T10:00:00Z',
    message: { role: 'user', content: 'Hello' },
  };
  const filePath = path.join(projectDir, 'session.jsonl');
  fs.writeFileSync(filePath, JSON.stringify(line) + '\n');

  const p = new ClaudeParser();
  const sessions = await p.parse(filePath);

  expect(sessions[0].project).toBe(projectDir);

  fs.rmSync(base, { recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=claude
```

Expected: FAIL — `expect(received).toBe(expected)` where received is the grandparent path, not `projectDir`.

- [ ] **Step 3: Apply the one-line fix in `src/parser/claude.ts`**

Find line 82 (inside `ClaudeParser.parse`):

```typescript
    const project = path.dirname(path.dirname(filePath));
```

Replace with:

```typescript
    const project = path.dirname(filePath);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=claude
```

Expected: all tests PASS including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/parser/claude.ts src/parser/claude.test.ts
git commit -m "fix: ClaudeParser.project is now the encoded project dir, not its parent"
```

---

## Task 3: Add CodexParser

**Files:**
- Create: `src/parser/codex.ts`
- Create: `src/parser/codex.test.ts`

**Background:** The OpenAI Codex CLI stores sessions as JSON files under `~/.codex/history/`. The parser handles two shapes: a top-level array of `{role, content}` objects, and a wrapper object with a `messages` (or `conversation`) key. Content may be a string or an array of `{type, text}` blocks.

- [ ] **Step 1: Write the tests first**

Create `src/parser/codex.test.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodexParser } from './codex';

const parser = new CodexParser();
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histd-codex-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe('CodexParser.canHandle', () => {
  it('accepts .json files under .codex', () => {
    expect(parser.canHandle('/home/user/.codex/history/abc.json')).toBe(true);
  });

  it('rejects non-.json files', () => {
    expect(parser.canHandle('/home/user/.codex/history/abc.txt')).toBe(false);
  });

  it('rejects .json files not in .codex directory', () => {
    expect(parser.canHandle('/home/user/.other/history/abc.json')).toBe(false);
  });
});

describe('CodexParser.parse', () => {
  function makeFile(name: string, content: unknown): string {
    const dir = path.join(tmpDir, '.codex', 'history');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(content));
    return file;
  }

  it('parses a flat message array', async () => {
    const file = makeFile('session.json', [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tool).toBe('Codex');
    expect(sessions[0].messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]);
  });

  it('parses a wrapped { messages: [...] } object', async () => {
    const file = makeFile('session.json', {
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'there' },
      ],
    });
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(2);
  });

  it('parses a wrapped { conversation: [...] } object', async () => {
    const file = makeFile('session.json', {
      conversation: [
        { role: 'user', content: 'test' },
      ],
    });
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(1);
  });

  it('returns empty array for malformed JSON', async () => {
    const dir = path.join(tmpDir, '.codex', 'history');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, 'not valid json {{');
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(0);
  });

  it('skips non-user/assistant roles', async () => {
    const file = makeFile('session.json', [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'real message' },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages).toHaveLength(1);
    expect(sessions[0].messages[0].role).toBe('user');
  });

  it('handles content as an array of text blocks', async () => {
    const file = makeFile('session.json', [
      { role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'text', text: 'part two' }] },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].messages[0].content).toContain('part one');
    expect(sessions[0].messages[0].content).toContain('part two');
  });

  it('returns empty array when no user/assistant messages present', async () => {
    const file = makeFile('empty.json', []);
    const sessions = await parser.parse(file);
    expect(sessions).toHaveLength(0);
  });

  it('sets project to the history directory', async () => {
    const file = makeFile('session.json', [
      { role: 'user', content: 'hello' },
    ]);
    const sessions = await parser.parse(file);
    expect(sessions[0].project).toBe(path.dirname(file));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=codex
```

Expected: FAIL — `Cannot find module './codex'`

- [ ] **Step 3: Implement CodexParser**

Create `src/parser/codex.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { HistoryParser, Message, Session } from './types.js';

interface RawMessage {
  role?: unknown;
  content?: unknown;
}

/**
 * Parses OpenAI Codex CLI session files stored under ~/.codex/history/.
 *
 * Supports two JSON shapes:
 *   1. Top-level array of {role, content} objects
 *   2. Wrapper object with a "messages" or "conversation" key
 *
 * Content may be a plain string or an array of {type, text} blocks.
 */
export class CodexParser implements HistoryParser {
  canHandle(filePath: string): boolean {
    return filePath.includes('.codex') && filePath.endsWith('.json');
  }

  async parse(filePath: string): Promise<Session[]> {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }

    const rawMessages = extractMessageArray(raw);
    const messages: Message[] = [];

    for (const item of rawMessages) {
      if (!item || typeof item !== 'object') continue;
      const m = item as RawMessage;
      const role = typeof m.role === 'string' ? m.role : '';
      if (role !== 'user' && role !== 'assistant') continue;
      const content = extractContent(m.content);
      if (!content) continue;
      messages.push({ role, content });
    }

    if (messages.length === 0) return [];

    const project = path.dirname(filePath);
    const timestamp = fileTimestamp(filePath);

    return [{ tool: 'Codex', project, timestamp, messages }];
  }
}

function extractMessageArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['messages', 'conversation', 'history']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

function extractContent(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    return v
      .filter((b): b is { type: string; text: string } =>
        b != null && typeof b === 'object' && typeof (b as Record<string, unknown>).text === 'string'
      )
      .map((b) => b.text)
      .join('\n')
      .trim();
  }
  return '';
}

function fileTimestamp(filePath: string): Date {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return new Date();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=codex
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser/codex.ts src/parser/codex.test.ts
git commit -m "feat: add CodexParser for OpenAI Codex CLI sessions"
```

---

## Task 4: Add discovery module

**Files:**
- Create: `src/discovery.ts`
- Create: `src/discovery.test.ts`

**Background:** `getEntries()` returns one `DiscoveryEntry` per supported tool. Each entry contains the tool name, a list of directories to scan (skipped silently if absent on disk), and a parser instance. Platform differences (macOS vs Linux) are handled here, keeping all other modules platform-agnostic.

- [ ] **Step 1: Write the tests first**

Create `src/discovery.test.ts`:

```typescript
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

  it('includes copilot with VSCode Linux config path', () => {
    const entry = getEntries().find((e) => e.tool === 'copilot');
    expect(entry!.paths).toContain(
      `${FAKE_HOME}/.config/Code/User/workspaceStorage`
    );
  });

  it('includes codex pointing at ~/.codex/history', () => {
    const entry = getEntries().find((e) => e.tool === 'codex');
    expect(entry!.paths).toContain(`${FAKE_HOME}/.codex/history`);
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

  it('uses Library/Application Support path for copilot', () => {
    const entry = getEntries().find((e) => e.tool === 'copilot');
    expect(entry!.paths).toContain(
      `${FAKE_HOME}/Library/Application Support/Code/User/workspaceStorage`
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=discovery
```

Expected: FAIL — `Cannot find module './discovery'`

- [ ] **Step 3: Implement discovery.ts**

Create `src/discovery.ts`:

```typescript
import * as os from 'os';
import * as path from 'path';
import { HistoryParser } from './parser/types.js';
import { ClaudeParser } from './parser/claude.js';
import { CursorParser } from './parser/cursor.js';
import { CodexParser } from './parser/codex.js';

export interface DiscoveryEntry {
  tool: string;
  paths: string[];
  parser: HistoryParser;
}

/**
 * Returns one DiscoveryEntry per supported AI tool.
 * Paths that do not exist on the current machine are silently skipped by
 * the caller (src/index.ts); this function only computes the expected paths.
 */
export function getEntries(): DiscoveryEntry[] {
  const home = os.homedir();
  const mac = process.platform === 'darwin';

  const appSupport = (app: string) =>
    mac
      ? path.join(home, 'Library', 'Application Support', app, 'User', 'workspaceStorage')
      : path.join(home, '.config', app, 'User', 'workspaceStorage');

  return [
    {
      tool: 'claude-code',
      paths: [path.join(home, '.claude', 'projects')],
      parser: new ClaudeParser(),
    },
    {
      tool: 'cursor',
      paths: [appSupport('Cursor')],
      parser: new CursorParser(),
    },
    {
      tool: 'copilot',
      paths: [appSupport('Code')],
      parser: new CursorParser(),
    },
    {
      tool: 'codex',
      paths: [path.join(home, '.codex', 'history')],
      parser: new CodexParser(),
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=discovery
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/discovery.ts src/discovery.test.ts
git commit -m "feat: add discovery module for auto-detecting AI tool paths"
```

---

## Task 5: Rewrite src/index.ts as MCP server

**Files:**
- Rewrite: `src/index.ts`

**Background:** The new `index.ts` creates an MCP server with one tool (`get_recent_context`), connects via stdio, and exits cleanly. Key logic: recursively walk each discovery path, call `canHandle` + `parse` per file, filter by project, sort by timestamp descending, return formatted text.

The `matchesProject` function handles three cases:
1. Exact path match
2. Session path ends with the query path (absolute path suffix)
3. Claude's encoded project directory (e.g. `-Users-ilya-histd`) — extract the last `-`-separated segment and compare against the query basename

- [ ] **Step 1: Rewrite src/index.ts**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { getEntries, DiscoveryEntry } from './discovery.js';
import { Session } from './parser/types.js';

const server = new McpServer({ name: 'histd', version: '1.0.0' });

server.tool(
  'get_recent_context',
  'Retrieve recent AI coding session history for a project to restore context when switching between AI tools (Claude Code, Cursor, Copilot, Codex).',
  {
    project_path: z.string().describe('Absolute path to the project directory (e.g. /Users/you/my-project)'),
    limit: z.number().int().min(1).max(50).optional().describe('Maximum number of sessions to return (default: 5)'),
  },
  async ({ project_path, limit = 5 }) => {
    const sessions = await collectSessions(project_path, limit);
    if (sessions.length === 0) {
      return {
        content: [{ type: 'text' as const, text: `No session history found for project: ${project_path}` }],
      };
    }
    return {
      content: [{ type: 'text' as const, text: formatSessions(sessions) }],
    };
  }
);

async function collectSessions(projectPath: string, limit: number): Promise<Session[]> {
  const entries = getEntries();
  const all: Session[] = [];

  for (const entry of entries) {
    for (const dir of entry.paths) {
      if (!fs.existsSync(dir)) continue;
      const files = walkDir(dir);
      for (const file of files) {
        if (!entry.parser.canHandle(file)) continue;
        try {
          const sessions = await entry.parser.parse(file);
          for (const s of sessions) {
            if (matchesProject(s.project, projectPath)) {
              all.push(s);
            }
          }
        } catch {
          // Skip unreadable or unparseable files; log to stderr for debugging
          process.stderr.write(`histd: skipping ${file}\n`);
        }
      }
    }
  }

  return all
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

/**
 * Returns true when the session's recorded project path refers to the same
 * project as queryPath. Handles three cases:
 *
 *   1. Exact match: session.project === queryPath
 *   2. Suffix match: session.project ends with /queryPath (absolute sub-path)
 *   3. Claude encoded path: basename of session.project is "-Users-ilya-histd";
 *      the last '-'-separated segment ("histd") equals path.basename(queryPath)
 */
function matchesProject(sessionProject: string, queryPath: string): boolean {
  if (sessionProject === queryPath) return true;
  if (sessionProject.endsWith(path.sep + queryPath)) return true;

  const sessionBase = path.basename(sessionProject);
  const queryBase = path.basename(queryPath);

  if (sessionBase === queryBase) return true;

  // Claude encodes /Users/ilya/histd as -Users-ilya-histd; last segment is the basename
  if (sessionBase.startsWith('-')) {
    const last = sessionBase.split('-').filter(Boolean).pop();
    if (last === queryBase) return true;
  }

  return false;
}

/** Recursively collects all file paths under dir. */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function formatSessions(sessions: Session[]): string {
  return sessions
    .map((s, i) => {
      const header = `[${i + 1}] ${s.tool} — ${s.timestamp.toISOString()} — ${s.project}`;
      const body = s.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`histd: fatal: ${err}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: zero TypeScript errors, `dist/index.js` produced.

- [ ] **Step 3: Verify the server starts and exits cleanly (smoke test)**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

Expected: JSON response containing `"name":"get_recent_context"`.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewrite index.ts as MCP server with get_recent_context tool"
```

---

## Task 6: Delete dead code

**Files:**
- Delete: `src/config.ts`, `src/watcher.ts`, `src/generator.ts`, `src/config.test.ts`, `src/generator.test.ts`

- [ ] **Step 1: Remove the files**

```bash
git rm src/config.ts src/watcher.ts src/generator.ts src/config.test.ts src/generator.test.ts
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: all remaining tests PASS (claude, cursor, codex, discovery).

- [ ] **Step 3: Build to confirm no dangling imports**

```bash
npm run build
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove daemon infrastructure (config, watcher, generator)"
```

---

## Task 7: Update package.json metadata and README

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Update package.json**

Update `description`, `keywords`, and remove daemon-only fields. The `bin` entry stays as-is (`"histd": "dist/index.js"`).

```json
{
  "description": "MCP server that lets AI agents query your cross-tool coding session history (Claude Code, Cursor, Copilot, Codex).",
  "keywords": ["ai", "claude", "cursor", "copilot", "codex", "mcp", "history", "context"]
}
```

- [ ] **Step 2: Rewrite README.md**

Replace the full content of `README.md` with:

````markdown
<p align="center">
  <h1 align="center">histd</h1>
  <p align="center">
    An MCP server that lets AI agents query your cross-tool coding session history.<br/>
    Switch between Claude Code, Cursor, Copilot, and Codex without losing context.
  </p>
</p>

<p align="center">
  <a href="https://github.com/inevolin/histd/actions/workflows/ci.yml"><img src="https://github.com/inevolin/histd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/histd"><img src="https://img.shields.io/npm/v/histd.svg" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

## Why histd?

AI coding tools store conversation history in proprietary, tool-specific formats — JSONL, SQLite, JSON — scattered across your home directory. When you switch tools, your context is lost.

**histd** is an MCP server. When you start a session in a new AI tool, it can call `get_recent_context` to retrieve your recent conversations for the current project — regardless of which tool they came from.

No background process. No config file. Just add it to your MCP config once.

## Supported Tools

| Tool | Format | Auto-detected path |
|------|--------|--------------------|
| Claude Code | JSONL | `~/.claude/projects/` |
| Cursor | SQLite (`.vscdb`) | `~/.config/Cursor/User/workspaceStorage/` |
| GitHub Copilot (VS Code) | SQLite (`.vscdb`) | `~/.config/Code/User/workspaceStorage/` |
| OpenAI Codex CLI | JSON | `~/.codex/history/` |

macOS paths (`~/Library/Application Support/...`) are also detected automatically.

## Setup

Add histd to your MCP config. No installation required — `npx` fetches it on demand.

**Claude Desktop** (`~/.claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "histd": {
      "command": "npx",
      "args": ["histd"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "histd": {
      "command": "npx",
      "args": ["histd"]
    }
  }
}
```

Restart your AI tool after updating the config.

## Usage

Once configured, your AI agent can call:

```
get_recent_context(project_path: "/Users/you/my-project", limit: 5)
```

Or just ask it naturally:

> "Check my recent history for this project before we start."

The agent will call `get_recent_context` with the current working directory and receive the last N conversation turns across all supported tools.

## Tool Reference

### `get_recent_context`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `project_path` | string | yes | Absolute path to the project directory |
| `limit` | number | no | Max sessions to return (default: 5, max: 50) |

**Returns:** Formatted text listing recent sessions, newest first:

```
[1] Claude Code — 2026-04-06T14:30:00Z — /Users/you/my-project
User: How do I refactor the database layer?
Assistant: Here's an approach using the repository pattern…

[2] Cursor — 2026-04-05T09:15:00Z — /Users/you/my-project
…
```

## Architecture

```
src/
├── index.ts          — MCP server entry point; registers get_recent_context
├── discovery.ts      — Maps each tool to its default FS paths + parser
└── parser/
    ├── types.ts      — HistoryParser interface + Session/Message types
    ├── claude.ts     — Claude Code JSONL parser
    ├── cursor.ts     — Cursor / Copilot SQLite parser
    └── codex.ts      — OpenAI Codex CLI JSON parser
```

## Development

```bash
npm install
npm run build   # compile TypeScript
npm test        # run tests
npm run lint    # type-check only
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE).
````

- [ ] **Step 3: Run tests and build one final time**

```bash
npm test && npm run build
```

Expected: all tests PASS, build succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "docs: update README and package.json for MCP architecture"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** tsconfig ✓, dep swap ✓, CodexParser ✓, discovery ✓, `get_recent_context` tool ✓, dead code removal ✓, README ✓, Claude project-path bug fix ✓
- [x] **No placeholders:** All steps contain actual code, commands, and expected output
- [x] **Type consistency:** `DiscoveryEntry` defined in `discovery.ts` and imported in `index.ts` with matching shape; `Session`/`Message`/`HistoryParser` from `parser/types.ts` used consistently across all files; `.js` import extensions used in all `node16`-mode source files
- [x] **Known limitation noted:** Claude's path encoding is decoded heuristically (last `-`-separated segment). Projects with hyphens in their basename may match incorrectly if two projects share the same last segment. Acceptable for MVP.
