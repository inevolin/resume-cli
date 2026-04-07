import * as fs from 'fs';
import * as path from 'path';
/**
 * Parses Codex CLI session files stored under
 * ~/.codex/sessions/<year>/<month>/<day>/rollout-*.jsonl
 */
export class CodexParser {
    canHandle(filePath) {
        return (filePath.endsWith('.jsonl') &&
            filePath.includes(`${path.sep}.codex${path.sep}sessions${path.sep}`));
    }
    async parse(filePath) {
        const data = fs.readFileSync(filePath, 'utf8');
        const messages = [];
        let sessionTime = null;
        let projectCwd = null;
        let sessionId = null;
        for (const line of data.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            let rec;
            try {
                rec = JSON.parse(trimmed);
            }
            catch {
                continue;
            }
            // session_meta carries the canonical start time and working directory.
            if (rec.type === 'session_meta' && rec.payload) {
                if (!sessionTime) {
                    const raw = rec.payload.timestamp ?? rec.timestamp;
                    if (raw) {
                        const t = new Date(raw);
                        if (!isNaN(t.getTime()))
                            sessionTime = t;
                    }
                }
                if (!projectCwd && rec.payload.cwd) {
                    projectCwd = rec.payload.cwd;
                }
                if (!sessionId && rec.payload.id) {
                    sessionId = rec.payload.id;
                }
            }
            if (rec.type !== 'response_item')
                continue;
            const payload = rec.payload;
            if (!payload)
                continue;
            const role = typeof payload.role === 'string' ? payload.role : '';
            if (role !== 'user' && role !== 'assistant')
                continue;
            const content = extractContent(payload.content);
            if (!content)
                continue;
            messages.push({ role, content });
        }
        if (messages.length === 0)
            return [];
        const timestamp = sessionTime ?? fileTimestamp(filePath);
        const project = projectCwd ?? path.dirname(filePath);
        return [{ tool: 'Codex', project, timestamp, messages, sessionId: sessionId ?? undefined }];
    }
}
function extractContent(v) {
    if (typeof v === 'string')
        return v.trim();
    if (Array.isArray(v)) {
        return v
            .filter((b) => b != null && typeof b === 'object' && typeof b.text === 'string')
            .map((b) => b.text)
            .join('\n')
            .trim();
    }
    return '';
}
function fileTimestamp(filePath) {
    try {
        return fs.statSync(filePath).mtime;
    }
    catch {
        return new Date();
    }
}
//# sourceMappingURL=codex.js.map