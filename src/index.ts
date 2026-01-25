import kleur from "kleur";

import { command, Command } from "./command";
import {
  MissingArgumentError,
  InvalidArgumentError,
  InvalidOptionError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownSubcommandError,
  UnknownOptionError,
} from "./errors";
import type { AnyCommand } from "./types";

export { command, Command };
export {
  InvalidArgumentError,
  InvalidOptionError,
  MissingArgumentError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownOptionError,
  UnknownSubcommandError,
};
export type {
  AnyCommand,
  CommandOptions,
  LeafCommandOptions,
  MergeOptions,
  Option,
  Options,
  ParentCommandOptions,
  PositionalArg,
} from "./types";

function stdout(message: string): void {
  process.stdout.write(message + "\n");
}

function stderr(message: string): void {
  process.stderr.write(message + "\n");
}

function findHelpTarget(cmd: AnyCommand, argv: string[]): AnyCommand {
  if (!(cmd instanceof Command) || !cmd.isParent()) {
    return cmd;
  }

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") continue;
    if (arg.startsWith("-")) continue;

    const subCmd = cmd.getSubcommand(arg);
    if (subCmd) {
      return findHelpTarget(subCmd, argv.slice(1));
    }
    break;
  }

  return cmd;
}

function handleError(error: unknown, cmd: Command<any, any, any>): void {
  if (error instanceof MissingArgumentError) {
    const source = error.source ?? cmd;
    stderr(source.help());
  } else if (error instanceof InvalidArgumentError) {
    const source = error.source ?? cmd;
    stderr(kleur.red(`Error: ${error.message}`));
    stderr("");
    stderr(source.help());
  } else if (error instanceof MissingSubcommandError) {
    stderr(cmd.help());
  } else if (error instanceof UnknownSubcommandError) {
    stderr(kleur.red(`Error: ${error.message}`));
  } else if (error instanceof UnknownOptionError) {
    stderr(kleur.red(`Error: ${error.message}`));
  } else if (error instanceof InvalidOptionError) {
    const source = error.source ?? cmd;
    stderr(kleur.red(`Error: ${error.message}`));
    stderr("");
    stderr(source.help());
  } else if (error instanceof MissingOptionError) {
    const source = error.source ?? cmd;
    stderr(kleur.red(`Error: ${error.message}`));
    stderr("");
    stderr(source.help());
  } else {
    throw error;
  }
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
  if (argv.includes("--version") || argv.includes("-V")) {
    if (cmd.version) {
      stdout(cmd.version);
    } else {
      stderr(kleur.red(`${cmd.name}: no version specified`));
    }
    return;
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    const helpTarget = findHelpTarget(cmd, argv);
    stdout(helpTarget.help());
    return;
  }

  try {
    await cmd.run(argv);
  } catch (error) {
    handleError(error, cmd);
  }
}
