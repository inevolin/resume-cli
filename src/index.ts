#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { getEntries } from './discovery.js';
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
        } catch (err) {
          // Skip unreadable or unparseable files; log to stderr for debugging
          process.stderr.write(`histd: skipping ${file}: ${err}\n`);
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
 * project as queryPath. Handles two cases:
 *
 *   1. Exact match: session.project === queryPath
 *   2. Claude encoded path: Claude stores ~/.claude/projects/-Users-ilya-my-proj for
 *      /Users/ilya/my-proj by replacing the leading / with - and every subsequent /
 *      with -. We reverse that encoding and compare.
 */
function matchesProject(sessionProject: string, queryPath: string): boolean {
  if (sessionProject === queryPath) return true;

  const sessionBase = path.basename(sessionProject);

  // Claude encodes project paths by replacing every non-alphanumeric character
  // with '-', e.g. /Users/ilya/histd → -Users-ilya-histd,
  //                /tmp/foo.bar-baz  → -tmp-foo-bar-baz.
  // Re-encode queryPath the same way and compare directly.
  if (sessionBase.startsWith('-')) {
    const encoded = queryPath.replace(/[^a-zA-Z0-9]/g, '-');
    if (sessionBase === encoded) return true;
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
