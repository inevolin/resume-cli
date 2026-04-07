/** A single turn in a conversation. */
export interface Message {
    role: string;
    content: string;
}
/** Normalised data extracted from a proprietary history file. */
export interface Session {
    tool: string;
    project: string;
    timestamp: Date;
    messages: Message[];
    sessionId?: string;
}
/** Implemented by every tool-specific parser. */
export interface HistoryParser {
    /** Reports whether this parser is appropriate for the given file path. */
    canHandle(filePath: string): boolean;
    /** Extracts sessions from the file at filePath. */
    parse(filePath: string): Promise<Session[]>;
}
//# sourceMappingURL=types.d.ts.map