// Package config handles loading and creating the histd configuration file.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/BurntSushi/toml"
)

// WatchEntry defines a single path to watch with its associated tool name.
type WatchEntry struct {
	// Path is the filesystem path to monitor.
	Path string `toml:"path"`
	// Tool identifies the AI tool (e.g. "claude-code", "cursor", "copilot").
	Tool string `toml:"tool"`
}

// Config is the top-level configuration loaded from ~/.histd/config.toml.
type Config struct {
	// OutputDir is where extracted Markdown sessions are written.
	OutputDir string `toml:"output_dir"`
	// Watches is the list of source paths to monitor.
	Watches []WatchEntry `toml:"watch"`
}

// DefaultConfigDir returns the path to the ~/.histd directory.
func DefaultConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}
	return filepath.Join(home, ".histd"), nil
}

// defaultOutputDir returns ~/.histd/sessions.
func defaultOutputDir() (string, error) {
	dir, err := DefaultConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "sessions"), nil
}

// defaultClaudePath returns the default path for Claude Code's project storage.
func defaultClaudePath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "projects")
}

// defaultCursorPath returns the default path for Cursor's workspace storage.
func defaultCursorPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "Cursor", "User", "workspaceStorage")
}

// DefaultConfig builds a Config populated with reasonable defaults.
func DefaultConfig() (*Config, error) {
	outDir, err := defaultOutputDir()
	if err != nil {
		return nil, err
	}
	return &Config{
		OutputDir: outDir,
		Watches: []WatchEntry{
			{Path: defaultClaudePath(), Tool: "claude-code"},
			{Path: defaultCursorPath(), Tool: "cursor"},
		},
	}, nil
}

// Load reads the config file at path, creating it with defaults if absent.
func Load(path string) (*Config, error) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return initDefault(path)
	}
	var cfg Config
	if _, err := toml.DecodeFile(path, &cfg); err != nil {
		return nil, fmt.Errorf("parsing config %s: %w", path, err)
	}
	return &cfg, nil
}

// initDefault writes a default config file and returns the resulting Config.
func initDefault(path string) (*Config, error) {
	cfg, err := DefaultConfig()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("creating config directory: %w", err)
	}
	if err := write(path, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

// write serialises cfg as TOML and saves it to path.
func write(path string, cfg *Config) error {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("creating config file %s: %w", path, err)
	}
	defer f.Close()
	enc := toml.NewEncoder(f)
	if err := enc.Encode(cfg); err != nil {
		return fmt.Errorf("encoding config: %w", err)
	}
	return nil
}
