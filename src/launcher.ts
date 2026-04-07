import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import type { Session } from './parser/types.js';

// ─── Synthetic file writers (exported for testing) ───────────────────────────

export function writeSyntheticClaude(session: Session, targetDir: string): string {
  const uuid = crypto.randomUUID();
  fs.mkdirSync(targetDir, { recursive: true });
  const lines: object[] = [];
  let prevUuid: string | null = null;

  for (const msg of session.messages) {
    const recUuid = crypto.randomUUID();
    const rec: Record<string, unknown> = {
      type: msg.role,
      uuid: recUuid,
      parentUuid: prevUuid,
      sessionId: uuid,
      timestamp: session.timestamp.toISOString(),
      message: {
        role: msg.role,
        content: msg.role === 'assistant'
          ? [{ type: 'text', text: msg.content }]
          : msg.content,
      },
    };
    lines.push(rec);
    prevUuid = recUuid;
  }

  fs.writeFileSync(
    path.join(targetDir, `${uuid}.jsonl`),
    lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    'utf8'
  );
  return uuid;
}

export function writeSyntheticCodex(session: Session, targetDir: string): { uuid: string; filePath: string } {
  const uuid = crypto.randomUUID();
  const d = session.timestamp;
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dir = path.join(targetDir, yyyy, mm, dd);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `rollout-${Date.now()}.jsonl`);

  const lines: object[] = [
    {
      type: 'session_meta',
      timestamp: session.timestamp.toISOString(),
      payload: {
        id: uuid,
        timestamp: session.timestamp.toISOString(),
        cwd: session.project,
      },
    },
  ];

  for (const msg of session.messages) {
    lines.push({
      type: 'response_item',
      timestamp: session.timestamp.toISOString(),
      payload: {
        role: msg.role,
        content: msg.content,
      },
    });
  }

  fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  return { uuid, filePath };
}

export function writeSyntheticCopilot(session: Session, targetDir: string): string {
  const uuid = crypto.randomUUID();
  const dir = path.join(targetDir, uuid);
  fs.mkdirSync(dir, { recursive: true });

  const lines: object[] = [
    {
      type: 'session.start',
      timestamp: session.timestamp.toISOString(),
      data: {
        startTime: session.timestamp.toISOString(),
        context: { cwd: session.project },
      },
    },
  ];

  for (const msg of session.messages) {
    lines.push({
      type: msg.role === 'user' ? 'user.message' : 'assistant.message',
      timestamp: session.timestamp.toISOString(),
      data: { content: msg.content },
    });
  }

  fs.writeFileSync(
    path.join(dir, 'events.jsonl'),
    lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    'utf8'
  );
  return uuid;
}

// ─── Launcher ────────────────────────────────────────────────────────────────

export function launch(session: Session, targetTool: string): void {
  const home = os.homedir();
  const isSameTool = normalizeTool(session.tool) === normalizeTool(targetTool);
  let resumeId: string;
  if (isSameTool) {
    if (!session.sessionId) {
      throw new Error(`Cannot resume ${session.tool} session: session ID is missing. Try cross-tool resume instead.`);
    }
    resumeId = session.sessionId;
  } else {
    resumeId = createSyntheticSession(session, targetTool, home);
  }

  const [cmd, args] = buildCommand(targetTool, resumeId);
  childProcess.spawn(cmd, args, { stdio: 'inherit', detached: false });
}

function normalizeTool(tool: string): string {
  return tool.toLowerCase().replace(/\s+/g, '');
}

function createSyntheticSession(session: Session, targetTool: string, home: string): string {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') {
    const cwd = process.cwd();
    const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-');
    const dir = path.join(home, '.claude', 'projects', encoded);
    return writeSyntheticClaude(session, dir);
  }
  if (norm === 'codex') {
    const dir = path.join(home, '.codex', 'sessions');
    return writeSyntheticCodex(session, dir).uuid;
  }
  if (norm === 'copilot') {
    const dir = path.join(home, '.copilot', 'session-state');
    return writeSyntheticCopilot(session, dir);
  }
  throw new Error(`Unknown target tool: ${targetTool}`);
}

function buildCommand(targetTool: string, resumeId: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude', ['--resume', resumeId]];
  if (norm === 'codex') return ['codex', ['resume', resumeId]];
  if (norm === 'copilot') return ['gh', ['copilot', '--', `--resume=${resumeId}`]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}
