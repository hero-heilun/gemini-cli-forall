# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- `npm run build` - Build all packages and bundle the CLI
- `npm run build:packages` - Build only the workspace packages
- `npm run build:sandbox` - Build the Docker sandbox image
- `npm run bundle` - Generate and bundle the CLI with esbuild
- `npm start` - Start the development version locally
- `npm run debug` - Start with Node.js inspector for debugging

### Testing
- `npm test` - Run all workspace tests
- `npm run test:ci` - Run tests in CI mode
- `npm run test:e2e` - Run end-to-end tests (sandbox disabled)
- `npm run test:integration:all` - Run all integration tests with different sandbox configurations
- `npm run test:integration:sandbox:none` - Run integration tests without sandbox
- `npm run test:integration:sandbox:docker` - Run integration tests with Docker sandbox
- `npm run test:integration:sandbox:podman` - Run integration tests with Podman sandbox

To run a single test file:
```bash
npm test -- path/to/test.test.ts
```

### Code Quality
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run lint:fix` - Auto-fix linting issues
- `npm run lint:ci` - Run linting with zero-warning policy (for CI)
- `npm run typecheck` - Run TypeScript type checking across workspaces
- `npm run format` - Format code with Prettier
- `npm run preflight` - Full pre-commit check (clean, install, format, lint, build, typecheck, test)

## Architecture

The Gemini CLI consists of two main packages that work together:

### 1. CLI Package (`packages/cli`)
Handles the user-facing experience:
- Input processing and command parsing (slash commands, at commands, shell mode)
- Terminal UI rendering with React and Ink
- Theme management and customization
- History management
- Authentication flow
- Configuration settings

Key entry points:
- `packages/cli/index.ts` - Main CLI entry
- `packages/cli/src/gemini.tsx` - Interactive mode React app
- `packages/cli/src/nonInteractiveCli.ts` - Non-interactive mode handler

### 2. Core Package (`packages/core`)
Backend that orchestrates AI interactions:
- Gemini API client implementation
- Tool registration and execution system
- Prompt construction and conversation management
- Memory system (CLAUDE.md discovery and management)
- Telemetry and metrics collection

Key components:
- `packages/core/src/core/geminiChat.ts` - Main chat orchestration
- `packages/core/src/core/client.ts` - Gemini API client
- `packages/core/src/tools/` - Built-in tools implementation

### Tool System
Tools extend Gemini's capabilities. Each tool implements:
- Parameter validation via JSON schema
- Execution logic with abort signal support
- User confirmation for destructive operations
- Result formatting for both LLM and user display

Built-in tools include:
- File operations: read, write, edit, ls, glob, grep
- Shell command execution (with sandboxing)
- Web operations: fetch URLs, search
- Memory management
- MCP (Model Context Protocol) server integration

### Key Design Patterns
1. **Modular Architecture**: Clear separation between UI (CLI) and logic (Core)
2. **Tool Extensibility**: Support for custom tools via discovery commands or MCP servers
3. **Safety First**: User confirmation required for file modifications and shell commands
4. **Context Management**: Smart file discovery and memory system for maintaining context
5. **Streaming Support**: Real-time response streaming from Gemini API

## Configuration
- User settings: `~/.config/gemini-cli/settings.json`
- Authentication: Supports Google OAuth, API keys, and various cloud providers
- Sandbox: Optional Docker/Podman sandboxing for shell commands
- MCP servers: Can be configured in settings for additional tool capabilities