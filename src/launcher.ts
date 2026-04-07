import * as childProcess from 'child_process';
import type { Session } from './parser/types.js';

type SpawnFn = typeof childProcess.spawn;

export function launch(session: Session, targetTool: string, spawnFn: SpawnFn = childProcess.spawn): void {
  const isSameTool = normalizeTool(session.tool) === normalizeTool(targetTool);

  if (isSameTool && session.sessionId) {
    const [cmd, args] = buildResumeCommand(targetTool, session.sessionId);
    spawnFn(cmd, args, { stdio: 'inherit', detached: false, cwd: session.project });
    return;
  }

  // Cross-tool (or same-tool without a sessionId): start fresh and hand off the source file.
  const sourceFile = session.filePath ?? 'unknown';
  const prompt = `Continue the conversation from the session history stored in this file: ${sourceFile}\n\nRead that file to understand our previous conversation, then let me know you're ready to continue.`;
  const [cmd, args] = buildFreshCommand(targetTool, prompt);
  spawnFn(cmd, args, { stdio: 'inherit', detached: false, cwd: session.project });
}

function normalizeTool(tool: string): string {
  return tool.toLowerCase().replace(/\s+/g, '');
}

function buildResumeCommand(targetTool: string, sessionId: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude', ['--resume', sessionId]];
  if (norm === 'codex') return ['codex', ['resume', sessionId]];
  if (norm === 'copilot') return ['copilot', [`--resume=${sessionId}`]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}

function buildFreshCommand(targetTool: string, prompt: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude', [prompt]];
  if (norm === 'codex') return ['codex', [prompt]];
  if (norm === 'copilot') return ['copilot', ['-i', prompt]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}
