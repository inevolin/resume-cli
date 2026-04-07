import * as fs from 'fs';
import * as path from 'path';
/**
 * Parses Claude Code session files stored under
 * ~/.claude/projects/<project-hash>/<uuid>.jsonl
 */
export class ClaudeParser {
    /**
     * Returns true for any .jsonl file inside a directory that looks like
     * a Claude project storage path.
     */
    canHandle(filePath) {
        return filePath.endsWith('.jsonl') && filePath.includes('.claude');
    }
    /**
     * Reads a single .jsonl history file produced by Claude Code and returns
     * a slice containing exactly one Session.
     */
    async parse(filePath) {
        const data = fs.readFileSync(filePath, 'utf8');
        const messages = [];
        let sessionTime = null;
        const lines = data.split('\n');
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            if (!line)
                continue;
            let rec;
            try {
                rec = JSON.parse(line);
            }
            catch {
                // Skip malformed lines rather than failing the whole file.
                continue;
            }
            // Use the first timestamp found in any record as the session time.
            if (!sessionTime && rec.timestamp) {
                const t = new Date(rec.timestamp);
                if (!isNaN(t.getTime())) {
                    sessionTime = t;
                }
            }
            let role = rec.type ?? '';
            if (rec.message?.role) {
                role = rec.message.role;
            }
            if (role !== 'user' && role !== 'assistant') {
                continue;
            }
            const content = extractClaudeContent(rec.message?.content);
            if (!content)
                continue;
            messages.push({ role, content });
        }
        const timestamp = sessionTime ?? new Date();
        // Attempt to decode the Claude-encoded project path back to a real filesystem path.
        // Claude encodes project paths by replacing all non-alphanumeric chars with '-',
        // so "/Users/ilya/histd" becomes "-Users-ilya-histd". The decode is lossy (dots also
        // become '-'), but works correctly for typical paths without dots in directory names.
        const encodedName = path.basename(path.dirname(filePath));
        const project = encodedName.startsWith('-')
            ? '/' + encodedName.slice(1).replace(/-/g, '/')
            : path.dirname(filePath);
        const sessionId = path.basename(filePath, '.jsonl');
        return [{ tool: 'Claude Code', project, timestamp, messages, sessionId }];
    }
}
/**
 * Normalises the polymorphic content field (string or array of content blocks)
 * to a plain string.
 */
function extractClaudeContent(v) {
    if (typeof v === 'string') {
        return v.trim();
    }
    if (Array.isArray(v)) {
        const parts = [];
        for (const item of v) {
            if (item && typeof item === 'object') {
                const block = item;
                if (typeof block.text === 'string') {
                    parts.push(block.text);
                }
            }
        }
        return parts.join('\n').trim();
    }
    return '';
}
//# sourceMappingURL=claude.js.map