/** A single turn in a conversation. */
export interface Message {
  role: string; // "user" or "assistant"
  content: string;
}

/** Normalised data extracted from a proprietary history file. */
export interface Session {
  tool: string;      // e.g. "Claude Code", "Cursor"
  project: string;   // absolute path to the project directory
  timestamp: Date;   // best-effort timestamp for the session
  messages: Message[];
  sessionId?: string; // native UUID used for --resume (if available)
  filePath?: string;  // absolute path to the source history file
}

/** Implemented by every tool-specific parser. */
export interface HistoryParser {
  /** Reports whether this parser is appropriate for the given file path. */
  canHandle(filePath: string): boolean;
  /** Extracts sessions from the file at filePath. */
  parse(filePath: string): Promise<Session[]>;
}
