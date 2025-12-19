import mri from "mri";

import {
  MissingArgumentError,
  InvalidArgumentError,
  InvalidOptionError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownSubcommandError,
  ReservedOptionError,
} from "./errors";
import { formatHelp, formatParentHelp } from "./help";
import type {
  AnyCommand,
  ArgsToValues,
  CommandOptions,
  LeafCommandOptions,
  MergeOptions,
  NormalizedOptions,
  Options,
  OptionsToValues,
  ParentCommandOptions,
  PositionalArg,
} from "./types";

function isParentOptions<T extends readonly PositionalArg[], O extends Options, I extends Options>(
  opts: CommandOptions<T, O, I>,
): opts is ParentCommandOptions<O> {
  return "subcommands" in opts && Array.isArray(opts.subcommands);
}

function normalizeOptions(options: Options): NormalizedOptions {
  const normalized: NormalizedOptions = {};
  for (const [key, opt] of Object.entries(options)) {
    normalized[key] = { ...opt, long: opt.long ?? key };
  }
  return normalized;
}

/**
 * Represents a CLI command with type-safe arguments and options.
 *
 * Commands can be either leaf commands (with a handler) or parent commands (with subcommands).
 * Use the {@link command} factory function to create commands with proper type inference.
 *
 * @example
 * ```typescript
 * const cmd = command({
 *   name: "greet",
 *   args: [{ name: "name", type: "string" }] as const,
 *   options: { loud: { type: "boolean" } },
 *   handler: ([name], { loud }) => console.log(loud ? name.toUpperCase() : name)
 * });
 *
 * cmd.run(["World", "--loud"]);
 * ```
 */
export class Command<
  T extends readonly PositionalArg[] = readonly PositionalArg[],
  O extends Options = Options,
  I extends Options = {},
> implements AnyCommand {
  /** Command name used in help output and subcommand routing */
  readonly name: string;
  /** Description shown in help output */
  readonly description?: string;
  /** Version string shown with --version flag */
  readonly version?: string;
  /** Positional argument definitions */
  readonly args: T;
  /** Option definitions (normalized with long names) */
  readonly options: NormalizedOptions;
  /** Inherited option definitions from parent commands */
  readonly inherits: NormalizedOptions;
  /** Handler function for leaf commands */
  readonly handler?: (args: ArgsToValues<T>, options: OptionsToValues<MergeOptions<I, O>>) => void;
  /** Map of subcommands for parent commands */
  readonly subcommands?: Map<string, AnyCommand>;

  constructor(cmdOptions: CommandOptions<T, O, I>) {
    this.name = cmdOptions.name;
    this.description = cmdOptions.description;
    this.version = cmdOptions.version;
    this.options = normalizeOptions(cmdOptions.options ?? {});

    if (isParentOptions(cmdOptions)) {
      if (cmdOptions.subcommands.length === 0) {
        throw new Error("Parent command must have at least one subcommand");
      }
      this.args = [] as unknown as T;
      this.inherits = {};
      this.subcommands = new Map(cmdOptions.subcommands.map((cmd) => [cmd.name, cmd]));
    } else {
      this.args = cmdOptions.args ?? ([] as unknown as T);
      this.inherits = normalizeOptions(cmdOptions.inherits ?? {});
      this.handler = cmdOptions.handler;
      this.validateArgs();
      this.validateOptionConflicts();
      this.validateReservedOptions(this.inherits);
    }

    this.validateReservedOptions(this.options);
  }

  private validateArgs(): void {
    const variadicIndex = this.args.findIndex((arg) => arg.variadic);
    if (variadicIndex !== -1 && variadicIndex !== this.args.length - 1) {
      const variadicArg = this.args[variadicIndex];
      // variadicIndex is valid since findIndex returned a non-negative index
      const argName = variadicArg?.name ?? "unknown";
      throw new Error(`Variadic argument '${argName}' must be the last argument`);
    }
  }

  private validateOptionConflicts(): void {
    const inheritedKeys = new Set(Object.keys(this.inherits));
    const conflicts = Object.keys(this.options).filter((k) => inheritedKeys.has(k));
    if (conflicts.length > 0) {
      throw new Error(`Option keys conflict with inherited: ${conflicts.join(", ")}`);
    }
  }

  private validateReservedOptions(options: NormalizedOptions): void {
    const reservedLong = new Set(["help", "version"]);
    const reservedShort = new Set(["h", "V"]);

    for (const opt of Object.values(options)) {
      if (reservedLong.has(opt.long)) {
        throw new ReservedOptionError(`--${opt.long}`);
      }
      if (opt.short && reservedShort.has(opt.short)) {
        throw new ReservedOptionError(`-${opt.short}`);
      }
    }
  }

  /** Returns true if this command has subcommands (is a parent command) */
  isParent(): boolean {
    return this.subcommands !== undefined && this.subcommands.size > 0;
  }

  /** Get a subcommand by name, or undefined if not found */
  getSubcommand(name: string): AnyCommand | undefined {
    return this.subcommands?.get(name);
  }

  /** Get an array of all subcommand names */
  getSubcommandNames(): string[] {
    return this.subcommands ? Array.from(this.subcommands.keys()) : [];
  }

  /**
   * Generate formatted help text for this command.
   * @returns Colorized help string ready for display
   */
  help(): string {
    if (this.isParent() && this.subcommands) {
      return formatParentHelp({
        name: this.name,
        description: this.description,
        options: this.options,
        subcommands: this.subcommands,
      });
    }
    return formatHelp(this);
  }

  /**
   * Execute the command with the given arguments.
   *
   * For leaf commands, parses arguments and options, then calls the handler.
   * For parent commands, routes to the appropriate subcommand.
   *
   * @param argv - Array of command-line arguments (without the command name)
   * @param inheritedOptions - Options passed down from parent commands
   * @throws {MissingArgumentError} When a required argument is missing
   * @throws {InvalidArgumentError} When an argument has an invalid value
   * @throws {MissingOptionError} When a required option is missing
   * @throws {InvalidOptionError} When an option has an invalid value
   * @throws {MissingSubcommandError} When no subcommand is provided to a parent
   * @throws {UnknownSubcommandError} When an unknown subcommand is provided
   */
  run(argv: string[], inheritedOptions: Record<string, unknown> = {}): void | Promise<void> {
    if (this.isParent()) {
      return this.runParent(argv, inheritedOptions);
    } else {
      return this.runLeaf(argv, inheritedOptions);
    }
  }

  private runParent(
    argv: string[],
    inheritedOptions: Record<string, unknown>,
  ): void | Promise<void> {
    const parsed = this.parseArgvWithOptions(argv, this.options);
    const parentOpts = this.extractOptions(parsed);

    const definedParentOpts = Object.fromEntries(
      Object.entries(parentOpts).filter(([, v]) => v !== undefined),
    );
    const mergedInherited = { ...inheritedOptions, ...definedParentOpts };

    const subcommandName = parsed._[0];

    if (!subcommandName || subcommandName.startsWith("-")) {
      throw new MissingSubcommandError(this.name, this.getSubcommandNames());
    }

    const subcommand = this.getSubcommand(subcommandName);
    if (!subcommand) {
      throw new UnknownSubcommandError(subcommandName, this.getSubcommandNames());
    }

    const remainingArgv = this.reconstructArgv(parsed._.slice(1), parsed);
    return subcommand.run(remainingArgv, mergedInherited);
  }

  private runLeaf(argv: string[], inheritedOptions: Record<string, unknown>): void | Promise<void> {
    const mergedOptionDefs = { ...this.inherits, ...this.options };
    const parsed = this.parseArgvWithOptions(argv, mergedOptionDefs);

    const args = this.extractArgs(parsed);
    const ownOptions = this.extractOptionsFromDefs(parsed, this.options);
    const inheritedFromArgv = this.extractOptionsFromDefs(parsed, this.inherits);

    const options = {
      ...inheritedFromArgv,
      ...inheritedOptions,
      ...ownOptions,
    };

    if (!this.handler) {
      throw new Error(`Command '${this.name}' has no handler`);
    }

    return this.handler(args, options as OptionsToValues<MergeOptions<I, O>>);
  }

  /**
   * Reconstructs an argv array for passing to subcommands.
   *
   * When a parent command parses argv, mri consumes the options. To pass inherited
   * options to subcommands, we must reconstruct them from the parsed result.
   * Only options NOT defined on this command are passed through (inherited options).
   *
   * @param positionals - Remaining positional arguments after the subcommand name
   * @param parsed - The parsed mri result containing all options
   * @returns Reconstructed argv with positionals and inherited options
   */
  private reconstructArgv(positionals: string[], parsed: mri.Argv): string[] {
    const result = [...positionals];

    for (const [key, value] of Object.entries(parsed)) {
      if (key === "_") continue;

      const isOwnOption = Object.values(this.options).some(
        (opt) => opt.long === key || opt.short === key,
      );
      if (isOwnOption) continue;

      if (typeof value === "boolean" && value) {
        result.push(`--${key}`);
      } else if (value !== undefined && value !== false) {
        result.push(`--${key}`, String(value));
      }
    }

    return result;
  }

  private extractArgs(parsed: mri.Argv): ArgsToValues<T> {
    const values: unknown[] = [];

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];
      // Loop bounds guarantee arg exists, but TypeScript doesn't know that
      if (!arg) continue;

      if (arg.variadic) {
        const remaining = parsed._.slice(i);

        if (!arg.optional && remaining.length === 0) {
          throw new MissingArgumentError(arg.name, this);
        }

        const typedRemaining = remaining.map((value) => {
          switch (arg.type) {
            case "number": {
              const numValue = Number(value);
              if (isNaN(numValue)) {
                throw new InvalidArgumentError(`${arg.name} values must be numbers`, this);
              }
              return numValue;
            }
            case "boolean":
              return value === "true";
            default:
              return value;
          }
        });

        values.push(typedRemaining);
        break;
      } else {
        const value = parsed._[i];

        if (value === undefined && !arg.optional) {
          throw new MissingArgumentError(arg.name, this);
        }

        switch (arg.type) {
          case "number": {
            if (value !== undefined) {
              const numValue = Number(value);
              if (isNaN(numValue)) {
                throw new InvalidArgumentError(`${arg.name} must be a number`, this);
              }
              values.push(numValue);
            } else {
              values.push(undefined);
            }
            break;
          }
          case "boolean":
            values.push(value !== undefined ? value === "true" : undefined);
            break;
          default:
            values.push(value);
        }
      }
    }

    return values as ArgsToValues<T>;
  }

  private extractOptions(parsed: mri.Argv): OptionsToValues<O> {
    return this.extractOptionsFromDefs(parsed, this.options) as OptionsToValues<O>;
  }

  private parseArgvWithOptions(argv: string[], optionDefs: NormalizedOptions): mri.Argv {
    const booleanFlags: string[] = [];
    const stringFlags: string[] = [];
    const aliases: Record<string, string> = {};

    for (const opt of Object.values(optionDefs)) {
      if (opt.type === "boolean") {
        booleanFlags.push(opt.long);
        if (opt.negatable) {
          booleanFlags.push(`no-${opt.long}`);
        }
      } else {
        stringFlags.push(opt.long);
      }

      if (opt.short) {
        aliases[opt.short] = opt.long;
      }
    }

    return mri(argv, {
      boolean: booleanFlags,
      string: stringFlags,
      alias: aliases,
    });
  }

  private coerceToNumber(value: unknown, key: string): number {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new InvalidOptionError(`${key} must be a number`, this);
    }
    return numValue;
  }

  private extractMultipleOptionValue(
    value: unknown,
    opt: NormalizedOptions[string],
    key: string,
  ): unknown[] {
    const arr = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (opt.type === "number") {
      return arr.map((v: unknown) => this.coerceToNumber(v, key));
    }
    return arr;
  }

  private extractNegatableBoolean(
    parsed: mri.Argv,
    opt: NormalizedOptions[string],
  ): boolean | undefined {
    const negatedValue = parsed[`no-${opt.long}`];
    if (negatedValue === true) {
      return false;
    }
    const value = parsed[opt.long];
    if (value !== undefined) {
      return value as boolean;
    }
    return opt.default as boolean | undefined;
  }

  private extractOptionsFromDefs(
    parsed: mri.Argv,
    optionDefs: NormalizedOptions,
  ): Record<string, unknown> {
    const optionValues: Record<string, unknown> = {};

    for (const [key, opt] of Object.entries(optionDefs)) {
      const value = parsed[opt.long];

      if (opt.multiple) {
        optionValues[key] = this.extractMultipleOptionValue(value, opt, key);
      } else if (opt.type === "number") {
        if (value !== undefined) {
          optionValues[key] = this.coerceToNumber(value, key);
        } else {
          optionValues[key] = opt.default;
        }
      } else if (opt.type === "boolean" && opt.negatable) {
        optionValues[key] = this.extractNegatableBoolean(parsed, opt);
      } else {
        optionValues[key] = value !== undefined ? value : opt.default;
      }

      if (opt.required && optionValues[key] === undefined) {
        throw new MissingOptionError(opt.long, this);
      }
    }

    return optionValues;
  }
}

/**
 * Creates a new CLI command with type-safe arguments and options.
 *
 * @example Leaf command with args and options
 * ```typescript
 * const greet = command({
 *   name: "greet",
 *   description: "Greet someone",
 *   args: [{ name: "name", type: "string" }] as const,
 *   options: {
 *     loud: { type: "boolean", short: "l", description: "Shout it" }
 *   },
 *   handler: ([name], { loud }) => {
 *     console.log(loud ? `HELLO ${name.toUpperCase()}!` : `Hello, ${name}!`);
 *   }
 * });
 * ```
 *
 * @example Parent command with subcommands
 * ```typescript
 * const cli = command({
 *   name: "my-cli",
 *   version: "1.0.0",
 *   description: "My awesome CLI",
 *   options: {
 *     verbose: { type: "boolean", short: "v" }
 *   },
 *   subcommands: [greet, deploy, config]
 * });
 * ```
 *
 * @example Using inherited options
 * ```typescript
 * const GlobalOptions = {
 *   verbose: { type: "boolean", short: "v" }
 * } as const;
 *
 * const deploy = command({
 *   name: "deploy",
 *   inherits: GlobalOptions,
 *   handler: (_, { verbose }) => {
 *     if (verbose) console.log("Deploying...");
 *   }
 * });
 * ```
 */
export function command<
  const T extends readonly PositionalArg[],
  const O extends Options,
  const I extends Options,
>(options: LeafCommandOptions<T, O, I> & { inherits: I }): Command<T, O, I>;
export function command<const T extends readonly PositionalArg[], const O extends Options>(
  options: Omit<LeafCommandOptions<T, O, {}>, "inherits">,
): Command<T, O, {}>;
export function command<const O extends Options>(
  options: ParentCommandOptions<O>,
): Command<readonly [], O, {}>;
export function command<
  const T extends readonly PositionalArg[],
  const O extends Options,
  const I extends Options,
>(options: CommandOptions<T, O, I>): Command<T, O, I> {
  return new Command(options);
}
