import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
// ─── Synthetic file writers (exported for testing) ───────────────────────────
export function writeSyntheticClaude(session, targetDir) {
    const uuid = crypto.randomUUID();
    fs.mkdirSync(targetDir, { recursive: true });
    const lines = [];
    let prevUuid = null;
    for (const msg of session.messages) {
        const recUuid = crypto.randomUUID();
        const rec = {
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
    fs.writeFileSync(path.join(targetDir, `${uuid}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    return uuid;
}
export function writeSyntheticCodex(session, targetDir) {
    const uuid = crypto.randomUUID();
    const now = new Date();
    const d = now;
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dir = path.join(targetDir, yyyy, mm, dd);
    fs.mkdirSync(dir, { recursive: true });
    // Codex filename format (no milliseconds): rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    const filePath = path.join(dir, `rollout-${yyyy}-${mm}-${dd}T${hh}-${min}-${sec}-${uuid}.jsonl`);
    const lines = [
        {
            type: 'session_meta',
            timestamp: now.toISOString(),
            payload: {
                id: uuid,
                timestamp: now.toISOString(),
                cwd: session.project,
                originator: 'codex-tui',
                cli_version: '0.0.0',
                source: 'cli',
                model_provider: 'openai',
            },
        },
    ];
    for (const msg of session.messages) {
        lines.push({
            type: 'response_item',
            timestamp: now.toISOString(),
            payload: {
                role: msg.role,
                content: msg.content,
            },
        });
    }
    fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    // Register in Codex's SQLite state database so `codex resume <uuid>` can find it
    const dbPath = path.join(os.homedir(), '.codex', 'state_5.sqlite');
    const firstMsg = session.messages.find((m) => m.role === 'user')?.content ?? '';
    const title = firstMsg.slice(0, 100).replace(/'/g, "''");
    const cwd = session.project.replace(/'/g, "''");
    const nowMs = now.getTime();
    const sandboxPolicy = '{"type":"workspace-write","writable_roots":[],"network_access":false}';
    registerCodexSession(dbPath, uuid, filePath, cwd, title, sandboxPolicy, nowMs);
    return { uuid, filePath };
}
function registerCodexSession(dbPath, uuid, rolloutPath, cwd, title, sandboxPolicy, nowMs) {
    // Try node:sqlite (Node 22+)
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(dbPath);
        const stmt = db.prepare(`INSERT OR IGNORE INTO threads
        (id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,
         sandbox_policy, approval_mode, first_user_message, cli_version,
         tokens_used, has_user_event, archived, memory_mode)
       VALUES (?, ?, ?, ?, 'cli', 'openai', ?, ?, ?, 'on-request', ?, '0.0.0', 0, 0, 0, 'enabled')`);
        stmt.run(uuid, rolloutPath, nowMs, nowMs, cwd, title, sandboxPolicy, title);
        db.close();
        return;
    }
    catch {
        // Node < 22 — fall back to sqlite3 CLI
    }
    try {
        const sql = [
            `INSERT OR IGNORE INTO threads`,
            `(id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,`,
            ` sandbox_policy, approval_mode, first_user_message, cli_version,`,
            ` tokens_used, has_user_event, archived, memory_mode)`,
            `VALUES ('${uuid}', '${rolloutPath.replace(/'/g, "''")}', ${nowMs}, ${nowMs},`,
            ` 'cli', 'openai', '${cwd}', '${title}',`,
            ` '${sandboxPolicy}', 'on-request', '${title}', '0.0.0', 0, 0, 0, 'enabled');`,
        ].join(' ');
        childProcess.execSync(`sqlite3 "${dbPath}" "${sql}"`, { stdio: 'ignore' });
    }
    catch {
        // sqlite3 CLI not available — session file is written but won't appear in `codex resume` picker
        process.stderr.write('resume-cli: warning: could not register session in Codex DB (requires Node 22+ or sqlite3 CLI)\n');
    }
}
export function writeSyntheticCopilot(session, targetDir) {
    const uuid = crypto.randomUUID();
    const dir = path.join(targetDir, uuid);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
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
    fs.writeFileSync(path.join(dir, 'events.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    return uuid;
}
// ─── Launcher ────────────────────────────────────────────────────────────────
export function launch(session, targetTool) {
    const home = os.homedir();
    const isSameTool = normalizeTool(session.tool) === normalizeTool(targetTool);
    let resumeId;
    if (isSameTool) {
        if (!session.sessionId) {
            throw new Error(`Cannot resume ${session.tool} session: session ID is missing. Try cross-tool resume instead.`);
        }
        resumeId = session.sessionId;
    }
    else {
        resumeId = createSyntheticSession(session, targetTool, home);
    }
    const [cmd, args] = buildCommand(targetTool, resumeId);
    childProcess.spawn(cmd, args, { stdio: 'inherit', detached: false });
    return resumeId;
}
function normalizeTool(tool) {
    return tool.toLowerCase().replace(/\s+/g, '');
}
function createSyntheticSession(session, targetTool, home) {
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
function buildCommand(targetTool, resumeId) {
    const norm = normalizeTool(targetTool);
    if (norm === 'claudecode')
        return ['claude', ['--resume', resumeId]];
    if (norm === 'codex')
        return ['codex', ['resume', resumeId]];
    if (norm === 'copilot')
        return ['gh', ['copilot', '--', `--resume=${resumeId}`]];
    throw new Error(`Unknown target tool: ${targetTool}`);
}
//# sourceMappingURL=launcher.js.map