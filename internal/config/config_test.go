package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/inevolin/histd/internal/config"
)

func TestDefaultConfig(t *testing.T) {
	cfg, err := config.DefaultConfig()
	if err != nil {
		t.Fatalf("DefaultConfig() error: %v", err)
	}
	if cfg.OutputDir == "" {
		t.Error("OutputDir should not be empty")
	}
	if len(cfg.Watches) == 0 {
		t.Error("Watches should not be empty")
	}
	for _, w := range cfg.Watches {
		if w.Tool == "" {
			t.Errorf("watch entry %q has empty tool", w.Path)
		}
	}
}

func TestLoadCreatesDefaultFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.toml")

	cfg, err := config.Load(cfgPath)
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.OutputDir == "" {
		t.Error("OutputDir should not be empty after creating default config")
	}
	if _, err := os.Stat(cfgPath); err != nil {
		t.Errorf("config file was not created at %s: %v", cfgPath, err)
	}
}

func TestLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.toml")

	// First load creates the file.
	first, err := config.Load(cfgPath)
	if err != nil {
		t.Fatalf("first Load() error: %v", err)
	}

	// Second load reads the file that was created.
	second, err := config.Load(cfgPath)
	if err != nil {
		t.Fatalf("second Load() error: %v", err)
	}
	if first.OutputDir != second.OutputDir {
		t.Errorf("OutputDir mismatch: %q vs %q", first.OutputDir, second.OutputDir)
	}
}
