import { HistoryParser, Session } from './types.js';
/**
 * Parses Codex CLI session files stored under
 * ~/.codex/sessions/<year>/<month>/<day>/rollout-*.jsonl
 */
export declare class CodexParser implements HistoryParser {
    canHandle(filePath: string): boolean;
    parse(filePath: string): Promise<Session[]>;
}
//# sourceMappingURL=codex.d.ts.map