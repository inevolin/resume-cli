// Package parser defines the HistoryParser interface and shared types used by
// all concrete parsers.
package parser

import "time"

// Message is a single turn in a conversation.
type Message struct {
	Role    string // "user" or "assistant"
	Content string
}

// Session holds the normalised data extracted from a proprietary history file.
type Session struct {
	Tool      string    // e.g. "Claude Code", "Cursor"
	Project   string    // absolute path to the project directory
	Timestamp time.Time // best-effort timestamp for the session
	Messages  []Message
}

// HistoryParser is implemented by every tool-specific parser.
type HistoryParser interface {
	// CanHandle reports whether this parser is appropriate for the given file
	// path, based on naming conventions or directory structure.
	CanHandle(path string) bool
	// Parse extracts sessions from the file or directory at path.
	Parse(path string) ([]Session, error)
}
