import { describe, expect, it } from "bun:test";
import { command, type Options } from "../src/index";

describe("type inference for inherited options", () => {
  it("correctly types inherited options in handler", () => {
    const GlobalOptions = {
      verbose: { type: "boolean", long: "verbose" },
      count: { type: "number", long: "count" },
      name: { type: "string", long: "name" },
    } as const satisfies Options;

    let capturedVerbose: boolean = false;
    let capturedCount: number | undefined;
    let capturedName: string | undefined;
    let capturedOwn: boolean = false;

    // This tests that TypeScript correctly infers:
    // - verbose as boolean (always defined for boolean options)
    // - count as number | undefined
    // - name as string | undefined
    // - own as boolean (always defined for boolean options)
    const child = command({
      name: "child",
      inherits: GlobalOptions,
      options: {
        own: { type: "boolean", long: "own" },
      } as const,
      handler: (_, opts) => {
        // These assignments will cause compile errors if types are wrong
        capturedVerbose = opts.verbose;
        capturedCount = opts.count;
        capturedName = opts.name;
        capturedOwn = opts.own;
      },
    });

    child.run(["--verbose", "--count", "42", "--name", "test", "--own"]);

    expect(capturedVerbose).toBeTrue();
    expect(capturedCount).toBe(42);
    expect(capturedName).toBe("test");
    expect(capturedOwn).toBeTrue();
  });

  it("correctly types multi-level inherited options", () => {
    const RootOptions = {
      debug: { type: "boolean", long: "debug" },
    } as const satisfies Options;

    const MiddleOptions = {
      ...RootOptions,
      format: { type: "string", long: "format" },
    } as const satisfies Options;

    let capturedDebug: boolean = false;
    let capturedFormat: string | undefined;
    let capturedLimit: number | undefined;

    const leaf = command({
      name: "leaf",
      inherits: MiddleOptions,
      options: {
        limit: { type: "number", long: "limit" },
      } as const,
      handler: (_, opts) => {
        // These assignments will cause compile errors if types are wrong
        capturedDebug = opts.debug;
        capturedFormat = opts.format;
        capturedLimit = opts.limit;
      },
    });

    const middle = command({
      name: "middle",
      options: MiddleOptions,
      subcommands: [leaf],
    });

    const root = command({
      name: "root",
      options: RootOptions,
      subcommands: [middle],
    });

    root.run(["middle", "leaf", "--debug", "--format", "json", "--limit", "10"]);

    expect(capturedDebug).toBeTrue();
    expect(capturedFormat).toBe("json");
    expect(capturedLimit).toBe(10);
  });
});
