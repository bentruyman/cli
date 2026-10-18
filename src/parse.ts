import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { InvalidOptionError, UnknownOptionError, type ErrorSource } from "./errors.js";
import { findSuggestions } from "./suggestions.js";
import type { NormalizedOptions } from "./types.js";

export interface ParsedArgv {
  values: Record<string, unknown>;
  positionals: string[];
  commandIndex?: number;
  help: boolean;
  version: boolean;
}

/** Routing stops at the first operand; the final command parses the original tokens. */
export function parseArgv(
  argv: string[],
  definitions: NormalizedOptions,
  source: ErrorSource,
  routing = false,
): ParsedArgv {
  const parsed: ParsedArgv = {
    values: Object.create(null),
    positionals: [],
    help: false,
    version: false,
  };
  const names = new Map(Object.entries(definitions).map(([key, opt]) => [opt.long, key]));
  const options: ParseArgsOptionsConfig = Object.fromEntries(
    Object.values(definitions).map((opt) => [
      opt.long,
      {
        type: opt.type === "boolean" ? "boolean" : "string",
        ...(opt.short ? { short: opt.short } : {}),
      },
    ]),
  );
  options.help = { type: "boolean", short: "h" };
  options.version = { type: "boolean", short: "V" };
  // Defer validation until the selected command is known; tokens retain spelling and order.
  const { tokens } = parseArgs({
    args: argv,
    options,
    tokens: true,
    strict: false,
    allowPositionals: true,
  });
  for (const token of tokens) {
    if (token.kind === "option-terminator") {
      parsed.positionals.push(...argv.slice(token.index + 1));
      break;
    }
    if (token.kind === "positional") {
      if (routing) {
        parsed.commandIndex = token.index;
        break;
      }
      parsed.positionals.push(token.value);
      continue;
    }
    const { name, value: raw } = token;
    if (name === "help" || name === "version") {
      if (raw !== undefined && raw !== "true" && raw !== "false") {
        throw new InvalidOptionError(`${token.rawName} must be a boolean`, source);
      }
      parsed[name] = raw !== "false";
      continue;
    }
    const negated = name.startsWith("no-") && !names.has(name) && token.rawName.startsWith("--");
    const key = names.get(negated ? name.slice(3) : name);
    const opt = key === undefined ? undefined : definitions[key];
    if (!opt || (negated && (opt.type !== "boolean" || !opt.negatable))) {
      const available = [
        ...names.keys(),
        ...Object.values(definitions)
          .filter((opt) => opt.negatable)
          .map((opt) => `no-${opt.long}`),
      ];
      throw new UnknownOptionError(name, available, findSuggestions(name, available), source);
    }
    let value: unknown = raw;
    if (opt.type === "boolean") {
      if (raw !== undefined && (negated || !["true", "false"].includes(raw))) {
        throw new InvalidOptionError(`${token.rawName} must be a boolean`, source);
      }
      value = negated ? false : raw !== "false";
    } else if (
      raw === undefined ||
      (!token.inlineValue &&
        raw !== "-" &&
        raw.startsWith("-") &&
        !(opt.type === "number" && raw.trim() !== "" && Number.isFinite(Number(raw))))
    ) {
      throw new InvalidOptionError(`Missing value for --${opt.long}`, source);
    }
    if (opt.multiple) {
      const values = (parsed.values[key!] ??= []) as unknown[];
      values.push(value);
    } else {
      parsed.values[key!] = value;
    }
  }
  return parsed;
}
