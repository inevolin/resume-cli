# Contributing to histd

Thank you for your interest in contributing to resume-cli! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/histd.git
   cd resume-cli
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b my-feature
   ```

## Development Setup

### Prerequisites

- Node.js 18 or later

### Build & Test

```bash
# Install dependencies
npm install

# Build
npm run build

# Run all tests
npm test

# Type-check (lint)
npm run lint
```

All of these checks run in CI on every push and pull request.

## Making Changes

### Code Style

- Follow standard TypeScript conventions
- Run `npm run lint` before committing — CI will reject type errors
- Add or update tests for any changed functionality

### Commit Messages

- Use clear, descriptive commit messages
- Start with a short summary line (50 characters or fewer)
- Use the imperative mood ("Add feature" not "Added feature")

### Adding a New Parser

histd is designed to be extended with parsers for additional AI tools. To add support for a new tool:

1. Create a new file in `src/parser/` (e.g. `newtool.ts`)
2. Implement the `HistoryParser` interface:
   ```typescript
   import { HistoryParser, Session } from './types';

   export class NewToolParser implements HistoryParser {
     canHandle(filePath: string): boolean { ... }
     async parse(filePath: string): Promise<Session[]> { ... }
   }
   ```
3. Register your parser in `src/watcher.ts`
4. Add corresponding tests in `src/parser/newtool.test.ts`
5. Update the README's "Supported Tools" table

## Submitting Changes

1. **Push** your branch to your fork
2. **Open a pull request** against the `main` branch
3. **Describe** your changes clearly in the PR description
4. Ensure **CI passes** — the pipeline runs build, tests, and type-checking

## Reporting Issues

- Use the [GitHub issue tracker](https://github.com/inevolin/resume-cli/issues)
- Check existing issues before creating a new one
- Include reproduction steps, expected behaviour, and actual behaviour
- For bugs, include your OS and Node.js version

## License

By contributing to resume-cli, you agree that your contributions will be licensed under the [MIT License](LICENSE).
