// histd is a lightweight background daemon that monitors AI coding-agent
// session directories (Claude Code, Cursor, Windsurf) and syncs the
// conversation history to ~/.histd/sessions/ as standard Markdown files.
//
// Usage:
//
//	histd [--config <path>]
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/inevolin/histd/internal/config"
	"github.com/inevolin/histd/internal/watcher"
)

func main() {
	var cfgPath string
	flag.StringVar(&cfgPath, "config", "", "path to config.toml (default: ~/.histd/config.toml)")
	flag.Parse()

	if cfgPath == "" {
		dir, err := config.DefaultConfigDir()
		if err != nil {
			fmt.Fprintf(os.Stderr, "histd: %v\n", err)
			os.Exit(1)
		}
		cfgPath = filepath.Join(dir, "config.toml")
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "histd: loading config: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(cfg.OutputDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "histd: creating output directory %s: %v\n", cfg.OutputDir, err)
		os.Exit(1)
	}

	log.Printf("histd: output directory: %s", cfg.OutputDir)
	log.Printf("histd: config: %s", cfgPath)
	log.Printf("histd: starting file watcher …")

	if err := watcher.Run(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "histd: watcher error: %v\n", err)
		os.Exit(1)
	}
}
