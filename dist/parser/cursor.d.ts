import { HistoryParser, Session } from './types.js';
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
export declare class CursorParser implements HistoryParser {
    canHandle(filePath: string): boolean;
    parse(filePath: string): Promise<Session[]>;
}
//# sourceMappingURL=cursor.d.ts.map