class BaseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;

    if ("captureStackTrace" in Error) {
      (Error as any).captureStackTrace(this, new.target);
    }
  }
}

/** Interface for error sources that can provide help text */
export interface ErrorSource {
  help(): string;
}

/** Thrown when an option value is invalid (e.g., non-numeric value for number option) */
export class InvalidOptionError extends BaseError {
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(message: string, source?: ErrorSource) {
    super(message);
    this.source = source;
  }
}

/** Thrown when a required option is not provided */
export class MissingOptionError extends BaseError {
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(optionName: string, source?: ErrorSource) {
    super(`Missing required option: --${optionName}`);
    this.source = source;
  }
}

/** Thrown when a required positional argument is not provided */
export class MissingArgumentError extends BaseError {
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(argName: string, source?: ErrorSource) {
    super(`Missing required argument: ${argName}`);
    this.source = source;
  }
}

/** Thrown when a positional argument value is invalid (e.g., non-numeric value for number arg) */
export class InvalidArgumentError extends BaseError {
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(message: string, source?: ErrorSource) {
    super(message);
    this.source = source;
  }
}

/** Thrown when a parent command is invoked without a subcommand */
export class MissingSubcommandError extends BaseError {
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

/** Thrown when an unknown subcommand is provided */
export class UnknownSubcommandError extends BaseError {
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

/** Thrown when an unknown option/flag is provided */
export class UnknownOptionError extends BaseError {
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
  constructor(flag: string) {
    super(`Cannot override reserved flag: ${flag}`);
  }
}

/** Thrown when a custom validation function returns an error */
export class ValidationError extends BaseError {
  /** The command where the error occurred, used for displaying help */
  source?: ErrorSource;

  constructor(message: string, source?: ErrorSource) {
    super(message);
    this.source = source;
  }
}
