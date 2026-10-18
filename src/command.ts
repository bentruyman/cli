import { parseArgv, type ParsedArgv } from "./parse.js";

import {
  MissingArgumentError,
  InvalidArgumentError,
  InvalidOptionError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownSubcommandError,
  ReservedOptionError,
  ValidationError,
  InvalidChoiceError,
} from "./errors.js";
import { findSuggestions } from "./suggestions.js";
import { formatHelp, formatHybridHelp, formatParentHelp } from "./help.js";
import type {
  AnyCommand,
  ArgsToValues,
  CommandGroups,
  CommandOptions,
  Examples,
  HybridCommandOptions,
  LeafCommandOptions,
  MergeOptions,
  NormalizedOptions,
  Options,
  Option,
  OptionsToValues,
  ParentCommandOptions,
  PositionalArg,
} from "./types.js";

function isHybridOptions<T extends readonly PositionalArg[], O extends Options, I extends Options>(
  opts: CommandOptions<T, O, I>,
): opts is HybridCommandOptions<T, O, I> {
  return (
    "subcommands" in opts &&
    Array.isArray(opts.subcommands) &&
    "handler" in opts &&
    typeof opts.handler === "function"
  );
}

function isParentOptions<T extends readonly PositionalArg[], O extends Options, I extends Options>(
  opts: CommandOptions<T, O, I>,
): opts is ParentCommandOptions<O> {
  return (
    "subcommands" in opts &&
    Array.isArray(opts.subcommands) &&
    !("handler" in opts && typeof opts.handler === "function")
  );
}

export function normalizeOptions(
  options: Options,
  parent: NormalizedOptions = {},
): NormalizedOptions {
  const normalized: NormalizedOptions = Object.assign(Object.create(null), parent);
  for (const [key, opt] of Object.entries(options)) {
    normalized[key] = {
      ...parent[key],
      ...opt,
      long: opt.long ?? key,
    } as NormalizedOptions[string];
  }
  return normalized;
}

async function readStdin(): Promise<string> {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

/**
 * Represents a CLI command with type-safe arguments and options.
 *
 * Commands can be either leaf commands (with a handler) or parent commands (with subcommands).
 * Use the {@link command} factory function to create commands with proper type inference.
 *
 * @example
 * ```typescript
 * import { command } from "@truyman/cli";
 *
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
  /** Whether command is hidden from help output */
  readonly hidden?: boolean;
  /** Alternative names for this command */
  readonly aliases?: readonly string[];
  /** Positional argument definitions */
  readonly args: T;
  /** Option definitions (normalized with long names) */
  readonly options: NormalizedOptions;
  /** Inherited option definitions from parent commands */
  readonly inherits: NormalizedOptions;
  /** Handler function for leaf commands */
  readonly handler?: (
    args: ArgsToValues<T>,
    options: OptionsToValues<MergeOptions<I, O>>,
  ) => void | Promise<void>;
  /** Map of subcommands for parent commands (by name) */
  readonly subcommands?: Map<string, AnyCommand>;
  /** Map of alias to subcommand for fast lookup */
  private readonly aliasMap?: Map<string, AnyCommand>;
  /** Group definitions for organizing subcommands in help output */
  readonly groups?: CommandGroups;
  /** Examples shown in help output */
  readonly examples?: Examples;

  constructor(cmdOptions: CommandOptions<T, O, I>) {
    for (const name of [cmdOptions.name, ...(cmdOptions.aliases ?? [])]) {
      if (!/^[\w][\w.-]*$/.test(name)) throw new Error(`Invalid command name: ${name}`);
    }
    if ("subcommands" in cmdOptions && cmdOptions.subcommands) {
      const names = new Set<string>();
      for (const child of cmdOptions.subcommands) {
        for (const name of [child.name, ...(child.aliases ?? [])]) {
          if (names.has(name)) throw new Error(`Duplicate command name or alias: ${name}`);
          names.add(name);
        }
      }
    }
    this.name = cmdOptions.name;
    this.description = cmdOptions.description;
    this.version = cmdOptions.version;
    this.hidden = cmdOptions.hidden;
    this.aliases = cmdOptions.aliases;
    this.examples = cmdOptions.examples;
    this.options = normalizeOptions(cmdOptions.options ?? {});

    if (isHybridOptions(cmdOptions)) {
      if (cmdOptions.subcommands.length === 0) {
        throw new Error("Hybrid command must have at least one subcommand");
      }
      this.args = cmdOptions.args ?? ([] as unknown as T);
      this.inherits = normalizeOptions(cmdOptions.inherits ?? {});
      this.handler = cmdOptions.handler;
      this.subcommands = new Map(cmdOptions.subcommands.map((cmd) => [cmd.name, cmd]));

      // Build alias map for fast lookup
      this.aliasMap = new Map();
      for (const cmd of cmdOptions.subcommands) {
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            this.aliasMap.set(alias, cmd);
          }
        }
      }

      this.validateArgs();
      this.validateOptionConflicts();
      this.validateReservedOptions(this.inherits);

      if (cmdOptions.groups) {
        this.validateGroups(cmdOptions.groups);
        this.groups = cmdOptions.groups;
      }
    } else if (isParentOptions(cmdOptions)) {
      if (cmdOptions.subcommands.length === 0) {
        throw new Error("Parent command must have at least one subcommand");
      }
      this.args = [] as unknown as T;
      this.inherits = {};
      this.subcommands = new Map(cmdOptions.subcommands.map((cmd) => [cmd.name, cmd]));

      // Build alias map for fast lookup
      this.aliasMap = new Map();
      for (const cmd of cmdOptions.subcommands) {
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            this.aliasMap.set(alias, cmd);
          }
        }
      }

      if (cmdOptions.groups) {
        this.validateGroups(cmdOptions.groups);
        this.groups = cmdOptions.groups;
      }
    } else {
      this.args = cmdOptions.args ?? ([] as unknown as T);
      this.inherits = normalizeOptions(cmdOptions.inherits ?? {});
      this.handler = cmdOptions.handler;
      this.validateArgs();
      this.validateOptionConflicts();
      this.validateReservedOptions(this.inherits);
    }

    this.validateReservedOptions(this.options);
    this.validateTreeOptions({});
  }

  private validateTreeOptions(parent: NormalizedOptions): void {
    const local = { ...this.inherits, ...this.options };
    for (const [key, opt] of Object.entries(local)) {
      const ancestor = Object.hasOwn(parent, key) ? parent[key] : undefined;
      if (
        ancestor &&
        (ancestor.type !== opt.type ||
          ancestor.long !== opt.long ||
          ancestor.short !== opt.short ||
          !!ancestor.multiple !== !!opt.multiple ||
          !!ancestor.negatable !== !!opt.negatable)
      ) {
        throw new Error(`Conflicting inherited option definition: ${key}`);
      }
    }
    const definitions = normalizeOptions(local, parent);
    this.validateOptionNames(definitions);
    for (const child of this.subcommands?.values() ?? []) {
      if (child instanceof Command) child.validateTreeOptions(definitions);
    }
  }

  private validateOptionNames(definitions: NormalizedOptions): void {
    const longs = new Set<string>();
    const shorts = new Set<string>();
    for (const opt of Object.values(definitions)) {
      if (!/^[\w][\w.-]*$/.test(opt.long)) throw new Error(`Invalid option name: ${opt.long}`);
      for (const name of [opt.long, ...(opt.negatable ? [`no-${opt.long}`] : [])]) {
        if (longs.has(name)) throw new Error(`Duplicate option: --${name}`);
        longs.add(name);
      }
      if (opt.short) {
        if (!/^[a-zA-Z0-9]$/.test(opt.short)) throw new Error(`Invalid short option: ${opt.short}`);
        if (shorts.has(opt.short)) throw new Error(`Duplicate option: -${opt.short}`);
        shorts.add(opt.short);
      }
      if (opt.negatable && opt.type !== "boolean")
        throw new Error("Only boolean options can be negatable");
      const defaults =
        opt.default === undefined ? [] : Array.isArray(opt.default) ? opt.default : [opt.default];
      if (Array.isArray(opt.default) && !opt.multiple)
        throw new Error(`Only multiple options can have array defaults: ${opt.long}`);
      for (const value of [...(opt.choices ?? []), ...defaults]) {
        if (typeof value !== opt.type || (typeof value === "number" && !Number.isFinite(value))) {
          throw new Error(`Invalid default or choice type for --${opt.long}`);
        }
      }
      for (const value of defaults) {
        if (opt.choices && !opt.choices.includes(value as never))
          throw new Error(`Default is not a choice for --${opt.long}`);
      }
    }
  }

  private validateArgs(): void {
    const variadicIndex = this.args.findIndex((arg) => arg.variadic);
    if (variadicIndex !== -1 && variadicIndex !== this.args.length - 1) {
      const variadicArg = this.args[variadicIndex];
      // variadicIndex is valid since findIndex returned a non-negative index
      const argName = variadicArg?.name ?? "unknown";
      throw new Error(`Variadic argument '${argName}' must be the last argument`);
    }

    for (const arg of this.args) {
      if (arg.allowStdin && arg.type !== "string") {
        throw new Error(`Argument '${arg.name}' can only allow stdin when type is 'string'`);
      }
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

  private validateGroups(groups: CommandGroups): void {
    const subcommandNames = new Set(this.subcommands!.keys());
    const assignedCommands = new Set<string>();

    for (const [groupName, commandNames] of Object.entries(groups)) {
      for (const cmdName of commandNames) {
        if (!subcommandNames.has(cmdName)) {
          throw new Error(`Group '${groupName}' references unknown subcommand '${cmdName}'`);
        }
        if (assignedCommands.has(cmdName)) {
          throw new Error(`Subcommand '${cmdName}' is assigned to multiple groups`);
        }
        assignedCommands.add(cmdName);
      }
    }
  }

  /**
   * Returns true if this command has subcommands (is a parent command or hybrid).
   *
   * @example
   * ```typescript
   * if (cli.isParent()) {
   *   console.log(cli.getSubcommandNames());
   * }
   * ```
   */
  isParent(): boolean {
    return this.subcommands !== undefined && this.subcommands.size > 0;
  }

  /**
   * Returns true if this command has both a handler and subcommands.
   *
   * @example
   * ```typescript
   * if (cli.isHybrid()) {
   *   console.log("Runs a default handler or a subcommand");
   * }
   * ```
   */
  isHybrid(): boolean {
    return (
      this.subcommands !== undefined && this.subcommands.size > 0 && this.handler !== undefined
    );
  }

  /**
   * Get a subcommand by name or alias, or undefined if not found.
   *
   * @example
   * ```typescript
   * const add = cli.getSubcommand("add");
   * await add?.run(["Buy milk"]);
   * ```
   */
  getSubcommand(name: string): AnyCommand | undefined {
    // First check primary names
    const cmd = this.subcommands?.get(name);
    if (cmd) return cmd;

    // Then check aliases
    return this.aliasMap?.get(name);
  }

  /**
   * Get an array of all subcommand names (primary names only).
   *
   * @example
   * ```typescript
   * console.log(cli.getSubcommandNames());
   * // ["add", "list", "remove"]
   * ```
   */
  getSubcommandNames(): string[] {
    return this.subcommands ? Array.from(this.subcommands.keys()) : [];
  }

  /**
   * Get an array of all subcommand names including aliases.
   *
   * @example
   * ```typescript
   * console.log(cli.getAllSubcommandNames());
   * // ["checkout", "co", "switch"]
   * ```
   */
  getAllSubcommandNames(): string[] {
    const names = this.getSubcommandNames();
    if (this.aliasMap) {
      names.push(...this.aliasMap.keys());
    }
    return names;
  }

  /**
   * Generate formatted help text for this command.
   * @returns Colorized help string ready for display
   *
   * @example
   * ```typescript
   * process.stdout.write(cli.help() + "\n");
   * ```
   */
  help(path = this.name, parentOptions: NormalizedOptions = {}): string {
    const inherits = normalizeOptions({ ...this.inherits, ...this.options }, parentOptions);
    const options: NormalizedOptions = {};
    for (const key of Object.keys(this.options)) {
      options[key] = inherits[key]!;
      delete inherits[key];
    }
    if (this.isHybrid() && this.subcommands) {
      return formatHybridHelp({
        name: path,
        description: this.description,
        args: this.args,
        options,
        inherits,
        subcommands: this.subcommands,
        groups: this.groups,
        examples: this.examples,
      });
    }
    if (this.isParent() && this.subcommands) {
      return formatParentHelp({
        name: path,
        description: this.description,
        options: { ...inherits, ...options },
        subcommands: this.subcommands,
        groups: this.groups,
        examples: this.examples,
      });
    }
    return formatHelp({ ...this, name: path, options, inherits, examples: this.examples });
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
   *
   * @example
   * ```typescript
   * await cli.run(["deploy", "--env", "staging"]);
   * ```
   */
  run(argv: string[], inheritedOptions: Record<string, unknown> = {}): void | Promise<void> {
    return this.execute(argv, {}, inheritedOptions, this.name, this.version);
  }

  private execute(
    argv: string[],
    parentDefs: NormalizedOptions,
    inheritedOptions: Record<string, unknown>,
    path: string,
    version?: string,
    scopes: NormalizedOptions[] = [],
  ): void | Promise<void> {
    const source = { help: () => this.help(path, parentDefs) };
    const definitions = normalizeOptions({ ...this.inherits, ...this.options }, parentDefs);
    const parsed = parseArgv(argv, definitions, source, this.isParent());
    if (parsed.commandIndex !== undefined) {
      const index = parsed.commandIndex;
      const name = argv[index]!;
      const child = this.getSubcommand(name);
      if (child) {
        const remaining = [...argv.slice(0, index), ...argv.slice(index + 1)];
        if (child instanceof Command) {
          return child.execute(
            remaining,
            definitions,
            inheritedOptions,
            `${path} ${child.name}`,
            child.version ?? version,
            [...scopes, definitions],
          );
        }
        return child.run(
          argv.slice(index + 1),
          this.extractOptionsFromDefs(parsed, definitions, inheritedOptions),
        );
      }
      if (!this.handler || this.args.length === 0) {
        if (!parsed.help && !parsed.version) {
          throw new UnknownSubcommandError(
            name,
            this.getSubcommandNames(),
            findSuggestions(name, this.getAllSubcommandNames()),
            source,
          );
        }
      }
    }
    const leaf = this.handler && this.isParent() ? parseArgv(argv, definitions, source) : parsed;
    if (leaf.help) {
      process.stdout.write(source.help() + "\n");
      return;
    }
    if (leaf.version) {
      if (!version) throw new InvalidOptionError(`${this.name}: no version specified`, source);
      process.stdout.write(version + "\n");
      return;
    }
    if (!this.handler) {
      throw new MissingSubcommandError(this.name, this.getSubcommandNames(), source);
    }
    const invoke = (resolved: ParsedArgv): void | Promise<void> => {
      try {
        const args = this.extractArgs(resolved);
        const options = this.extractOptionsFromDefs(
          resolved,
          definitions,
          inheritedOptions,
          scopes,
        );
        return this.handler!(args, options as OptionsToValues<MergeOptions<I, O>>);
      } catch (error) {
        if (error instanceof Error && "source" in error && error.source === this)
          error.source = source;
        throw error;
      }
    };
    const resolved = this.resolveStdinArgs(leaf);
    return resolved instanceof Promise ? resolved.then(invoke) : invoke(resolved);
  }

  private resolveStdinArgs(parsed: ParsedArgv): ParsedArgv | Promise<ParsedArgv> {
    let stdin: Promise<string> | undefined;
    const replacements: Promise<void>[] = [];
    const positionals = [...parsed.positionals];

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];
      if (!arg?.allowStdin) continue;

      const replaceAt = (index: number): void => {
        if (positionals[index] !== "-") return;
        stdin ??= readStdin();
        replacements.push(
          stdin.then((input) => {
            positionals[index] = input;
          }),
        );
      };

      if (arg.variadic) {
        for (let j = i; j < positionals.length; j++) {
          replaceAt(j);
        }
        break;
      }

      replaceAt(i);
    }

    if (replacements.length === 0) {
      return parsed;
    }

    return Promise.all(replacements).then(() => ({ ...parsed, positionals }));
  }

  private extractArgs(parsed: ParsedArgv): ArgsToValues<T> {
    const values: unknown[] = [];

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];
      // Loop bounds guarantee arg exists, but TypeScript doesn't know that
      if (!arg) continue;

      if (arg.variadic) {
        const remaining = parsed.positionals.slice(i);

        if (!arg.optional && remaining.length === 0) {
          throw new MissingArgumentError(arg.name, this);
        }

        const typedRemaining = remaining.map((value) => {
          let typedValue: unknown;
          switch (arg.type) {
            case "number": {
              const numValue = Number(value);
              if (!Number.isFinite(numValue) || String(value).trim() === "") {
                throw new InvalidArgumentError(`${arg.name} values must be numbers`, this);
              }
              typedValue = numValue;
              break;
            }
            case "boolean":
              typedValue = value === "true";
              break;
            default:
              typedValue = value;
          }

          if (arg.choices) {
            this.validateChoice(typedValue, arg.choices, arg.name);
          }

          if (arg.validate) {
            this.runValidation(typedValue, arg.validate, arg.name);
          }

          return typedValue;
        });

        values.push(typedRemaining);
        break;
      } else {
        const value = parsed.positionals[i];

        if (value === undefined && !arg.optional) {
          throw new MissingArgumentError(arg.name, this);
        }

        let typedValue: unknown;
        switch (arg.type) {
          case "number": {
            if (value !== undefined) {
              const numValue = Number(value);
              if (!Number.isFinite(numValue) || String(value).trim() === "") {
                throw new InvalidArgumentError(`${arg.name} must be a number`, this);
              }
              typedValue = numValue;
            } else {
              typedValue = undefined;
            }
            break;
          }
          case "boolean":
            typedValue = value !== undefined ? value === "true" : undefined;
            break;
          default:
            typedValue = value;
        }

        if (typedValue !== undefined) {
          if (arg.choices) {
            this.validateChoice(typedValue, arg.choices, arg.name);
          }

          if (arg.validate) {
            this.runValidation(typedValue, arg.validate, arg.name);
          }
        }

        values.push(typedValue);
      }
    }

    if (!this.args.some((arg) => arg.variadic) && parsed.positionals.length > this.args.length) {
      throw new InvalidArgumentError(
        `Unexpected argument: ${parsed.positionals[this.args.length]}`,
        this,
      );
    }
    return values as ArgsToValues<T>;
  }

  private coerceToNumber(value: unknown, key: string): number {
    const numValue = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
    if (!Number.isFinite(numValue) || String(value).trim() === "") {
      throw new InvalidOptionError(`${key} must be a number`, this);
    }
    return numValue;
  }

  private runValidation(
    value: unknown,
    validator: NonNullable<Option["validate"]>,
    name: string,
  ): void {
    const result = (validator as (value: unknown) => true | string)(value);
    if (result !== true) {
      throw new ValidationError(
        typeof result === "string" ? result : `Invalid value for ${name}`,
        this,
      );
    }
  }

  private validateChoice(value: unknown, choices: readonly unknown[], name: string): void {
    if (!choices.includes(value)) {
      throw new InvalidChoiceError(name, value, choices, this);
    }
  }

  private getEnvValue(
    opt: NormalizedOptions[string],
    key: string,
  ): string | number | boolean | undefined {
    if (!opt.env) return undefined;

    const envValue = process.env[opt.env];
    if (envValue === undefined) return undefined;

    switch (opt.type) {
      case "number": {
        const numValue = Number(envValue);
        if (!Number.isFinite(numValue) || envValue.trim() === "") {
          throw new InvalidOptionError(
            `Environment variable ${opt.env} for ${key} must be a number`,
            this,
          );
        }
        return numValue;
      }
      case "boolean":
        return ["1", "true", "yes"].includes(envValue.toLowerCase());
      default:
        return envValue;
    }
  }

  private extractOptionsFromDefs(
    parsed: ParsedArgv,
    optionDefs: NormalizedOptions,
    inherited: Record<string, unknown> = {},
    scopes: NormalizedOptions[] = [],
  ): Record<string, unknown> {
    const values: Record<string, unknown> = Object.create(null);
    for (const [key, opt] of Object.entries(optionDefs)) {
      const raw =
        parsed.values[key] ??
        (Object.hasOwn(inherited, key) ? inherited[key] : undefined) ??
        this.getEnvValue(opt, key) ??
        opt.default;
      const value = opt.multiple
        ? raw === undefined
          ? []
          : Array.isArray(raw)
            ? raw
            : [raw]
        : raw;
      if (!opt.multiple && Array.isArray(value))
        throw new InvalidOptionError(`${key} must be a ${opt.type}`, this);
      const convert = (item: unknown): unknown => {
        const typed = opt.type === "number" ? this.coerceToNumber(item, key) : item;
        if (typeof typed !== opt.type)
          throw new InvalidOptionError(`${key} must be a ${opt.type}`, this);
        return typed;
      };
      values[key] = Array.isArray(value)
        ? value.map(convert)
        : value === undefined
          ? undefined
          : convert(value);
    }
    const validators = new Map<string, Set<NonNullable<Option["validate"]>>>();
    for (const definitions of [...scopes, optionDefs]) {
      for (const [key, opt] of Object.entries(definitions)) {
        const value = values[key];
        if (opt.required && (value === undefined || (Array.isArray(value) && value.length === 0))) {
          throw new MissingOptionError(opt.long, this);
        }
        if (value === undefined) continue;
        const items = Array.isArray(value) ? value : [value];
        if (opt.choices) for (const item of items) this.validateChoice(item, opt.choices, key);
        const seen = validators.get(key) ?? new Set();
        if (opt.validate && !seen.has(opt.validate)) {
          for (const item of items) this.runValidation(item, opt.validate, key);
          seen.add(opt.validate);
          validators.set(key, seen);
        }
      }
    }
    return { ...values };
  }
}

/**
 * Creates a new CLI command with type-safe arguments and options.
 *
 * @example Leaf command with args and options
 * ```typescript
 * import { command } from "@truyman/cli";
 *
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
 * import { command } from "@truyman/cli";
 *
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
 * import { command } from "@truyman/cli";
 *
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
>(options: Omit<HybridCommandOptions<T, O, I>, "inherits"> & { inherits: I }): Command<T, O, I>;
export function command<const T extends readonly PositionalArg[], const O extends Options>(
  options: Omit<HybridCommandOptions<T, O, {}>, "inherits"> & { inherits?: never },
): Command<T, O, {}>;
export function command<
  const T extends readonly PositionalArg[],
  const O extends Options,
  const I extends Options,
>(options: Omit<LeafCommandOptions<T, O, I>, "inherits"> & { inherits: I }): Command<T, O, I>;
export function command<const T extends readonly PositionalArg[], const O extends Options>(
  options: Omit<LeafCommandOptions<T, O, {}>, "inherits"> & { inherits?: never },
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
