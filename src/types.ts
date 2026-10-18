/**
 * Maps type names to their TypeScript types.
 * Used to infer the correct type for arguments and options.
 */
export type TypeMap = {
  string: string;
  number: number;
  boolean: boolean;
};

type TypedValue = {
  [K in keyof TypeMap]: {
    type: K;
    choices?: readonly TypeMap[K][];
    validate?: (value: TypeMap[K]) => true | string;
  };
}[keyof TypeMap];

/**
 * Defines a positional argument for a command.
 *
 * @example
 * ```typescript
 * import type { PositionalArg } from "@truyman/cli";
 *
 * const args = [
 *   { name: "source", type: "string", description: "Source file" },
 *   { name: "dest", type: "string", description: "Destination", optional: true }
 * ] as const satisfies readonly PositionalArg[];
 * ```
 */
export type PositionalArg = TypedValue & {
  /** Name shown in help output. */
  name: string;
  description?: string;
  /** Allows an omitted value. */
  optional?: boolean;
  /** Collects remaining operands into an array; must be last. */
  variadic?: boolean;
  /** If true, a literal "-" value reads this string argument from stdin. */
  allowStdin?: boolean;
};

/**
 * Defines a command-line option (flag).
 *
 * @example
 * ```typescript
 * import type { Options } from "@truyman/cli";
 *
 * const options = {
 *   verbose: { type: "boolean", short: "v", description: "Enable verbose output" },
 *   port: { type: "number", default: 3000, description: "Port to listen on" },
 *   config: { type: "string", required: true, placeholder: "path" }
 * } as const satisfies Options;
 * ```
 */
export type Option = {
  description?: string;
  /** Long flag name; defaults to the option key. */
  long?: string;
  /** Single-character short flag. */
  short?: string;
  /** Requires a value from CLI, environment, or default. Multiple options require a nonempty array. */
  required?: boolean;
  placeholder?: string;
  /** Environment fallback, after CLI and before default. For multiple options this is one value. */
  env?: string;
} & {
  [K in keyof TypeMap]: {
    type: K;
    choices?: readonly TypeMap[K][];
    /** Validates each coerced value. Return true or an error message. */
    validate?: (value: TypeMap[K]) => true | string;
    /** Enables --no-<flag>, for booleans only. */
    negatable?: K extends "boolean" ? boolean : never;
  } & (
    | { multiple: true; default?: TypeMap[K] | readonly TypeMap[K][] }
    | { multiple?: false; default?: TypeMap[K] }
  );
}[keyof TypeMap];

/**
 * Record of option definitions keyed by option name.
 *
 * @example
 * ```typescript
 * import type { Options } from "@truyman/cli";
 *
 * const options = {
 *   verbose: { type: "boolean", short: "v" },
 *   output: { type: "string", short: "o", placeholder: "file" },
 * } as const satisfies Options;
 * ```
 */
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
 * import type { CommandGroups } from "@truyman/cli";
 *
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
 * import type { Example } from "@truyman/cli";
 *
 * // Simple string
 * const initExample: Example = 'my-cli init myapp';
 *
 * // With description
 * const deployExample: Example = {
 *   command: 'my-cli deploy --env staging',
 *   description: 'Deploy to staging',
 * };
 * ```
 */
export type Example = string | { command: string; description?: string };

/**
 * Array of examples shown in help output.
 *
 * @example
 * ```typescript
 * import type { Examples } from "@truyman/cli";
 *
 * const examples: Examples = [
 *   "notes add \"Ship it\"",
 *   { command: "notes list --tag work", description: "Show work notes" },
 * ];
 * ```
 */
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
    : O[K] extends { choices: readonly (infer C)[]; default: string | number | boolean }
      ? C
      : O[K] extends { choices: readonly (infer C)[]; required: true }
        ? C
        : O[K] extends { choices: readonly (infer C)[] }
          ? C | undefined
          : O[K] extends { multiple: true; type: infer U extends keyof TypeMap }
            ? TypeMap[U][]
            : O[K] extends {
                  type: infer U extends keyof TypeMap;
                  default: string | number | boolean;
                }
              ? TypeMap[U]
              : O[K] extends { type: infer U extends keyof TypeMap; required: true }
                ? TypeMap[U]
                : O[K] extends { type: infer U extends keyof TypeMap }
                  ? TypeMap[U] | undefined
                  : never;
};

/**
 * Merges inherited and own option definitions into one handler option type.
 *
 * @example
 * ```typescript
 * import type { MergeOptions } from "@truyman/cli";
 *
 * type GlobalOptions = { verbose: { type: "boolean" } };
 * type LocalOptions = { output: { type: "string"; required: true } };
 *
 * type CombinedOptions = MergeOptions<GlobalOptions, LocalOptions>;
 * ```
 */
export type MergeOptions<I extends Options, O extends Options> = I & O;

type BaseCommandOptions = {
  /** Command name shown in help output and used for subcommand routing */
  name: string;
  /** Description shown in help output */
  description?: string;
  /** Version string shown when --version or -V is passed */
  version?: string;
  /**
   * Examples shown in help output, after description and before usage.
   *
   * @example
   * ```typescript
   * examples: [
   *   "deploy staging",
   *   { command: "deploy production --force", description: "Skip confirmation" },
   * ]
   * ```
   */
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
 * import type { LeafCommandOptions } from "@truyman/cli";
 *
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
  /** Positional arguments. Inline definitions infer their tuple types. */
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
 *
 * @example
 * ```typescript
 * import type { AnyCommand } from "@truyman/cli";
 *
 * function printHelp(cmd: AnyCommand) {
 *   console.log(cmd.help());
 * }
 * ```
 */
export interface AnyCommand {
  readonly name: string;
  readonly description?: string;
  readonly hidden?: boolean;
  readonly aliases?: readonly string[];
  readonly options: NormalizedOptions;
  /**
   * Execute the command with the given arguments.
   *
   * @example
   * ```typescript
   * await cmd.run(["build", "--watch"]);
   * ```
   */
  run(argv: string[], inheritedOptions?: Record<string, unknown>): void | Promise<void>;
  /**
   * Generate help text for this command.
   *
   * @example
   * ```typescript
   * console.log(cmd.help());
   * ```
   */
  help(): string;
}

/**
 * Configuration for a parent command (a command with subcommands, no handler).
 *
 * @example
 * ```typescript
 * import type { ParentCommandOptions } from "@truyman/cli";
 *
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

/**
 * Configuration for a hybrid command (a command with both a handler and subcommands).
 * The handler runs as the default when no subcommand matches.
 *
 * @example
 * ```typescript
 * import type { HybridCommandOptions } from "@truyman/cli";
 *
 * const docker: HybridCommandOptions = {
 *   name: "docker",
 *   description: "Container management",
 *   args: [{ name: "info", type: "string", optional: true }] as const,
 *   options: { verbose: { type: "boolean" } },
 *   handler: ([info], { verbose }) => { console.log("default handler"); },
 *   subcommands: [run, build, push]
 * };
 * ```
 */
export type HybridCommandOptions<
  T extends readonly PositionalArg[] = readonly PositionalArg[],
  O extends Options = Options,
  I extends Options = {},
> = BaseCommandOptions & {
  /** Positional arguments for the default handler; inline tuples are inferred. */
  args?: T;
  /** Option definitions */
  options?: O;
  /**
   * Options inherited from parent commands.
   * These are merged with own options and passed to the handler.
   */
  inherits?: I;
  /**
   * Handler function called when no subcommand matches.
   * Receives parsed args as a tuple and options as an object.
   */
  handler: (
    args: ArgsToValues<T>,
    options: OptionsToValues<MergeOptions<I, O>>,
  ) => void | Promise<void>;
  /** Array of subcommands */
  subcommands: AnyCommand[];
  /**
   * Optional grouping of subcommands for help display.
   * Keys are group names, values are arrays of subcommand names.
   */
  groups?: CommandGroups;
};

/**
 * Union of leaf, parent, and hybrid command options.
 *
 * @example
 * ```typescript
 * import { command, type CommandOptions } from "@truyman/cli";
 *
 * const options = {
 *   name: "hello",
 *   handler: () => console.log("Hello"),
 * } satisfies CommandOptions;
 *
 * const hello = command(options);
 * ```
 */
export type CommandOptions<
  T extends readonly PositionalArg[] = readonly PositionalArg[],
  O extends Options = Options,
  I extends Options = {},
> = LeafCommandOptions<T, O, I> | ParentCommandOptions<O> | HybridCommandOptions<T, O, I>;
