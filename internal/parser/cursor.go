package parser

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go SQLite driver (no cgo required)
)

// CursorParser parses Cursor (and Windsurf) workspace storage.
//
// Cursor stores chat history in SQLite databases inside:
//
//	~/.config/Cursor/User/workspaceStorage/<hash>/
//	    state.vscdb          ← main key/value store
//
// The relevant rows in the ItemTable have keys prefixed with
// "interactive.sessions" or "workbench.panel.aichat".  The values are JSON
// blobs containing arrays of chat messages.
//
// For workspaces that only leave JSON files (e.g. Windsurf), the parser also
// reads any *.json file that contains a top-level "tabs" or "messages" array.
type CursorParser struct{}

// CanHandle returns true for state.vscdb SQLite files or chat JSON files
// inside a Cursor/Windsurf workspace storage directory.
func (p *CursorParser) CanHandle(path string) bool {
	base := filepath.Base(path)
	slash := filepath.ToSlash(path)
	if base == "state.vscdb" {
		return true
	}
	if strings.HasSuffix(base, ".json") &&
		(strings.Contains(slash, "Cursor") || strings.Contains(slash, "Windsurf")) {
		return true
	}
	return false
}

// Parse extracts chat sessions from a Cursor workspace storage file.
func (p *CursorParser) Parse(path string) ([]Session, error) {
	if strings.HasSuffix(path, ".vscdb") {
		return parseCursorDB(path)
	}
	return parseCursorJSON(path)
}

// ---- SQLite path -------------------------------------------------------

// cursorTabJSON is the shape of each tab entry stored in the DB.
type cursorTabJSON struct {
	ID        string         `json:"tabId"`
	Title     string         `json:"chatTitle"`
	Timestamp int64          `json:"lastSendTime"`
	Bubbles   []cursorBubble `json:"bubbles"`
}

type cursorBubble struct {
	Type    string `json:"type"` // "user" | "ai"
	Text    string `json:"text"`
	RawText string `json:"rawText"`
}

func parseCursorDB(path string) ([]Session, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("cursor parser: opening %s: %w", path, err)
	}
	defer db.Close()

	// Cursor stores its chat state in ItemTable with varying key prefixes.
	rows, err := db.Query(
		`SELECT value FROM ItemTable
         WHERE key LIKE 'interactive.sessions%'
            OR key LIKE 'workbench.panel.aichat%'
            OR key LIKE 'aiService.prompts%'`)
	if err != nil {
		return nil, fmt.Errorf("cursor parser: querying %s: %w", path, err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			continue
		}
		s, err := decodeCursorValue(raw, path)
		if err != nil {
			continue
		}
		sessions = append(sessions, s...)
	}
	return sessions, nil
}

// decodeCursorValue tries several known JSON shapes from Cursor's DB.
func decodeCursorValue(raw, dbPath string) ([]Session, error) {
	// Shape 1: top-level array of tab objects.
	var tabs []cursorTabJSON
	if err := json.Unmarshal([]byte(raw), &tabs); err == nil && len(tabs) > 0 {
		return tabsToSessions(tabs, dbPath), nil
	}
	// Shape 2: object with a "tabs" field.
	var wrapper struct {
		Tabs []cursorTabJSON `json:"tabs"`
	}
	if err := json.Unmarshal([]byte(raw), &wrapper); err == nil && len(wrapper.Tabs) > 0 {
		return tabsToSessions(wrapper.Tabs, dbPath), nil
	}
	return nil, fmt.Errorf("unrecognised cursor value shape")
}

func tabsToSessions(tabs []cursorTabJSON, dbPath string) []Session {
	project := filepath.Dir(filepath.Dir(dbPath))
	var sessions []Session
	for _, tab := range tabs {
		var msgs []Message
		for _, b := range tab.Bubbles {
			content := b.Text
			if content == "" {
				content = b.RawText
			}
			content = strings.TrimSpace(content)
			if content == "" {
				continue
			}
			role := "user"
			if b.Type == "ai" {
				role = "assistant"
			}
			msgs = append(msgs, Message{Role: role, Content: content})
		}
		if len(msgs) == 0 {
			continue
		}
		ts := time.Now().UTC()
		if tab.Timestamp > 0 {
			// Cursor stores milliseconds since epoch.
			ts = time.UnixMilli(tab.Timestamp).UTC()
		}
		sessions = append(sessions, Session{
			Tool:      "Cursor",
			Project:   project,
			Timestamp: ts,
			Messages:  msgs,
		})
	}
	return sessions
}

// ---- JSON path ---------------------------------------------------------

// parseCursorJSON handles plain JSON files that some Cursor/Windsurf versions
// write out.
func parseCursorJSON(path string) ([]Session, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cursor parser: reading %s: %w", path, err)
	}

	// Try decoding as an array of tab objects.
	var tabs []cursorTabJSON
	if err := json.Unmarshal(data, &tabs); err == nil && len(tabs) > 0 {
		project := filepath.Dir(filepath.Dir(path))
		return tabsToSessions(tabs, filepath.Join(project, "state.vscdb")), nil
	}

	// Try decoding as an object with a "messages" array (simpler shape).
	var simple struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(data, &simple); err == nil && len(simple.Messages) > 0 {
		var msgs []Message
		for _, m := range simple.Messages {
			if m.Content == "" {
				continue
			}
			msgs = append(msgs, Message{Role: m.Role, Content: m.Content})
		}
		project := filepath.Dir(filepath.Dir(path))
		return []Session{{
			Tool:      "Cursor",
			Project:   project,
			Timestamp: time.Now().UTC(),
			Messages:  msgs,
		}}, nil
	}

	return nil, fmt.Errorf("cursor parser: unrecognised JSON shape in %s", path)
}
