package parser_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/inevolin/histd/internal/parser"
)

// ---- ClaudeParser -------------------------------------------------------

func TestClaudeCanHandle(t *testing.T) {
	p := &parser.ClaudeParser{}
	cases := []struct {
		path string
		want bool
	}{
		{"/home/user/.claude/projects/abc123/session.jsonl", true},
		{"/home/user/.claude/projects/abc123/session.json", false},
		{"/home/user/cursor/state.vscdb", false},
	}
	for _, c := range cases {
		if got := p.CanHandle(c.path); got != c.want {
			t.Errorf("CanHandle(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}

func TestClaudeParse(t *testing.T) {
	dir := t.TempDir()
	// Create a fake Claude JSONL history file.
	lines := []map[string]any{
		{
			"type":      "user",
			"timestamp": "2026-04-06T10:00:00Z",
			"message":   map[string]any{"role": "user", "content": "Hello, world!"},
		},
		{
			"type":      "assistant",
			"timestamp": "2026-04-06T10:00:05Z",
			"message":   map[string]any{"role": "assistant", "content": "Hi there!"},
		},
	}
	var sb strings.Builder
	for _, l := range lines {
		b, _ := json.Marshal(l)
		sb.Write(b)
		sb.WriteString("\n")
	}
	path := filepath.Join(dir, "session.jsonl")
	if err := os.WriteFile(path, []byte(sb.String()), 0o644); err != nil {
		t.Fatal(err)
	}

	p := &parser.ClaudeParser{}
	sessions, err := p.Parse(path)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	s := sessions[0]
	if s.Tool != "Claude Code" {
		t.Errorf("Tool = %q, want %q", s.Tool, "Claude Code")
	}
	if len(s.Messages) != 2 {
		t.Errorf("expected 2 messages, got %d", len(s.Messages))
	}
	if s.Messages[0].Role != "user" {
		t.Errorf("first message role = %q, want %q", s.Messages[0].Role, "user")
	}
	if s.Messages[0].Content != "Hello, world!" {
		t.Errorf("first message content = %q", s.Messages[0].Content)
	}
}

func TestClaudeParseStructuredContent(t *testing.T) {
	dir := t.TempDir()
	// Content as array of content blocks.
	line := map[string]any{
		"type": "user",
		"message": map[string]any{
			"role": "user",
			"content": []map[string]any{
				{"type": "text", "text": "Part one"},
				{"type": "text", "text": "Part two"},
			},
		},
	}
	b, _ := json.Marshal(line)
	path := filepath.Join(dir, "structured.jsonl")
	if err := os.WriteFile(path, append(b, '\n'), 0o644); err != nil {
		t.Fatal(err)
	}

	p := &parser.ClaudeParser{}
	sessions, err := p.Parse(path)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}
	if len(sessions) != 1 || len(sessions[0].Messages) != 1 {
		t.Fatalf("unexpected sessions/messages: %+v", sessions)
	}
	content := sessions[0].Messages[0].Content
	if !strings.Contains(content, "Part one") || !strings.Contains(content, "Part two") {
		t.Errorf("content %q should contain both parts", content)
	}
}

// ---- CursorParser -------------------------------------------------------

func TestCursorCanHandle(t *testing.T) {
	p := &parser.CursorParser{}
	cases := []struct {
		path string
		want bool
	}{
		{"/home/user/.config/Cursor/User/workspaceStorage/abc/state.vscdb", true},
		{"/home/user/.config/Cursor/chat.json", true},
		{"/home/user/.claude/projects/abc/session.jsonl", false},
	}
	for _, c := range cases {
		if got := p.CanHandle(c.path); got != c.want {
			t.Errorf("CanHandle(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}

func TestCursorParseJSON(t *testing.T) {
	dir := t.TempDir()
	// Write a simple Cursor JSON history file.
	tabs := []map[string]any{
		{
			"tabId":        "tab-1",
			"chatTitle":    "Test chat",
			"lastSendTime": int64(1744000000000),
			"bubbles": []map[string]any{
				{"type": "user", "text": "What is Go?"},
				{"type": "ai", "text": "Go is a statically typed language."},
			},
		},
	}
	b, _ := json.Marshal(tabs)
	path := filepath.Join(dir, "Cursor", "chat.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatal(err)
	}

	p := &parser.CursorParser{}
	sessions, err := p.Parse(path)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	s := sessions[0]
	if s.Tool != "Cursor" {
		t.Errorf("Tool = %q, want %q", s.Tool, "Cursor")
	}
	if len(s.Messages) != 2 {
		t.Errorf("expected 2 messages, got %d", len(s.Messages))
	}
	if s.Messages[1].Role != "assistant" {
		t.Errorf("second message role = %q, want assistant", s.Messages[1].Role)
	}
}
