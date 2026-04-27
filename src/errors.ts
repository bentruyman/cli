abstract class BaseError extends Error {
  /** Stable error code that survives bundling (unlike class names) */
  abstract readonly code: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;

    if ("captureStackTrace" in Error) {
      (Error as any).captureStackTrace(this, new.target);
    }
  }
}

/**
 * Interface for error sources that can provide help text.
 */
export interface ErrorSource {
  help(): string;
}

/**
 * Thrown when an option value is invalid (e.g., non-numeric value for number option).
 *
 * @example
 * ```typescript
 * import { InvalidOptionError } from "@truyman/cli";
 *
 * try {
 *   await cli.run(["--port", "abc"]);
 * } catch (error) {
 *   if (error instanceof InvalidOptionError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class InvalidOptionError extends BaseError {
  readonly code = "INVALID_OPTION";
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(message: string, source?: ErrorSource) {
    super(message);
    this.source = source;
  }
}

/**
 * Thrown when a required option is not provided.
 *
 * @example
 * ```typescript
 * import { MissingOptionError } from "@truyman/cli";
 *
 * try {
 *   await cli.run([]);
 * } catch (error) {
 *   if (error instanceof MissingOptionError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class MissingOptionError extends BaseError {
  readonly code = "MISSING_OPTION";
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(optionName: string, source?: ErrorSource) {
    super(`Missing required option: --${optionName}`);
    this.source = source;
  }
}

/**
 * Thrown when a required positional argument is not provided.
 *
 * @example
 * ```typescript
 * import { MissingArgumentError } from "@truyman/cli";
 *
 * try {
 *   await cli.run([]);
 * } catch (error) {
 *   if (error instanceof MissingArgumentError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class MissingArgumentError extends BaseError {
  readonly code = "MISSING_ARGUMENT";
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(argName: string, source?: ErrorSource) {
    super(`Missing required argument: ${argName}`);
    this.source = source;
  }
}

/**
 * Thrown when a positional argument value is invalid (e.g., non-numeric value for number arg).
 *
 * @example
 * ```typescript
 * import { InvalidArgumentError } from "@truyman/cli";
 *
 * try {
 *   await cli.run(["not-a-number"]);
 * } catch (error) {
 *   if (error instanceof InvalidArgumentError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class InvalidArgumentError extends BaseError {
  readonly code = "INVALID_ARGUMENT";
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(message: string, source?: ErrorSource) {
    super(message);
    this.source = source;
  }
}

/**
 * Thrown when a parent command is invoked without a subcommand.
 *
 * @example
 * ```typescript
 * import { MissingSubcommandError } from "@truyman/cli";
 *
 * try {
 *   await cli.run([]);
 * } catch (error) {
 *   if (error instanceof MissingSubcommandError) {
 *     console.error(error.availableSubcommands);
 *   }
 * }
 * ```
 */
export class MissingSubcommandError extends BaseError {
  readonly code = "MISSING_SUBCOMMAND";
  /** List of valid subcommand names */
  availableSubcommands: string[];
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(commandName: string, availableSubcommands: string[], source?: ErrorSource) {
    const available = availableSubcommands.join(", ");
    super(`Missing subcommand for '${commandName}'. Available: ${available}`);
    this.availableSubcommands = availableSubcommands;
    this.source = source;
  }
}

/**
 * Thrown when an unknown subcommand is provided.
 *
 * @example
 * ```typescript
 * import { UnknownSubcommandError } from "@truyman/cli";
 *
 * try {
 *   await cli.run(["lst"]);
 * } catch (error) {
 *   if (error instanceof UnknownSubcommandError) {
 *     console.error(error.suggestions);
 *   }
 * }
 * ```
 */
export class UnknownSubcommandError extends BaseError {
  readonly code = "UNKNOWN_SUBCOMMAND";
  /** List of valid subcommand names */
  availableSubcommands: string[];
  /** Suggested similar subcommands based on edit distance */
  suggestions: string[];
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(
    subcommand: string,
    availableSubcommands: string[],
    suggestions: string[] = [],
    source?: ErrorSource,
  ) {
    let message: string;
    if (suggestions.length > 0) {
      message = `Unknown subcommand '${subcommand}'. Did you mean '${suggestions[0]}'?`;
    } else {
      const available = availableSubcommands.join(", ");
      message = `Unknown subcommand '${subcommand}'. Available: ${available}`;
    }
    super(message);
    this.availableSubcommands = availableSubcommands;
    this.suggestions = suggestions;
    this.source = source;
  }
}

/**
 * Thrown when an unknown option/flag is provided.
 *
 * @example
 * ```typescript
 * import { UnknownOptionError } from "@truyman/cli";
 *
 * try {
 *   await cli.run(["--verbsoe"]);
 * } catch (error) {
 *   if (error instanceof UnknownOptionError) {
 *     console.error(error.suggestions);
 *   }
 * }
 * ```
 */
export class UnknownOptionError extends BaseError {
  readonly code = "UNKNOWN_OPTION";
  /** The unknown option that was provided */
  unknownOption: string;
  /** List of valid option names */
  availableOptions: string[];
  /** Suggested similar options based on edit distance */
  suggestions: string[];
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(
    unknownOption: string,
    availableOptions: string[],
    suggestions: string[] = [],
    source?: ErrorSource,
  ) {
    let message: string;
    if (suggestions.length > 0) {
      message = `Unknown option '${unknownOption}'. Did you mean '${suggestions[0]}'?`;
    } else {
      message = `Unknown option '${unknownOption}'`;
    }
    super(message);
    this.unknownOption = unknownOption;
    this.availableOptions = availableOptions;
    this.suggestions = suggestions;
    this.source = source;
  }
}

/** Thrown when attempting to define an option that conflicts with built-in flags (--help, --version) */
export class ReservedOptionError extends BaseError {
  readonly code = "RESERVED_OPTION";

  constructor(flag: string) {
    super(`Cannot override reserved flag: ${flag}`);
  }
}

/**
 * Thrown when a custom validation function returns an error.
 *
 * @example
 * ```typescript
 * import { ValidationError } from "@truyman/cli";
 *
 * try {
 *   await cli.run(["--port", "0"]);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error(error.message);
 *   }
 * }
 * ```
 */
export class ValidationError extends BaseError {
  readonly code = "VALIDATION_ERROR";
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(message: string, source?: ErrorSource) {
    super(message);
    this.source = source;
  }
}

/**
 * Thrown when a value is not one of the allowed choices.
 *
 * @example
 * ```typescript
 * import { InvalidChoiceError } from "@truyman/cli";
 *
 * try {
 *   await cli.run(["--format", "xml"]);
 * } catch (error) {
 *   if (error instanceof InvalidChoiceError) {
 *     console.error(error.choices);
 *   }
 * }
 * ```
 */
export class InvalidChoiceError extends BaseError {
  readonly code = "INVALID_CHOICE";
  /** The value that was provided */
  value: unknown;
  /** The list of valid choices */
  choices: readonly unknown[];
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(name: string, value: unknown, choices: readonly unknown[], source?: ErrorSource) {
    const choicesList = choices.join(", ");
    super(`Invalid value '${value}' for ${name}. Valid choices: ${choicesList}`);
    this.value = value;
    this.choices = choices;
    this.source = source;
  }
}
