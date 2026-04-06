import * as fs from 'fs';
import * as path from 'path';
import { Session } from './parser/types';

/**
 * Converts each session to a Markdown file and saves it under outputDir using:
 *   <outputDir>/<YYYY-MM>/<YYYY-MM-DD>_<tool>_<project-base>.md
 *
 * Existing files are overwritten so that re-runs are idempotent.
 */
export function write(sessions: Session[], outputDir: string): void {
  for (const s of sessions) {
    writeSession(s, outputDir);
  }
}

function writeSession(s: Session, outputDir: string): void {
  const ts = s.timestamp ?? new Date();
  const monthDir = path.join(outputDir, formatMonth(ts));
  fs.mkdirSync(monthDir, { recursive: true });

  const filename = buildFilename(ts, s.tool, s.project);
  const dest = path.join(monthDir, filename);

  const content = render(s);
  fs.writeFileSync(dest, content, 'utf8');
}

/** Produces a consistent, filesystem-safe file name. */
function buildFilename(ts: Date, tool: string, project: string): string {
  const date = formatDate(ts);
  const toolSlug = slugify(tool);
  const projectSlug = slugify(path.basename(project));
  return `${date}_${toolSlug}_${projectSlug}.md`;
}

/** Formats a Date as YYYY-MM. */
function formatMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Formats a Date as YYYY-MM-DD. */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Converts a human-readable name to a lowercase, hyphen-separated slug. */
export function slugify(s: string): string {
  s = s.toLowerCase();
  let result = '';
  for (const ch of s) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      result += ch;
    } else {
      result += '-';
    }
  }
  // Collapse consecutive hyphens.
  while (result.includes('--')) {
    result = result.replace(/--/g, '-');
  }
  return result.replace(/^-+|-+$/g, '');
}

/** Upper-cases the first character of s. */
function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Produces the full Markdown content for a session. */
function render(s: Session): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`tool: ${JSON.stringify(s.tool)}`);
  lines.push(`project: ${JSON.stringify(s.project)}`);
  lines.push(`timestamp: ${JSON.stringify(s.timestamp.toISOString())}`);
  lines.push('---');
  lines.push('');

  // Conversation turns
  for (const msg of s.messages) {
    if (msg.role === 'user') {
      lines.push('## User');
    } else if (msg.role === 'assistant') {
      lines.push('## Assistant');
    } else {
      lines.push(`## ${titleCase(msg.role)}`);
    }
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('');
  }

  return lines.join('\n');
}
