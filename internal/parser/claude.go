package parser

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ClaudeParser parses Claude Code session files stored under
// ~/.claude/projects/<project-hash>/
//
// Claude Code stores its history in JSONL files where each line is a JSON
// object representing one conversation turn.  The directory layout is:
//
//	~/.claude/projects/<hash>/
//	    <uuid>.jsonl
//
// Each JSONL record has at least the following shape (simplified):
//
//	{"type":"user","message":{"content":"..."},"timestamp":"..."}
//	{"type":"assistant","message":{"content":"..."},"timestamp":"..."}
type ClaudeParser struct{}

// claudeRecord represents one line in a Claude Code JSONL history file.
type claudeRecord struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
	Message   struct {
		Role    string `json:"role"`
		Content any    `json:"content"` // string or []contentBlock
	} `json:"message"`
}

// contentBlock handles the structured content array format Claude sometimes
// uses instead of a plain string.
type contentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// CanHandle returns true for any .jsonl file inside a directory that looks
// like a Claude project storage path.
func (p *ClaudeParser) CanHandle(path string) bool {
	return strings.HasSuffix(path, ".jsonl") &&
		strings.Contains(filepath.ToSlash(path), ".claude")
}

// Parse reads a single .jsonl history file produced by Claude Code and
// returns a slice containing exactly one Session (Claude stores one
// conversation per file).
func (p *ClaudeParser) Parse(path string) ([]Session, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("claude parser: reading %s: %w", path, err)
	}

	var messages []Message
	var sessionTime time.Time

	for lineNum, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var rec claudeRecord
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			// Skip malformed lines rather than failing the whole file.
			continue
		}

		// Attempt to parse the earliest timestamp as the session time.
		if lineNum == 0 && rec.Timestamp != "" {
			if t, err := time.Parse(time.RFC3339, rec.Timestamp); err == nil {
				sessionTime = t
			}
		}

		role := rec.Type
		if rec.Message.Role != "" {
			role = rec.Message.Role
		}
		if role != "user" && role != "assistant" {
			continue
		}

		content := extractClaudeContent(rec.Message.Content)
		if content == "" {
			continue
		}
		messages = append(messages, Message{Role: role, Content: content})
	}

	if sessionTime.IsZero() {
		sessionTime = time.Now().UTC()
	}

	// Derive project path from the grandparent directory name.  The directory
	// layout is ~/.claude/projects/<encoded-project-path>/<uuid>.jsonl.
	project := filepath.Dir(filepath.Dir(path))

	session := Session{
		Tool:      "Claude Code",
		Project:   project,
		Timestamp: sessionTime,
		Messages:  messages,
	}
	return []Session{session}, nil
}

// extractClaudeContent normalises the polymorphic content field (string or
// array of content blocks) to a plain string.
func extractClaudeContent(v any) string {
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val)
	case []any:
		var parts []string
		for _, item := range val {
			if m, ok := item.(map[string]any); ok {
				if t, ok := m["text"].(string); ok {
					parts = append(parts, t)
				}
			}
		}
		return strings.TrimSpace(strings.Join(parts, "\n"))
	}
	return ""
}
