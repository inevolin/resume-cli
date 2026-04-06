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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
/**
 * Parses Cursor (and Windsurf) workspace storage.
 *
 * Cursor stores chat history in SQLite databases inside:
 *   ~/.config/Cursor/User/workspaceStorage/<hash>/state.vscdb
 *
 * The relevant rows in ItemTable have keys prefixed with
 * "interactive.sessions" or "workbench.panel.aichat".
 *
 * For workspaces that only leave JSON files (e.g. Windsurf), the parser also
 * reads any *.json file that contains a top-level "tabs" or "messages" array.
 */
class CursorParser {
    canHandle(filePath) {
        const base = path.basename(filePath);
        if (base === 'state.vscdb')
            return true;
        if (base.endsWith('.json') &&
            (filePath.includes('Cursor') || filePath.includes('Windsurf'))) {
            return true;
        }
        return false;
    }
    async parse(filePath) {
        if (filePath.endsWith('.vscdb')) {
            return parseCursorDB(filePath);
        }
        return parseCursorJSON(filePath);
    }
}
exports.CursorParser = CursorParser;
// ---- SQLite path -------------------------------------------------------
function parseCursorDB(filePath) {
    let db;
    try {
        db = new better_sqlite3_1.default(filePath, { readonly: true });
    }
    catch {
        throw new Error(`cursor parser: opening ${filePath}`);
    }
    let rows;
    try {
        rows = db
            .prepare(`SELECT value FROM ItemTable
         WHERE key LIKE 'interactive.sessions%'
            OR key LIKE 'workbench.panel.aichat%'
            OR key LIKE 'aiService.prompts%'`)
            .all();
    }
    catch {
        db.close();
        throw new Error(`cursor parser: querying ${filePath}`);
    }
    db.close();
    const sessions = [];
    for (const row of rows) {
        try {
            const s = decodeCursorValue(row.value, filePath);
            sessions.push(...s);
        }
        catch {
            // Skip unrecognised shapes
        }
    }
    return sessions;
}
/** Tries several known JSON shapes from Cursor's DB. */
function decodeCursorValue(raw, dbPath) {
    // Shape 1: top-level array of tab objects.
    try {
        const tabs = JSON.parse(raw);
        if (Array.isArray(tabs) && tabs.length > 0) {
            return tabsToSessions(tabs, dbPath);
        }
    }
    catch {
        // fall through
    }
    // Shape 2: object with a "tabs" field.
    try {
        const wrapper = JSON.parse(raw);
        if (wrapper.tabs && Array.isArray(wrapper.tabs) && wrapper.tabs.length > 0) {
            return tabsToSessions(wrapper.tabs, dbPath);
        }
    }
    catch {
        // fall through
    }
    throw new Error('unrecognised cursor value shape');
}
function tabsToSessions(tabs, dbPath) {
    const project = path.dirname(path.dirname(dbPath));
    const sessions = [];
    for (const tab of tabs) {
        const msgs = [];
        for (const b of tab.bubbles ?? []) {
            let content = b.text ?? '';
            if (!content)
                content = b.rawText ?? '';
            content = content.trim();
            if (!content)
                continue;
            const role = b.type === 'ai' ? 'assistant' : 'user';
            msgs.push({ role, content });
        }
        if (msgs.length === 0)
            continue;
        let timestamp = new Date();
        if (tab.lastSendTime && tab.lastSendTime > 0) {
            // Cursor stores milliseconds since epoch.
            timestamp = new Date(tab.lastSendTime);
        }
        sessions.push({ tool: 'Cursor', project, timestamp, messages: msgs });
    }
    return sessions;
}
// ---- JSON path ---------------------------------------------------------
function parseCursorJSON(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(data);
    }
    catch {
        throw new Error(`cursor parser: invalid JSON in ${filePath}`);
    }
    // Try decoding as an array of tab objects.
    if (Array.isArray(parsed) && parsed.length > 0) {
        const project = path.dirname(path.dirname(filePath));
        const fakePath = path.join(project, 'state.vscdb');
        return tabsToSessions(parsed, fakePath);
    }
    // Try decoding as an object with a "messages" array (simpler shape).
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed;
        if (obj.messages && Array.isArray(obj.messages) && obj.messages.length > 0) {
            const msgs = [];
            for (const m of obj.messages) {
                if (!m.content)
                    continue;
                msgs.push({ role: m.role ?? 'user', content: m.content });
            }
            const project = path.dirname(path.dirname(filePath));
            return [{ tool: 'Cursor', project, timestamp: new Date(), messages: msgs }];
        }
    }
    throw new Error(`cursor parser: unrecognised JSON shape in ${filePath}`);
}
//# sourceMappingURL=cursor.js.map