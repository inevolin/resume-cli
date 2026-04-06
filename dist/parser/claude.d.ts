import { HistoryParser, Session } from './types.js';
/**
 * Parses Claude Code session files stored under
 * ~/.claude/projects/<project-hash>/<uuid>.jsonl
 */
export declare class ClaudeParser implements HistoryParser {
    /**
     * Returns true for any .jsonl file inside a directory that looks like
     * a Claude project storage path.
     */
    canHandle(filePath: string): boolean;
    /**
     * Reads a single .jsonl history file produced by Claude Code and returns
     * a slice containing exactly one Session.
     */
    parse(filePath: string): Promise<Session[]>;
}
//# sourceMappingURL=claude.d.ts.map