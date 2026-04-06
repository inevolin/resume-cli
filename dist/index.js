#!/usr/bin/env node
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
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const discovery_js_1 = require("./discovery.js");
const server = new mcp_js_1.McpServer({ name: 'histd', version: '1.0.0' });
server.tool('get_recent_context', 'Retrieve recent AI coding session history for a project to restore context when switching between AI tools (Claude Code, Cursor, Copilot, Codex).', {
    project_path: zod_1.z.string().describe('Absolute path to the project directory (e.g. /Users/you/my-project)'),
    limit: zod_1.z.number().int().min(1).max(50).optional().describe('Maximum number of sessions to return (default: 5)'),
}, async ({ project_path, limit = 5 }) => {
    const sessions = await collectSessions(project_path, limit);
    if (sessions.length === 0) {
        return {
            content: [{ type: 'text', text: `No session history found for project: ${project_path}` }],
        };
    }
    return {
        content: [{ type: 'text', text: formatSessions(sessions) }],
    };
});
async function collectSessions(projectPath, limit) {
    const entries = (0, discovery_js_1.getEntries)();
    const all = [];
    for (const entry of entries) {
        for (const dir of entry.paths) {
            if (!fs.existsSync(dir))
                continue;
            const files = walkDir(dir);
            for (const file of files) {
                if (!entry.parser.canHandle(file))
                    continue;
                try {
                    const sessions = await entry.parser.parse(file);
                    for (const s of sessions) {
                        if (matchesProject(s.project, projectPath)) {
                            all.push(s);
                        }
                    }
                }
                catch (err) {
                    // Skip unreadable or unparseable files; log to stderr for debugging
                    process.stderr.write(`histd: skipping ${file}: ${err}\n`);
                }
            }
        }
    }
    return all
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
}
/**
 * Returns true when the session's recorded project path refers to the same
 * project as queryPath. Handles two cases:
 *
 *   1. Exact match: session.project === queryPath
 *   2. Claude encoded path: Claude stores ~/.claude/projects/-Users-ilya-my-proj for
 *      /Users/ilya/my-proj by replacing the leading / with - and every subsequent /
 *      with -. We reverse that encoding and compare.
 */
function matchesProject(sessionProject, queryPath) {
    if (sessionProject === queryPath)
        return true;
    const sessionBase = path.basename(sessionProject);
    // Claude encodes project paths by replacing every non-alphanumeric character
    // with '-', e.g. /Users/ilya/histd → -Users-ilya-histd,
    //                /tmp/foo.bar-baz  → -tmp-foo-bar-baz.
    // Re-encode queryPath the same way and compare directly.
    if (sessionBase.startsWith('-')) {
        const encoded = queryPath.replace(/[^a-zA-Z0-9]/g, '-');
        if (sessionBase === encoded)
            return true;
    }
    return false;
}
/** Recursively collects all file paths under dir. */
function walkDir(dir) {
    const results = [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return results;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full));
        }
        else if (entry.isFile()) {
            results.push(full);
        }
    }
    return results;
}
function formatSessions(sessions) {
    return sessions
        .map((s, i) => {
        const header = `[${i + 1}] ${s.tool} — ${s.timestamp.toISOString()} — ${s.project}`;
        const body = s.messages
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
        return `${header}\n${body}`;
    })
        .join('\n\n');
}
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    process.stderr.write(`histd: fatal: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map