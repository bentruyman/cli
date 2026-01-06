import kleur from "kleur";

import type { AnyCommand, NormalizedOptions, PositionalArg, TypeMap } from "./types";

const VALUE_SUFFIXES: Record<keyof TypeMap, string> = {
  number: "=<num>",
  string: "=<str>",
  boolean: "",
};

const BUILTIN_OPTIONS: NormalizedOptions = {
  help: { type: "boolean", long: "help", short: "h", description: "Show help" },
  version: { type: "boolean", long: "version", short: "V", description: "Show version" },
};

export interface CommandInfo {
  name: string;
  description?: string;
  args: readonly PositionalArg[];
  options: NormalizedOptions;
  inherits?: NormalizedOptions;
}

export interface ParentCommandInfo {
  name: string;
  description?: string;
  options: NormalizedOptions;
  subcommands: Map<string, AnyCommand>;
}

export function formatHelp(command: CommandInfo): string {
  const output: string[] = [""];

  if (command.description) {
    output.push(command.description);
    output.push("");
  }

  output.push(...formatUsage(command.name, command.args));
  output.push("");

  if (command.args.length > 0) {
    output.push(...formatArguments(command.args));
    output.push("");
  }

  // Show inherited (global) options first
  if (command.inherits && Object.keys(command.inherits).length > 0) {
    output.push(...formatOptionsWithTitle(command.inherits, "Global Options:"));
    output.push("");
  }

  const mergedOptions = { ...command.options, ...BUILTIN_OPTIONS };
  output.push(...formatOptions(mergedOptions));

  return output.join("\n");
}

function formatArgName(arg: PositionalArg): string {
  const name = arg.variadic ? `${arg.name}...` : arg.name;
  return arg.optional ? `[${name}]` : `<${name}>`;
}

export function formatUsage(name: string, args: readonly PositionalArg[]): string[] {
  let usage = `  ${kleur.blue(name)} ${kleur.cyan("[options]")}`;

  if (args.length > 0) {
    const formattedArgs = args.map((arg) => kleur.green(formatArgName(arg)));
    usage += ` ${formattedArgs.join(" ")}`;
  }

  return [kleur.bold("Usage:"), usage];
}

function formatArguments(args: readonly PositionalArg[]): string[] {
  const lines: string[] = [kleur.bold("Arguments:")];

  for (const arg of args) {
    const argName = kleur.green(formatArgName(arg));
    const description = arg.description ?? "";
    lines.push(`  ${argName}  ${description}`);
  }

  return lines;
}

function formatOptions(options: NormalizedOptions): string[] {
  return formatOptionsWithTitle(options, "Options:");
}

function getValueSuffix(opt: NormalizedOptions[string]): string {
  const baseSuffix = opt.placeholder ? `=<${opt.placeholder}>` : VALUE_SUFFIXES[opt.type];
  return opt.multiple && baseSuffix ? `${baseSuffix}...` : baseSuffix;
}

function formatOptionsWithTitle(options: NormalizedOptions, title: string): string[] {
  const lines: string[] = [kleur.bold(title)];

  const entries = Object.values(options).map((opt) => {
    const valueSuffix = getValueSuffix(opt);
    const negatablePrefix = opt.negatable ? "[no-]" : "";
    const visualFlag = opt.short
      ? `-${opt.short}, --${negatablePrefix}${opt.long}${valueSuffix}`
      : `    --${negatablePrefix}${opt.long}${valueSuffix}`;

    return { opt, valueSuffix, visualFlag };
  });

  const maxWidth = Math.max(...entries.map((e) => e.visualFlag.length));

  for (const { opt, valueSuffix, visualFlag } of entries) {
    const flagPart = formatFlag(opt, valueSuffix);
    const padding = " ".repeat(maxWidth - visualFlag.length + 2);
    lines.push(`  ${flagPart}${padding}${opt.description ?? ""}`);
  }

  return lines;
}

function formatFlag(opt: NormalizedOptions[string], valueSuffix: string): string {
  const negatablePrefix = opt.negatable ? "[no-]" : "";
  if (opt.short) {
    return valueSuffix
      ? kleur.cyan(`-${opt.short}, --${negatablePrefix}${opt.long}${kleur.dim(valueSuffix)}`)
      : kleur.cyan(`-${opt.short}, --${negatablePrefix}${opt.long}`);
  }

  return valueSuffix
    ? kleur.cyan(`    --${negatablePrefix}${opt.long}${kleur.dim(valueSuffix)}`)
    : kleur.cyan(`    --${negatablePrefix}${opt.long}`);
}

export function formatParentHelp(command: ParentCommandInfo): string {
  const output: string[] = [""];

  if (command.description) {
    output.push(command.description);
    output.push("");
  }

  // Usage line for parent commands
  output.push(kleur.bold("Usage:"));
  output.push(
    `  ${kleur.blue(command.name)} ${kleur.cyan("[options]")} ${kleur.yellow("<command>")} [args...]`,
  );
  output.push("");

  // List subcommands
  output.push(kleur.bold("Commands:"));
  const subcommandEntries = Array.from(command.subcommands.values());
  const maxNameLen =
    subcommandEntries.length > 0 ? Math.max(...subcommandEntries.map((s) => s.name.length)) : 0;

  for (const sub of subcommandEntries) {
    const padding = " ".repeat(maxNameLen - sub.name.length + 2);
    output.push(`  ${kleur.yellow(sub.name)}${padding}${sub.description ?? ""}`);
  }

  output.push("");
  const mergedOptions = { ...command.options, ...BUILTIN_OPTIONS };
  output.push(...formatOptions(mergedOptions));

  return output.join("\n");
}
