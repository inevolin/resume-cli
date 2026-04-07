import * as fs from 'fs';
import * as path from 'path';
/**
 * Parses GitHub Copilot CLI session files stored under
 * ~/.copilot/session-state/<uuid>/events.jsonl
 */
export class CopilotParser {
    canHandle(filePath) {
        return (filePath.endsWith('events.jsonl') &&
            filePath.includes(`${path.sep}.copilot${path.sep}session-state${path.sep}`));
    }
    async parse(filePath) {
        const data = fs.readFileSync(filePath, 'utf8');
        const messages = [];
        let sessionTime = null;
        let projectCwd = null;
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
            if (rec.type === 'session.start' && rec.data) {
                if (!sessionTime) {
                    const raw = rec.data.startTime ?? rec.timestamp;
                    if (raw) {
                        const t = new Date(raw);
                        if (!isNaN(t.getTime()))
                            sessionTime = t;
                    }
                }
                if (!projectCwd && rec.data.context?.cwd) {
                    projectCwd = rec.data.context.cwd;
                }
                continue;
            }
            if (rec.type !== 'user.message' && rec.type !== 'assistant.message')
                continue;
            const role = rec.type === 'user.message' ? 'user' : 'assistant';
            const raw = rec.data?.content ?? rec.data?.transformedContent;
            const content = extractContent(raw);
            if (!content)
                continue;
            messages.push({ role, content });
        }
        if (messages.length === 0)
            return [];
        const timestamp = sessionTime ?? new Date();
        const project = projectCwd ?? path.dirname(filePath);
        return [{ tool: 'Copilot', project, timestamp, messages, sessionId: path.basename(path.dirname(filePath)) }];
    }
}
function extractContent(v) {
    if (typeof v === 'string')
        return v.trim();
    if (v && typeof v === 'object') {
        const obj = v;
        if (typeof obj['content'] === 'string')
            return obj['content'].trim();
        if (typeof obj['text'] === 'string')
            return obj['text'].trim();
    }
    return '';
}
//# sourceMappingURL=copilot.js.map