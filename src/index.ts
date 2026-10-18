import kleur from "kleur";

import { command, Command } from "./command.js";
import { generateCompletions, type Shell } from "./completions/index.js";
import {
  MissingArgumentError,
  InvalidArgumentError,
  InvalidOptionError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownSubcommandError,
  UnknownOptionError,
  ValidationError,
  InvalidChoiceError,
  type ErrorSource,
} from "./errors.js";

export { command, Command, generateCompletions };
export type { Shell } from "./completions/index.js";
export {
  InvalidArgumentError,
  InvalidChoiceError,
  InvalidOptionError,
  MissingArgumentError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownOptionError,
  UnknownSubcommandError,
  ValidationError,
};
export type {
  AnyCommand,
  CommandGroups,
  CommandOptions,
  Example,
  Examples,
  HybridCommandOptions,
  LeafCommandOptions,
  MergeOptions,
  Option,
  Options,
  ParentCommandOptions,
  PositionalArg,
} from "./types.js";

function stdout(message: string): void {
  process.stdout.write(message + "\n");
}

function stderr(message: string): void {
  process.stderr.write(message + "\n");
}

const VALID_SHELLS: Shell[] = ["bash", "zsh", "fish"];

function handleCompletions(cmd: Command<any, any, any>, argv: string[]): void {
  const shell = argv[0];
  if (!shell || !VALID_SHELLS.includes(shell as Shell) || argv.length !== 1) {
    process.exitCode = 1;
    stderr(`Usage: ${cmd.name} completions <bash|zsh|fish>`);
    return;
  }
  stdout(generateCompletions(cmd, shell as Shell));
}

/** Type guard for CLI errors with code and source properties */
function isCliError(error: unknown): error is Error & { code: string; source?: ErrorSource } {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

function handleError(error: unknown, cmd: Command<any, any, any>): void {
  if (!isCliError(error)) {
    throw error;
  }

  const source = error.source ?? cmd;

  switch (error.code) {
    case "MISSING_ARGUMENT":
    case "MISSING_SUBCOMMAND":
      stderr(source.help());
      break;

    case "UNKNOWN_SUBCOMMAND":
    case "UNKNOWN_OPTION":
      stderr(kleur.red(`Error: ${error.message}`));
      stderr(source.help());
      break;

    case "INVALID_ARGUMENT":
    case "INVALID_OPTION":
    case "MISSING_OPTION":
    case "VALIDATION_ERROR":
    case "INVALID_CHOICE":
      stderr(kleur.red(`Error: ${error.message}`));
      stderr("");
      stderr(source.help());
      break;

    default:
      throw error;
  }
  process.exitCode = 1;
}

/**
 * Run a command with built-in help, version, and error handling.
 *
 * This is the recommended entry point for CLI applications. It handles:
 * - `--help` / `-h` flags (shows help and exits)
 * - `--version` / `-V` flags (shows version and exits)
 * - Error formatting (shows helpful messages with usage info)
 *
 * @param cmd - The root command to run
 * @param argv - Command-line arguments (typically `process.argv.slice(2)`)
 *
 * @example
 * ```typescript
 * import { command, run } from "@truyman/cli";
 *
 * const cli = command({
 *   name: "my-cli",
 *   version: "1.0.0",
 *   handler: () => console.log("Hello!")
 * });
 *
 * run(cli, process.argv.slice(2));
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function run(cmd: Command<any, any, any>, argv: string[]): Promise<void> {
  // Handle completions subcommand
  if (argv[0] === "completions" && cmd.args.length === 0 && !cmd.getSubcommand("completions")) {
    handleCompletions(cmd, argv.slice(1));
    return;
  }

  try {
    await cmd.run(argv);
  } catch (error) {
    handleError(error, cmd);
  }
}
