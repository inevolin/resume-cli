// Package watcher monitors configured source paths for changes and triggers
// the appropriate parser + generator pipeline on each modification event.
package watcher

import (
	"log"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/inevolin/histd/internal/config"
	"github.com/inevolin/histd/internal/generator"
	"github.com/inevolin/histd/internal/parser"
)

const debounceDuration = 2 * time.Second

// parsers is the ordered list of registered HistoryParsers.  The first parser
// whose CanHandle returns true is used for a given file.
var parsers = []parser.HistoryParser{
	&parser.ClaudeParser{},
	&parser.CursorParser{},
}

// Run starts the file-watching loop.  It blocks until an error occurs on the
// watcher itself.  Each watched path from cfg is added recursively if it is a
// directory.
func Run(cfg *config.Config) error {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer w.Close()

	for _, entry := range cfg.Watches {
		if err := addPath(w, entry.Path); err != nil {
			log.Printf("watcher: cannot watch %s: %v", entry.Path, err)
		} else {
			log.Printf("watcher: watching %s (%s)", entry.Path, entry.Tool)
		}
	}

	debounce := newDebouncer()

	for {
		select {
		case event, ok := <-w.Events:
			if !ok {
				return nil
			}
			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) {
				path := event.Name
				debounce.trigger(path, func() {
					handleChange(path, cfg.OutputDir)
				})
			}
		case err, ok := <-w.Errors:
			if !ok {
				return nil
			}
			log.Printf("watcher: error: %v", err)
		}
	}
}

// addPath adds a single path (file or directory) to the watcher.
func addPath(w *fsnotify.Watcher, path string) error {
	return w.Add(path)
}

// handleChange runs the parser + generator pipeline for a changed file.
func handleChange(path, outputDir string) {
	p := selectParser(path)
	if p == nil {
		return
	}
	sessions, err := p.Parse(path)
	if err != nil {
		log.Printf("watcher: parse error for %s: %v", path, err)
		return
	}
	if len(sessions) == 0 {
		return
	}
	if err := generator.Write(sessions, outputDir); err != nil {
		log.Printf("watcher: generator error for %s: %v", path, err)
		return
	}
	log.Printf("watcher: wrote %d session(s) from %s", len(sessions), filepath.Base(path))
}

// selectParser returns the first registered parser that can handle path.
func selectParser(path string) parser.HistoryParser {
	for _, p := range parsers {
		if p.CanHandle(path) {
			return p
		}
	}
	return nil
}

// debouncer coalesces rapid events for the same path into a single action
// that fires debounceDuration after the last event.  A version counter ensures
// that if a timer fires just as a new trigger arrives, the stale callback is
// discarded and fn is called only once per quiet window.
type debouncer struct {
	mu      sync.Mutex
	timers  map[string]*time.Timer
	version map[string]int
}

func newDebouncer() *debouncer {
	return &debouncer{
		timers:  make(map[string]*time.Timer),
		version: make(map[string]int),
	}
}

func (d *debouncer) trigger(key string, fn func()) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if t, ok := d.timers[key]; ok {
		t.Stop()
	}
	d.version[key]++
	v := d.version[key]
	d.timers[key] = time.AfterFunc(debounceDuration, func() {
		d.mu.Lock()
		if d.version[key] != v {
			// A newer trigger replaced us; skip this invocation.
			d.mu.Unlock()
			return
		}
		delete(d.timers, key)
		delete(d.version, key)
		d.mu.Unlock()
		fn()
	})
}
