import type { AnyCommand, NormalizedOptions } from "../types";
import { generateBashCompletions } from "./bash";
import { generateFishCompletions } from "./fish";
import type { CommandData, OptionData, Shell } from "./types";
import { generateZshCompletions } from "./zsh";

export type { CommandData, OptionData, Shell };

/**
 * Generates shell completion scripts for a command.
 *
 * @param cmd - The root command to generate completions for
 * @param shell - Target shell: 'bash', 'zsh', or 'fish'
 * @returns Shell script string ready to be sourced
 */
export function generateCompletions(cmd: AnyCommand, shell: Shell): string {
  const data = collectCommandData(cmd);

  switch (shell) {
    case "bash":
      return generateBashCompletions(data);
    case "zsh":
      return generateZshCompletions(data);
    case "fish":
      return generateFishCompletions(data);
    default:
      throw new Error(`Unknown shell: ${shell}`);
  }
}

/**
 * Collects command data recursively from a command tree.
 * Converts from Command instances to the normalized CommandData structure.
 */
function collectCommandData(cmd: AnyCommand): CommandData {
  const options = collectOptions(cmd.options);
  const subcommands = collectSubcommands(cmd);

  return {
    name: cmd.name,
    description: cmd.description,
    hidden: cmd.hidden,
    aliases: cmd.aliases,
    options,
    subcommands,
  };
}

function collectOptions(options: NormalizedOptions): OptionData[] {
  return Object.values(options).map((opt) => ({
    long: opt.long,
    short: opt.short,
    type: opt.type,
    description: opt.description,
    choices: opt.choices,
    env: opt.env,
  }));
}

function collectSubcommands(cmd: AnyCommand): CommandData[] {
  // Use duck typing to check if cmd has subcommands
  const cmdWithSubs = cmd as { subcommands?: Map<string, AnyCommand> };
  if (!cmdWithSubs.subcommands || cmdWithSubs.subcommands.size === 0) {
    return [];
  }

  return Array.from(cmdWithSubs.subcommands.values())
    .filter((sub) => !sub.hidden)
    .map((sub) => collectCommandData(sub));
}
