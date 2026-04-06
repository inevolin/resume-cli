// Package generator converts parsed Sessions into Markdown files with YAML
// frontmatter, writing them to the configured output directory.
package generator

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/inevolin/histd/internal/parser"
)

// Write converts each session in sessions to a Markdown file and saves it
// under outputDir using the layout:
//
//	<outputDir>/<YYYY-MM>/<YYYY-MM-DD>_<tool>_<project-base>.md
//
// Existing files are overwritten so that re-runs are idempotent.
func Write(sessions []parser.Session, outputDir string) error {
	for _, s := range sessions {
		if err := writeSession(s, outputDir); err != nil {
			return err
		}
	}
	return nil
}

// writeSession renders a single session as Markdown and writes it to disk.
func writeSession(s parser.Session, outputDir string) error {
	ts := s.Timestamp
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	monthDir := filepath.Join(outputDir, ts.Format("2006-01"))
	if err := os.MkdirAll(monthDir, 0o755); err != nil {
		return fmt.Errorf("generator: creating month directory: %w", err)
	}

	filename := buildFilename(ts, s.Tool, s.Project)
	dest := filepath.Join(monthDir, filename)

	content := render(s)
	if err := os.WriteFile(dest, []byte(content), 0o644); err != nil {
		return fmt.Errorf("generator: writing %s: %w", dest, err)
	}
	return nil
}

// buildFilename produces a consistent, filesystem-safe file name.
// Format: <YYYY-MM-DD>_<tool-slug>_<project-slug>.md
func buildFilename(ts time.Time, tool, project string) string {
	date := ts.Format("2006-01-02")
	toolSlug := slugify(tool)
	projectSlug := slugify(filepath.Base(project))
	return fmt.Sprintf("%s_%s_%s.md", date, toolSlug, projectSlug)
}

// titleCase upper-cases the first rune of s.
func titleCase(s string) string {
	if s == "" {
		return s
	}
	runes := []rune(s)
	if runes[0] >= 'a' && runes[0] <= 'z' {
		runes[0] -= 32
	}
	return string(runes)
}

// slugify converts a human-readable name to a lowercase, hyphen-separated
// slug suitable for use in a filename.
func slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-', r == '_', r == '.':
			b.WriteRune('-')
		default:
			b.WriteRune('-')
		}
	}
	// Collapse consecutive hyphens.
	result := s
	for strings.Contains(result, "--") {
		result = strings.ReplaceAll(result, "--", "-")
	}
	// Redo with the cleaned slug from the builder.
	raw := b.String()
	for strings.Contains(raw, "--") {
		raw = strings.ReplaceAll(raw, "--", "-")
	}
	return strings.Trim(raw, "-")
}

// render produces the full Markdown content for a session.
func render(s parser.Session) string {
	var sb strings.Builder

	// YAML frontmatter
	sb.WriteString("---\n")
	sb.WriteString(fmt.Sprintf("tool: %q\n", s.Tool))
	sb.WriteString(fmt.Sprintf("project: %q\n", s.Project))
	sb.WriteString(fmt.Sprintf("timestamp: %q\n", s.Timestamp.UTC().Format(time.RFC3339)))
	sb.WriteString("---\n\n")

	// Conversation turns
	for _, msg := range s.Messages {
		switch msg.Role {
		case "user":
			sb.WriteString("## User\n")
		case "assistant":
			sb.WriteString("## Assistant\n")
		default:
			sb.WriteString(fmt.Sprintf("## %s\n", titleCase(msg.Role)))
		}
		sb.WriteString("\n")
		sb.WriteString(msg.Content)
		sb.WriteString("\n\n")
	}

	return sb.String()
}
