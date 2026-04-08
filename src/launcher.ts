import type { Session } from './parser/types.js';

/**
 * Builds the shell command string to launch the given tool for a session.
 * The caller (shell function wrapper) should eval/Invoke-Expression this string.
 *
 * Exit contract for the CLI:
 *   stdout: the raw command (one line, no trailing text)
 *   stderr: TUI output + any hints
 */
export function buildCommand(session: Session, targetTool: string): string {
  const isSameTool = normalizeTool(session.tool) === normalizeTool(targetTool);

  if (isSameTool && session.sessionId) {
    const [cmd, args] = buildResumeArgs(targetTool, session.sessionId);
    // UUIDs and flags are always shell-safe — no quoting needed.
    return [cmd, ...args].join(' ');
  }

  // Cross-tool or same-tool without sessionId: fresh start with context prompt.
  const sourceFile = session.filePath ?? 'unknown';
  const prompt =
    `Continue the conversation from the session history stored in this file: ${sourceFile}\n\n` +
    `Read that file to understand our previous conversation, then let me know you're ready to continue.`;
  const [cmd, args] = buildFreshArgs(targetTool, prompt);
  return [cmd, ...args.map(shellEscape)].join(' ');
}

/**
 * Escapes a string for safe inclusion in a shell command line.
 * Uses double-quote style which is valid in bash, zsh, fish, and PowerShell
 * Invoke-Expression.
 */
function shellEscape(s: string): string {
  // Short-circuit: tokens that need no quoting in any shell.
  if (/^[\w./:@=+\-]+$/.test(s)) return s;
  // Normalise newlines to spaces, then wrap in double quotes.
  const safe = s.replace(/\r?\n/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${safe}"`;
}

function normalizeTool(tool: string): string {
  return tool.toLowerCase().replace(/\s+/g, '');
}

function buildResumeArgs(targetTool: string, sessionId: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude', ['--resume', sessionId]];
  if (norm === 'codex')      return ['codex',  ['resume',   sessionId]];
  if (norm === 'copilot')    return ['copilot', [`--resume=${sessionId}`]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}

function buildFreshArgs(targetTool: string, prompt: string): [string, string[]] {
  const norm = normalizeTool(targetTool);
  if (norm === 'claudecode') return ['claude',  [prompt]];
  if (norm === 'codex')      return ['codex',   [prompt]];
  if (norm === 'copilot')    return ['copilot', ['-i', prompt]];
  throw new Error(`Unknown target tool: ${targetTool}`);
}
