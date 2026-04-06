import { HistoryParser, Session } from './types.js';
/**
 * Parses GitHub Copilot CLI session files stored under
 * ~/.copilot/session-state/<uuid>/events.jsonl
 */
export declare class CopilotParser implements HistoryParser {
    canHandle(filePath: string): boolean;
    parse(filePath: string): Promise<Session[]>;
}
//# sourceMappingURL=copilot.d.ts.map