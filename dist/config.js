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
exports.defaultConfigDir = defaultConfigDir;
exports.defaultConfig = defaultConfig;
exports.load = load;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/** Returns the path to the ~/.histd directory. */
function defaultConfigDir() {
    return path.join(os.homedir(), '.histd');
}
/** Returns ~/.histd/sessions. */
function defaultOutputDir() {
    return path.join(defaultConfigDir(), 'sessions');
}
/** Returns the default path for Claude Code's project storage. */
function defaultClaudePath() {
    return path.join(os.homedir(), '.claude', 'projects');
}
/** Returns the default path for Cursor's workspace storage. */
function defaultCursorPath() {
    return path.join(os.homedir(), '.config', 'Cursor', 'User', 'workspaceStorage');
}
/** Builds a Config populated with reasonable defaults. */
function defaultConfig() {
    return {
        output_dir: defaultOutputDir(),
        watch: [
            { path: defaultClaudePath(), tool: 'claude-code' },
            { path: defaultCursorPath(), tool: 'cursor' },
        ],
    };
}
/** Serialises cfg as JSON and saves it to filePath. */
function writeConfig(filePath, cfg) {
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf8');
}
/** Writes a default config file and returns the resulting Config. */
function initDefault(filePath) {
    const cfg = defaultConfig();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeConfig(filePath, cfg);
    return cfg;
}
/** Reads the config file at filePath, creating it with defaults if absent. */
function load(filePath) {
    if (!fs.existsSync(filePath)) {
        return initDefault(filePath);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
}
//# sourceMappingURL=config.js.map