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
exports.getEntries = getEntries;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const claude_js_1 = require("./parser/claude.js");
const cursor_js_1 = require("./parser/cursor.js");
const codex_js_1 = require("./parser/codex.js");
const copilot_js_1 = require("./parser/copilot.js");
/**
 * Returns one DiscoveryEntry per supported AI tool.
 * Paths that do not exist on the current machine are silently skipped by
 * the caller (src/index.ts); this function only computes the expected paths.
 */
function getEntries() {
    const home = os.homedir();
    const mac = process.platform === 'darwin';
    // Windows is not currently in scope; Windows paths (%APPDATA%\...) would need a third branch.
    const appSupport = (app) => mac
        ? path.join(home, 'Library', 'Application Support', app, 'User', 'workspaceStorage')
        : path.join(home, '.config', app, 'User', 'workspaceStorage');
    return [
        {
            tool: 'claude-code',
            paths: [path.join(home, '.claude', 'projects')],
            parser: new claude_js_1.ClaudeParser(),
        },
        {
            tool: 'cursor',
            paths: [appSupport('Cursor')],
            parser: new cursor_js_1.CursorParser(),
        },
        {
            tool: 'copilot',
            paths: [path.join(home, '.copilot', 'session-state')],
            parser: new copilot_js_1.CopilotParser(),
        },
        {
            tool: 'codex',
            paths: [path.join(home, '.codex', 'sessions')],
            parser: new codex_js_1.CodexParser(),
        },
    ];
}
//# sourceMappingURL=discovery.js.map