# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

@truyman/cli is a TypeScript CLI framework library for building command-line applications. The project is in early development.

## Commands

- `bun run lint` - Check formatting and linting (oxfmt + oxlint)
- `bun run format` - Auto-fix formatting and lint issues
- `bun run typecheck` - Run TypeScript type checking
- `bun test` - Run all tests
- `bun test path/to/file` - Run a single test file

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode, ESNext target)
- **Formatter/Linter**: oxfmt + oxlint
- **Git Hooks**: husky with lint-staged (runs oxfmt + oxlint on all files pre-commit)

## Architecture

- `src/index.ts` - Public API exports (`command`, `run`) and top-level error handling
- `src/command.ts` - `Command` class with argv parsing (via mri) and handler execution
- `src/types.ts` - Type definitions with generics for type-safe args/options inference
- `src/help.ts` - Help text formatting
- `src/errors.ts` - Custom error classes (`MissingArgumentError`, `InvalidOptionError`)

Key pattern: `Command.run()` throws errors, `run()` (top-level) catches and pretty-prints them.
