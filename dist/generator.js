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
exports.write = write;
exports.slugify = slugify;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Converts each session to a Markdown file and saves it under outputDir using:
 *   <outputDir>/<YYYY-MM>/<YYYY-MM-DD>_<tool>_<project-base>.md
 *
 * Existing files are overwritten so that re-runs are idempotent.
 */
function write(sessions, outputDir) {
    for (const s of sessions) {
        writeSession(s, outputDir);
    }
}
function writeSession(s, outputDir) {
    const ts = s.timestamp ?? new Date();
    const monthDir = path.join(outputDir, formatMonth(ts));
    fs.mkdirSync(monthDir, { recursive: true });
    const filename = buildFilename(ts, s.tool, s.project);
    const dest = path.join(monthDir, filename);
    const content = render(s);
    fs.writeFileSync(dest, content, 'utf8');
}
/** Produces a consistent, filesystem-safe file name. */
function buildFilename(ts, tool, project) {
    const date = formatDate(ts);
    const toolSlug = slugify(tool);
    const projectSlug = slugify(path.basename(project));
    return `${date}_${toolSlug}_${projectSlug}.md`;
}
/** Formats a Date as YYYY-MM. */
function formatMonth(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
/** Formats a Date as YYYY-MM-DD. */
function formatDate(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** Converts a human-readable name to a lowercase, hyphen-separated slug. */
function slugify(s) {
    s = s.toLowerCase();
    let result = '';
    for (const ch of s) {
        if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
            result += ch;
        }
        else {
            result += '-';
        }
    }
    // Collapse consecutive hyphens.
    while (result.includes('--')) {
        result = result.replace(/--/g, '-');
    }
    return result.replace(/^-+|-+$/g, '');
}
/** Upper-cases the first character of s. */
function titleCase(s) {
    if (!s)
        return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
/** Produces the full Markdown content for a session. */
function render(s) {
    const lines = [];
    // YAML frontmatter
    lines.push('---');
    lines.push(`tool: ${JSON.stringify(s.tool)}`);
    lines.push(`project: ${JSON.stringify(s.project)}`);
    lines.push(`timestamp: ${JSON.stringify(s.timestamp.toISOString())}`);
    lines.push('---');
    lines.push('');
    // Conversation turns
    for (const msg of s.messages) {
        if (msg.role === 'user') {
            lines.push('## User');
        }
        else if (msg.role === 'assistant') {
            lines.push('## Assistant');
        }
        else {
            lines.push(`## ${titleCase(msg.role)}`);
        }
        lines.push('');
        lines.push(msg.content);
        lines.push('');
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=generator.js.map