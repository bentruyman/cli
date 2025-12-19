import type { Options } from "../../src/index";

// Global options shared across all commands
export const GlobalOptions = {
  verbose: {
    type: "boolean",
    long: "verbose",
    short: "v",
    description: "Enable verbose output",
  },
  config: {
    type: "string",
    long: "config",
    short: "c",
    description: "Path to config file",
  },
} as const satisfies Options;
