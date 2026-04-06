import { HistoryParser } from './parser/types.js';
export interface DiscoveryEntry {
    /** Internal kebab-case identifier (e.g. 'claude-code'). Distinct from Session.tool, which is the human-readable display name set by each parser (e.g. 'Claude Code'). */
    tool: string;
    /** Directories to scan; non-existent paths are silently skipped by the caller. */
    paths: string[];
    parser: HistoryParser;
}
/**
 * Returns one DiscoveryEntry per supported AI tool.
 * Paths that do not exist on the current machine are silently skipped by
 * the caller (src/index.ts); this function only computes the expected paths.
 */
export declare function getEntries(): DiscoveryEntry[];
//# sourceMappingURL=discovery.d.ts.map