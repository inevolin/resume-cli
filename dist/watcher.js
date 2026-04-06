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
exports.run = run;
const path = __importStar(require("path"));
const generator_js_1 = require("./generator.js");
const claude_js_1 = require("./parser/claude.js");
const cursor_js_1 = require("./parser/cursor.js");
const DEBOUNCE_MS = 2000;
/** Ordered list of registered HistoryParsers. */
const parsers = [
    new claude_js_1.ClaudeParser(),
    new cursor_js_1.CursorParser(),
];
/**
 * Placeholder: file-watching is replaced by the MCP server architecture.
 * This module will be deleted in a subsequent task.
 */
function run(_cfg) {
    return Promise.reject(new Error('watcher is no longer supported; use the MCP server'));
}
/** Runs the parser + generator pipeline for a changed file. */
async function handleChange(filePath, outputDir) {
    const p = selectParser(filePath);
    if (!p)
        return;
    try {
        const sessions = await p.parse(filePath);
        if (sessions.length === 0)
            return;
        (0, generator_js_1.write)(sessions, outputDir);
        console.log(`watcher: wrote ${sessions.length} session(s) from ${path.basename(filePath)}`);
    }
    catch (err) {
        console.error(`watcher: error processing ${filePath}: ${err}`);
    }
}
/** Returns the first registered parser that can handle filePath. */
function selectParser(filePath) {
    for (const p of parsers) {
        if (p.canHandle(filePath))
            return p;
    }
    return null;
}
/**
 * Coalesces rapid events for the same path into a single action that fires
 * DEBOUNCE_MS after the last event. A version counter ensures that stale
 * callbacks are discarded.
 */
class Debouncer {
    constructor() {
        this.timers = new Map();
        this.versions = new Map();
    }
    trigger(key, fn) {
        const existing = this.timers.get(key);
        if (existing !== undefined) {
            clearTimeout(existing);
        }
        const v = (this.versions.get(key) ?? 0) + 1;
        this.versions.set(key, v);
        const timer = setTimeout(() => {
            if (this.versions.get(key) !== v) {
                // A newer trigger replaced us; skip this invocation.
                return;
            }
            this.timers.delete(key);
            this.versions.delete(key);
            fn();
        }, DEBOUNCE_MS);
        this.timers.set(key, timer);
    }
}
//# sourceMappingURL=watcher.js.map