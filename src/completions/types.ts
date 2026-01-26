/**
 * Normalized data structure for command completions.
 * Used by all shell completion generators.
 */
export interface CommandData {
  name: string;
  description?: string;
  hidden?: boolean;
  aliases?: readonly string[];
  options: OptionData[];
  subcommands: CommandData[];
}

export interface OptionData {
  long: string;
  short?: string;
  type: "string" | "number" | "boolean";
  description?: string;
  choices?: readonly (string | number | boolean)[];
  env?: string;
}

export type Shell = "bash" | "zsh" | "fish";
