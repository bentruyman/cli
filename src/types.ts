/**
 * Maps type names to their TypeScript types.
 * Used to infer the correct type for arguments and options.
 */
export type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
};

/**
 * Defines a positional argument for a command.
 *
 * @example
 * ```typescript
 * const args = [
 *   { name: "source", type: "string", description: "Source file" },
 *   { name: "dest", type: "string", description: "Destination", optional: true }
 * ] as const;
 * ```
 */
export type PositionalArg = {
  /** The name of the argument, shown in help output */
  name: string;
  /** The data type: "string", "number", or "boolean" */
  type: keyof TypeMap;
  /** Description shown in help output */
  description?: string;
  /** If true, argument is not required. Shows as [name] in help instead of <name> */
  optional?: boolean;
  /** If true, collects all remaining positional arguments into an array. Must be the last arg. */
  variadic?: boolean;
  /**
   * Restricts the argument value to a predefined set of choices.
   * Use `as const` for type inference.
   * @example
   * ```typescript
   * { choices: ["start", "stop", "restart"] as const }
   * ```
   */
  choices?: readonly (string | number | boolean)[];
  /**
   * Custom validation function called after type coercion.
   * Return true if valid, or a string error message if invalid.
   * @example
   * ```typescript
   * { validate: (v) => v.length > 0 || "Value cannot be empty" }
   * ```
   */
  validate?: (value: unknown) => true | string;
};

/**
 * Defines a command-line option (flag).
 *
 * @example
 * ```typescript
 * const options = {
 *   verbose: { type: "boolean", short: "v", description: "Enable verbose output" },
 *   port: { type: "number", default: 3000, description: "Port to listen on" },
 *   config: { type: "string", required: true, placeholder: "path" }
 * } as const;
 * ```
 */
export type Option = {
  /** Description shown in help output */
  description?: string;
  /** The data type: "string", "number", or "boolean" */
  type: keyof TypeMap;
  /**
   * Long flag name (e.g., "verbose" for --verbose).
   * If omitted, inferred from the option's key name.
   */
  long?: string;
  /** Short flag name (e.g., "v" for -v) */
  short?: string;
  /**
   * If true, option can be specified multiple times and values are collected into an array.
   * @example
   * ```typescript
   * { file: { type: "string", multiple: true } }
   * // Allows: --file a.txt --file b.txt → ["a.txt", "b.txt"]
   * ```
   */
  multiple?: boolean;
  /**
   * Default value used when option is not provided.
   * Options with defaults are never undefined in the handler.
   */
  default?: string | number | boolean;
  /**
   * If true, option must be provided (unless it has a default).
   * Missing required options throw MissingOptionError.
   */
  required?: boolean;
  /**
   * Custom placeholder shown in help output.
   * @example
   * ```typescript
   * { config: { type: "string", placeholder: "path" } }
   * // Shows: --config=<path> instead of --config=<str>
   * ```
   */
  placeholder?: string;
  /**
   * Environment variable name to use as fallback when option is not provided via CLI.
   * Precedence: CLI argument > environment variable > default value.
   * @example
   * ```typescript
   * { token: { type: "string", env: "API_TOKEN" } }
   * // Value can come from --token or API_TOKEN env var
   * ```
   */
  env?: string;
  /**
   * If true, allows --no-<flag> syntax to explicitly set false.
   * Only valid for boolean options.
   * @example
   * ```typescript
   * { color: { type: "boolean", negatable: true } }
   * // Allows: --color or --no-color
   * ```
   */
  negatable?: boolean;
  /**
   * Restricts the option value to a predefined set of choices.
   * Use `as const` for type inference.
   * @example
   * ```typescript
   * { choices: ["json", "yaml", "toml"] as const }
   * ```
   */
  choices?: readonly (string | number | boolean)[];
  /**
   * Custom validation function called after type coercion.
   * Return true if valid, or a string error message if invalid.
   * For `multiple` options, validation runs on each value.
   * @example
   * ```typescript
   * { validate: (v) => v >= 1 && v <= 65535 || "Port must be 1-65535" }
   * ```
   */
  validate?: (value: unknown) => true | string;
};

/** Record of option definitions keyed by option name */
export type Options = Record<string, Option>;

/** Option with `long` guaranteed to be present (after normalization) */
export type NormalizedOption = Option & { long: string };

/** Record of normalized options */
export type NormalizedOptions = Record<string, NormalizedOption>;

/**
 * Maps group names to arrays of subcommand names for organized help output.
 * Groups are displayed in definition order, with ungrouped commands appearing last.
 *
 * @example
 * ```typescript
 * const groups: CommandGroups = {
 *   'Project': ['init', 'build', 'test'],
 *   'Development': ['serve', 'watch'],
 * };
 * ```
 */
export type CommandGroups = Record<string, string[]>;

/**
 * A single example for help output.
 * Can be a simple command string or an object with command and description.
 *
 * @example
 * ```typescript
 * // Simple string
 * 'my-cli init myapp'
 *
 * // With description
 * { command: 'my-cli deploy --env staging', description: 'Deploy to staging' }
 * ```
 */
export type Example = string | { command: string; description?: string };

/** Array of examples shown in help output */
export type Examples = Example[];

/** Converts positional arg definitions to a tuple of their runtime value types */
export type ArgsToValues<T extends readonly PositionalArg[]> = {
  [K in keyof T]: T[K] extends { choices: readonly (infer C)[]; variadic: true }
    ? C[]
    : T[K] extends { choices: readonly (infer C)[]; optional: true }
      ? C | undefined
      : T[K] extends { choices: readonly (infer C)[] }
        ? C
        : T[K] extends { type: infer U extends keyof TypeMap; variadic: true }
          ? TypeMap[U][]
          : T[K] extends { type: infer U extends keyof TypeMap; optional: true }
            ? TypeMap[U] | undefined
            : T[K] extends { type: infer U extends keyof TypeMap }
              ? TypeMap[U]
              : never;
};

/** Converts option definitions to an object type with their runtime value types */
export type OptionsToValues<O extends Options> = {
  [K in keyof O]: O[K] extends { choices: readonly (infer C)[]; multiple: true }
    ? C[]
    : O[K] extends { choices: readonly (infer C)[]; default: infer _D }
      ? C
      : O[K] extends { choices: readonly (infer C)[]; required: true }
        ? C
        : O[K] extends { choices: readonly (infer C)[] }
          ? C | undefined
          : O[K] extends { multiple: true; type: infer U extends keyof TypeMap }
            ? TypeMap[U][]
            : O[K] extends { type: "boolean" }
              ? boolean
              : O[K] extends { type: infer U extends keyof TypeMap; default: infer _D }
                ? TypeMap[U]
                : O[K] extends { type: infer U extends keyof TypeMap; required: true }
                  ? TypeMap[U]
                  : O[K] extends { type: infer U extends keyof TypeMap }
                    ? TypeMap[U] | undefined
                    : never;
};

/** Merges inherited and own options into a single type */
export type MergeOptions<I extends Options, O extends Options> = I & O;

type BaseCommandOptions = {
  /** Command name shown in help output and used for subcommand routing */
  name: string;
  /** Description shown in help output */
  description?: string;
  /** Version string shown when --version or -V is passed */
  version?: string;
  /** Examples shown in help output, after description and before usage */
  examples?: Examples;
  /** If true, command is hidden from help output (e.g., for internal commands like completions) */
  hidden?: boolean;
  /**
   * Alternative names for this command.
   * Useful for shortcuts like "co" for "checkout".
   * @example
   * ```typescript
   * { name: "checkout", aliases: ["co", "switch"] }
   * // Can be invoked as: my-cli checkout, my-cli co, or my-cli switch
   * ```
   */
  aliases?: string[];
};

/**
 * Configuration for a leaf command (a command with a handler, no subcommands).
 *
 * @example
 * ```typescript
 * const greet: LeafCommandOptions = {
 *   name: "greet",
 *   description: "Greet a user",
 *   args: [{ name: "name", type: "string" }] as const,
 *   options: {
 *     loud: { type: "boolean", description: "Shout the greeting" }
 *   },
 *   handler: ([name], { loud }) => {
 *     const msg = `Hello, ${name}!`;
 *     console.log(loud ? msg.toUpperCase() : msg);
 *   }
 * };
 * ```
 */
export type LeafCommandOptions<
  T extends readonly PositionalArg[] = readonly PositionalArg[],
  O extends Options = Options,
  I extends Options = {},
> = BaseCommandOptions & {
  /** Positional arguments. Use `as const` for type inference. */
  args?: T;
  /** Option definitions */
  options?: O;
  /**
   * Options inherited from parent commands.
   * These are merged with own options and passed to the handler.
   */
  inherits?: I;
  /**
   * Handler function called when the command is executed.
   * Receives parsed args as a tuple and options as an object.
   */
  handler: (
    args: ArgsToValues<T>,
    options: OptionsToValues<MergeOptions<I, O>>,
  ) => void | Promise<void>;
  /** Must be undefined for leaf commands */
  subcommands?: never;
};

/**
 * Interface implemented by all commands.
 * Used for type-safe subcommand references.
 */
export interface AnyCommand {
  readonly name: string;
  readonly description?: string;
  readonly hidden?: boolean;
  readonly aliases?: readonly string[];
  readonly options: NormalizedOptions;
  /** Execute the command with the given arguments */
  run(argv: string[], inheritedOptions?: Record<string, unknown>): void | Promise<void>;
  /** Generate help text for this command */
  help(): string;
}

/**
 * Configuration for a parent command (a command with subcommands, no handler).
 *
 * @example
 * ```typescript
 * const git: ParentCommandOptions = {
 *   name: "git",
 *   description: "Version control system",
 *   options: {
 *     verbose: { type: "boolean", short: "v" }
 *   },
 *   subcommands: [clone, commit, push]
 * };
 * ```
 */
export type ParentCommandOptions<O extends Options = Options> = BaseCommandOptions & {
  /** Array of subcommands */
  subcommands: AnyCommand[];
  /** Options that are parsed at this level and passed to subcommands */
  options?: O;
  /**
   * Optional grouping of subcommands for help display.
   * Keys are group names, values are arrays of subcommand names.
   * Grouped commands appear first in definition order; ungrouped commands appear last.
   */
  groups?: CommandGroups;
  /** Must be undefined for parent commands */
  handler?: never;
  /** Must be undefined for parent commands */
  args?: never;
};

/** Union of leaf and parent command options */
export type CommandOptions<
  T extends readonly PositionalArg[] = readonly PositionalArg[],
  O extends Options = Options,
  I extends Options = {},
> = LeafCommandOptions<T, O, I> | ParentCommandOptions<O>;
