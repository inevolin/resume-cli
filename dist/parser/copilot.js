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
exports.CopilotParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Parses GitHub Copilot CLI session files stored under
 * ~/.copilot/session-state/<uuid>/events.jsonl
 */
class CopilotParser {
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
        return [{ tool: 'Copilot', project, timestamp, messages }];
    }
}
exports.CopilotParser = CopilotParser;
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