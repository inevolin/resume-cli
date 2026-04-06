package generator_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/inevolin/histd/internal/generator"
	"github.com/inevolin/histd/internal/parser"
)

func makeSession(tool, project string, ts time.Time, msgs ...parser.Message) parser.Session {
	return parser.Session{
		Tool:      tool,
		Project:   project,
		Timestamp: ts,
		Messages:  msgs,
	}
}

func TestWriteCreatesFile(t *testing.T) {
	outDir := t.TempDir()
	ts := time.Date(2026, 4, 6, 14, 30, 0, 0, time.UTC)
	sessions := []parser.Session{
		makeSession("Claude Code", "/home/dev/projects/my-app", ts,
			parser.Message{Role: "user", Content: "Hello"},
			parser.Message{Role: "assistant", Content: "Hi!"},
		),
	}
	if err := generator.Write(sessions, outDir); err != nil {
		t.Fatalf("Write() error: %v", err)
	}

	// Expect a file in the month subdirectory.
	monthDir := filepath.Join(outDir, "2026-04")
	entries, err := os.ReadDir(monthDir)
	if err != nil {
		t.Fatalf("reading month directory: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 file, got %d", len(entries))
	}
	name := entries[0].Name()
	if !strings.HasPrefix(name, "2026-04-06_") {
		t.Errorf("filename %q should start with 2026-04-06_", name)
	}
	if !strings.HasSuffix(name, ".md") {
		t.Errorf("filename %q should end with .md", name)
	}
}

func TestWriteMarkdownContent(t *testing.T) {
	outDir := t.TempDir()
	ts := time.Date(2026, 4, 6, 14, 30, 0, 0, time.UTC)
	sessions := []parser.Session{
		makeSession("Cursor", "/Users/dev/projects/backend-api", ts,
			parser.Message{Role: "user", Content: "Write a python script to reverse a string."},
			parser.Message{Role: "assistant", Content: "Here is the code:\n```python\ndef reverse_string(s):\n    return s[::-1]\n```"},
		),
	}
	if err := generator.Write(sessions, outDir); err != nil {
		t.Fatalf("Write() error: %v", err)
	}

	// Read the written file.
	monthDir := filepath.Join(outDir, "2026-04")
	entries, _ := os.ReadDir(monthDir)
	content, err := os.ReadFile(filepath.Join(monthDir, entries[0].Name()))
	if err != nil {
		t.Fatal(err)
	}
	md := string(content)

	// Check frontmatter.
	if !strings.Contains(md, "tool: \"Cursor\"") {
		t.Error("missing tool frontmatter")
	}
	if !strings.Contains(md, "project:") {
		t.Error("missing project frontmatter")
	}
	if !strings.Contains(md, "timestamp:") {
		t.Error("missing timestamp frontmatter")
	}
	// Check conversation headers.
	if !strings.Contains(md, "## User") {
		t.Error("missing ## User header")
	}
	if !strings.Contains(md, "## Assistant") {
		t.Error("missing ## Assistant header")
	}
	// Check content.
	if !strings.Contains(md, "reverse a string") {
		t.Error("user message content missing")
	}
	if !strings.Contains(md, "reverse_string") {
		t.Error("assistant message content missing")
	}
}

func TestWriteIdempotent(t *testing.T) {
	outDir := t.TempDir()
	ts := time.Date(2026, 4, 7, 9, 0, 0, 0, time.UTC)
	sessions := []parser.Session{
		makeSession("Claude Code", "/home/dev/project", ts,
			parser.Message{Role: "user", Content: "First run"},
		),
	}

	// Write twice; should not error.
	if err := generator.Write(sessions, outDir); err != nil {
		t.Fatalf("first Write() error: %v", err)
	}
	if err := generator.Write(sessions, outDir); err != nil {
		t.Fatalf("second Write() error: %v", err)
	}
}

func TestWriteMultipleSessions(t *testing.T) {
	outDir := t.TempDir()
	ts := time.Date(2026, 4, 8, 10, 0, 0, 0, time.UTC)
	sessions := []parser.Session{
		makeSession("Cursor", "/projects/alpha", ts,
			parser.Message{Role: "user", Content: "alpha question"},
		),
		makeSession("Claude Code", "/projects/beta", ts,
			parser.Message{Role: "user", Content: "beta question"},
		),
	}
	if err := generator.Write(sessions, outDir); err != nil {
		t.Fatalf("Write() error: %v", err)
	}
	monthDir := filepath.Join(outDir, "2026-04")
	entries, _ := os.ReadDir(monthDir)
	if len(entries) != 2 {
		t.Errorf("expected 2 files, got %d", len(entries))
	}
}
