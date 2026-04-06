"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Parses Claude Code session files stored under
 * ~/.claude/projects/<project-hash>/<uuid>.jsonl
 */
class ClaudeParser {
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
        // Derive project path from the immediate parent directory (the encoded project dir).
        // Layout: ~/.claude/projects/<encoded-project-path>/<uuid>.jsonl
        const project = path.dirname(filePath);
        return [{ tool: 'Claude Code', project, timestamp, messages }];
    }
}
exports.ClaudeParser = ClaudeParser;
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