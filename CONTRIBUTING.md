# Contributing to histd

Thank you for your interest in contributing to histd! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/histd.git
   cd histd
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b my-feature
   ```

## Development Setup

### Prerequisites

- Go 1.25 or later

### Build & Test

```bash
# Build
go build ./...

# Run all tests with race detection
go test -v -race ./...

# Lint
go vet ./...

# Check formatting
gofmt -l .
```

All of these checks run in CI on every push and pull request.

## Making Changes

### Code Style

- Follow standard Go conventions and [Effective Go](https://go.dev/doc/effective_go) guidelines
- Run `gofmt` before committing — CI will reject unformatted code
- Run `go vet` to catch common mistakes
- Add or update tests for any changed functionality

### Commit Messages

- Use clear, descriptive commit messages
- Start with a short summary line (50 characters or fewer)
- Use the imperative mood ("Add feature" not "Added feature")

### Adding a New Parser

histd is designed to be extended with parsers for additional AI tools. To add support for a new tool:

1. Create a new file in `internal/parser/` (e.g. `newtool.go`)
2. Implement the `HistoryParser` interface:
   ```go
   type HistoryParser interface {
       CanHandle(path string) bool
       Parse(path string) ([]Session, error)
   }
   ```
3. Register your parser in `internal/watcher/watcher.go`
4. Add corresponding tests in `internal/parser/parser_test.go`
5. Update the README's "Supported Tools" table

## Submitting Changes

1. **Push** your branch to your fork
2. **Open a pull request** against the `main` branch
3. **Describe** your changes clearly in the PR description
4. Ensure **CI passes** — the pipeline runs build, tests, vet, and formatting checks

## Reporting Issues

- Use the [GitHub issue tracker](https://github.com/inevolin/histd/issues)
- Check existing issues before creating a new one
- Include reproduction steps, expected behaviour, and actual behaviour
- For bugs, include your OS and Go version

## License

By contributing to histd, you agree that your contributions will be licensed under the [MIT License](LICENSE).
