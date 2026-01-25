import { describe, expect, it, spyOn } from "bun:test";

import { command } from "../src/command";
import { run } from "../src/index";
import {
  MissingArgumentError,
  InvalidArgumentError,
  InvalidOptionError,
  MissingOptionError,
  MissingSubcommandError,
  UnknownSubcommandError,
  UnknownOptionError,
  ReservedOptionError,
} from "../src/errors";

describe("command", () => {
  it("executes its handler", () => {
    let executed = false;

    const cmd = command({
      name: "my-cli",
      handler: () => {
        executed = true;
      },
    });

    cmd.run([]);

    expect(executed).toBeTrue();
  });

  it("executes async handlers", async () => {
    let executed = false;

    const cmd = command({
      name: "my-cli",
      handler: async () => {
        await Promise.resolve();
        executed = true;
      },
    });

    await cmd.run([]);

    expect(executed).toBeTrue();
  });

  it("propagates errors from async handlers", async () => {
    const cmd = command({
      name: "my-cli",
      handler: async () => {
        await Promise.resolve();
        throw new Error("async error");
      },
    });

    await expect(cmd.run([])).rejects.toThrow("async error");
  });

  describe("args", () => {
    it("parses 'number' positional args", () => {
      const expected = 9;
      let actual = 0;

      const cmd = command({
        name: "my-cli",
        args: [{ name: "num", type: "number" }],
        handler: (args) => {
          actual = args[0];
        },
      });

      cmd.run([`${expected}`]);

      expect(actual).toBe(expected);
    });

    it("parses 'string' positional args", () => {
      let actual = "";

      const cmd = command({
        name: "my-cli",
        args: [{ name: "str", type: "string" }],
        handler: (args) => {
          actual = args[0];
        },
      });

      cmd.run(["foo"]);

      expect(actual).toBe("foo");
    });

    it("allows positions to be optional", () => {
      let actual: string | undefined;

      const cmd = command({
        name: "my-cli",
        args: [{ name: "str", type: "string", optional: true }],
        handler: (args) => {
          actual = args[0];
        },
      });

      cmd.run([]);

      expect(actual).toBeUndefined();

      cmd.run(["foo"]);

      expect(actual).toBe("foo");
    });

    it("throws an error for missing non-optional positional args", () => {
      const cmd = command({
        name: "my-cli",
        args: [{ name: "str", type: "string", optional: false }],
        handler: () => {},
      });

      expect(() => cmd.run([])).toThrow(MissingArgumentError);
    });

    it("throws an error for number args that are not valid numbers", () => {
      const cmd = command({
        name: "my-cli",
        args: [{ name: "count", type: "number" }],
        handler: () => {},
      });

      expect(() => cmd.run(["abc"])).toThrow(InvalidArgumentError);
    });

    describe("variadic", () => {
      it("collects remaining args into an array", () => {
        let actual: string[] = [];

        const cmd = command({
          name: "my-cli",
          args: [{ name: "files", type: "string", variadic: true }] as const,
          handler: ([files]) => {
            actual = files;
          },
        });

        cmd.run(["a.txt", "b.txt", "c.txt"]);

        expect(actual).toEqual(["a.txt", "b.txt", "c.txt"]);
      });

      it("works with preceding non-variadic args", () => {
        let dest = "";
        let files: string[] = [];

        const cmd = command({
          name: "copy",
          args: [
            { name: "dest", type: "string" },
            { name: "files", type: "string", variadic: true },
          ] as const,
          handler: ([d, f]) => {
            dest = d;
            files = f;
          },
        });

        cmd.run(["output/", "a.txt", "b.txt"]);

        expect(dest).toBe("output/");
        expect(files).toEqual(["a.txt", "b.txt"]);
      });

      it("converts variadic number args to numbers", () => {
        let actual: number[] = [];

        const cmd = command({
          name: "my-cli",
          args: [{ name: "nums", type: "number", variadic: true }] as const,
          handler: ([nums]) => {
            actual = nums;
          },
        });

        cmd.run(["1", "2", "3"]);

        expect(actual).toEqual([1, 2, 3]);
      });

      it("throws MissingArgumentError for required variadic with no values", () => {
        const cmd = command({
          name: "my-cli",
          args: [{ name: "files", type: "string", variadic: true }] as const,
          handler: () => {},
        });

        expect(() => cmd.run([])).toThrow(MissingArgumentError);
      });

      it("allows empty array for optional variadic", () => {
        let actual: string[] = ["initial"];

        const cmd = command({
          name: "my-cli",
          args: [{ name: "files", type: "string", variadic: true, optional: true }] as const,
          handler: ([files]) => {
            actual = files;
          },
        });

        cmd.run([]);

        expect(actual).toEqual([]);
      });

      it("throws error if variadic is not the last arg", () => {
        expect(() => {
          command({
            name: "my-cli",
            args: [
              { name: "files", type: "string", variadic: true },
              { name: "dest", type: "string" },
            ] as const,
            handler: () => {},
          });
        }).toThrow("Variadic argument 'files' must be the last argument");
      });

      it("throws InvalidArgumentError for invalid number in variadic", () => {
        const cmd = command({
          name: "my-cli",
          args: [{ name: "nums", type: "number", variadic: true }] as const,
          handler: () => {},
        });

        expect(() => cmd.run(["1", "abc", "3"])).toThrow(InvalidArgumentError);
      });
    });
  });

  describe("options", () => {
    it("parses 'boolean' options", () => {
      let value = false;

      const cmd = command({
        name: "my-cli",
        options: {
          flag: { type: "boolean", long: "flag" },
        },
        handler: (_, { flag }) => {
          value = flag;
        },
      });

      cmd.run(["--flag"]);

      expect(value).toBeTrue();
    });

    it("parses 'number' options", () => {
      let value: number | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          flag: { type: "number", long: "flag" },
        },
        handler: (_, { flag }) => {
          value = flag;
        },
      });

      cmd.run(["--flag", "67"]);

      expect(value).toBe(67);
    });

    it("parses 'string' options", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          flag: { type: "string", long: "flag" },
        },
        handler: (_, { flag }) => {
          value = flag;
        },
      });

      cmd.run(["--flag", "foo"]);

      expect(value).toBe("foo");
    });

    it("throws an error for options not matching the correct data type", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          flag: { type: "number", long: "flag" },
        },
        handler: () => {},
      });

      expect(() => cmd.run(["--flag", "foo"])).toThrow(InvalidOptionError);
    });

    it("throws ReservedOptionError when overriding --help", () => {
      expect(() =>
        command({
          name: "my-cli",
          options: {
            help: { type: "boolean", long: "help" },
          },
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("throws ReservedOptionError when overriding -h", () => {
      expect(() =>
        command({
          name: "my-cli",
          options: {
            myHelp: { type: "boolean", long: "my-help", short: "h" },
          },
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("throws ReservedOptionError when overriding --version", () => {
      expect(() =>
        command({
          name: "my-cli",
          options: {
            version: { type: "boolean", long: "version" },
          },
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("throws ReservedOptionError when overriding -V", () => {
      expect(() =>
        command({
          name: "my-cli",
          options: {
            myVersion: { type: "boolean", long: "my-version", short: "V" },
          },
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("throws ReservedOptionError when inherited options override reserved flags", () => {
      const BadOptions = {
        help: { type: "boolean", long: "help" },
      } as const;

      expect(() =>
        command({
          name: "my-cli",
          inherits: BadOptions,
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("parses multiple string options into an array", () => {
      let files: string[] = [];

      const cmd = command({
        name: "my-cli",
        options: {
          file: { type: "string", long: "file", short: "f", multiple: true },
        },
        handler: (_, { file }) => {
          files = file;
        },
      });

      cmd.run(["--file", "a.txt", "--file", "b.txt", "--file", "c.txt"]);

      expect(files).toEqual(["a.txt", "b.txt", "c.txt"]);
    });

    it("parses multiple string options using short flag", () => {
      let files: string[] = [];

      const cmd = command({
        name: "my-cli",
        options: {
          file: { type: "string", long: "file", short: "f", multiple: true },
        },
        handler: (_, { file }) => {
          files = file;
        },
      });

      cmd.run(["-f", "a.txt", "-f", "b.txt"]);

      expect(files).toEqual(["a.txt", "b.txt"]);
    });

    it("parses multiple number options into an array", () => {
      let ports: number[] = [];

      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", long: "port", short: "p", multiple: true },
        },
        handler: (_, { port }) => {
          ports = port;
        },
      });

      cmd.run(["--port", "8080", "--port", "3000", "--port", "443"]);

      expect(ports).toEqual([8080, 3000, 443]);
    });

    it("returns empty array when multiple option not provided", () => {
      let files: string[] = ["should be replaced"];

      const cmd = command({
        name: "my-cli",
        options: {
          file: { type: "string", long: "file", multiple: true },
        },
        handler: (_, { file }) => {
          files = file;
        },
      });

      cmd.run([]);

      expect(files).toEqual([]);
    });

    it("wraps single value in array for multiple option", () => {
      let files: string[] = [];

      const cmd = command({
        name: "my-cli",
        options: {
          file: { type: "string", long: "file", multiple: true },
        },
        handler: (_, { file }) => {
          files = file;
        },
      });

      cmd.run(["--file", "only-one.txt"]);

      expect(files).toEqual(["only-one.txt"]);
    });

    it("throws error for invalid number in multiple option", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", long: "port", multiple: true },
        },
        handler: () => {},
      });

      expect(() => cmd.run(["--port", "8080", "--port", "abc"])).toThrow(InvalidOptionError);
    });

    it("infers long option name from key when not specified", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          myOption: { type: "string" },
        },
        handler: (_, { myOption }) => {
          value = myOption;
        },
      });

      cmd.run(["--myOption", "test-value"]);

      expect(value).toBe("test-value");
    });

    it("uses explicit long over inferred key name", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          myOption: { type: "string", long: "custom-name" },
        },
        handler: (_, { myOption }) => {
          value = myOption;
        },
      });

      cmd.run(["--custom-name", "test-value"]);

      expect(value).toBe("test-value");
    });

    it("inferred long works with short option", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          output: { type: "string", short: "o" },
        },
        handler: (_, { output }) => {
          value = output;
        },
      });

      // Test short flag
      cmd.run(["-o", "short-value"]);
      expect(value).toBe("short-value");

      // Test inferred long flag
      cmd.run(["--output", "long-value"]);
      expect(value).toBe("long-value");
    });

    it("inferred long works with boolean type", () => {
      let value = false;

      const cmd = command({
        name: "my-cli",
        options: {
          verbose: { type: "boolean" },
        },
        handler: (_, { verbose }) => {
          value = verbose;
        },
      });

      cmd.run(["--verbose"]);

      expect(value).toBeTrue();
    });

    it("inferred long works with number type", () => {
      let value: number | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number" },
        },
        handler: (_, { port }) => {
          value = port;
        },
      });

      cmd.run(["--port", "8080"]);

      expect(value).toBe(8080);
    });

    it("inferred long works with multiple option", () => {
      let values: string[] = [];

      const cmd = command({
        name: "my-cli",
        options: {
          file: { type: "string", multiple: true },
        },
        handler: (_, { file }) => {
          values = file;
        },
      });

      cmd.run(["--file", "a.txt", "--file", "b.txt"]);

      expect(values).toEqual(["a.txt", "b.txt"]);
    });

    it("throws ReservedOptionError when inferred long matches 'help'", () => {
      expect(() =>
        command({
          name: "my-cli",
          options: {
            help: { type: "boolean" }, // inferred long: "help"
          },
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("throws ReservedOptionError when inferred long matches 'version'", () => {
      expect(() =>
        command({
          name: "my-cli",
          options: {
            version: { type: "boolean" }, // inferred long: "version"
          },
          handler: () => {},
        }),
      ).toThrow(ReservedOptionError);
    });

    it("uses default value when option not provided", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          output: { type: "string", default: "out.txt" },
        },
        handler: (_, { output }) => {
          value = output;
        },
      });

      cmd.run([]);

      expect(value).toBe("out.txt");
    });

    it("overrides default value when option is provided", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          output: { type: "string", default: "out.txt" },
        },
        handler: (_, { output }) => {
          value = output;
        },
      });

      cmd.run(["--output", "custom.txt"]);

      expect(value).toBe("custom.txt");
    });

    it("uses default value for number options", () => {
      let value: number | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", default: 3000 },
        },
        handler: (_, { port }) => {
          value = port;
        },
      });

      cmd.run([]);

      expect(value).toBe(3000);
    });

    it("overrides default number value when option is provided", () => {
      let value: number | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", default: 3000 },
        },
        handler: (_, { port }) => {
          value = port;
        },
      });

      cmd.run(["--port", "8080"]);

      expect(value).toBe(8080);
    });

    it("uses default value for boolean options", () => {
      let value = false;

      const cmd = command({
        name: "my-cli",
        options: {
          verbose: { type: "boolean", default: true },
        },
        handler: (_, { verbose }) => {
          value = verbose;
        },
      });

      cmd.run([]);

      expect(value).toBeTrue();
    });

    it("option with default has correct type inference (not undefined)", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", default: 3000 },
          output: { type: "string", default: "out.txt" },
          noDefault: { type: "string" },
        },
        handler: (_, opts) => {
          const port: number = opts.port;
          const output: string = opts.output;
          const noDefault: string | undefined = opts.noDefault;

          expect(port).toBe(3000);
          expect(output).toBe("out.txt");
          expect(noDefault).toBeUndefined();
        },
      });

      cmd.run([]);
    });

    it("throws MissingOptionError when required option not provided", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          config: { type: "string", required: true },
        },
        handler: () => {},
      });

      expect(() => cmd.run([])).toThrow(MissingOptionError);
    });

    it("does not throw when required option is provided", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          config: { type: "string", required: true },
        },
        handler: (_, { config }) => {
          value = config;
        },
      });

      cmd.run(["--config", "app.json"]);

      expect(value).toBe("app.json");
    });

    it("required option with default does not throw", () => {
      let value: string | undefined;

      const cmd = command({
        name: "my-cli",
        options: {
          config: { type: "string", required: true, default: "default.json" },
        },
        handler: (_, { config }) => {
          value = config;
        },
      });

      cmd.run([]);

      expect(value).toBe("default.json");
    });

    it("required number option throws when not provided", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", required: true },
        },
        handler: () => {},
      });

      expect(() => cmd.run([])).toThrow(MissingOptionError);
    });

    it("required option has correct type inference (not undefined)", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          config: { type: "string", required: true },
          optional: { type: "string" },
        },
        handler: (_, opts) => {
          const config: string = opts.config;
          const optional: string | undefined = opts.optional;

          expect(config).toBe("app.json");
          expect(optional).toBeUndefined();
        },
      });

      cmd.run(["--config", "app.json"]);
    });

    describe("negatable", () => {
      it("sets value to true with --flag", () => {
        let actual: boolean | undefined;

        const cmd = command({
          name: "my-cli",
          options: {
            color: { type: "boolean", negatable: true },
          },
          handler: (_, { color }) => {
            actual = color;
          },
        });

        cmd.run(["--color"]);

        expect(actual).toBe(true);
      });

      it("sets value to false with --no-flag", () => {
        let actual: boolean | undefined;

        const cmd = command({
          name: "my-cli",
          options: {
            color: { type: "boolean", negatable: true },
          },
          handler: (_, { color }) => {
            actual = color;
          },
        });

        cmd.run(["--no-color"]);

        expect(actual).toBe(false);
      });

      it("uses undefined when neither is specified", () => {
        let actual: boolean | undefined = true;

        const cmd = command({
          name: "my-cli",
          options: {
            color: { type: "boolean", negatable: true },
          },
          handler: (_, { color }) => {
            actual = color;
          },
        });

        cmd.run([]);

        expect(actual).toBeUndefined();
      });

      it("uses default value when neither is specified", () => {
        let actual: boolean | undefined;

        const cmd = command({
          name: "my-cli",
          options: {
            color: { type: "boolean", negatable: true, default: true },
          },
          handler: (_, { color }) => {
            actual = color;
          },
        });

        cmd.run([]);

        expect(actual).toBe(true);
      });

      it("--no-flag overrides default value", () => {
        let actual: boolean | undefined;

        const cmd = command({
          name: "my-cli",
          options: {
            color: { type: "boolean", negatable: true, default: true },
          },
          handler: (_, { color }) => {
            actual = color;
          },
        });

        cmd.run(["--no-color"]);

        expect(actual).toBe(false);
      });

      it("works with short flag alias", () => {
        let actual: boolean | undefined;

        const cmd = command({
          name: "my-cli",
          options: {
            color: { type: "boolean", short: "c", negatable: true },
          },
          handler: (_, { color }) => {
            actual = color;
          },
        });

        cmd.run(["-c"]);
        expect(actual).toBe(true);

        cmd.run(["--no-color"]);
        expect(actual).toBe(false);
      });
    });
  });

  describe("full", () => {
    it("runs a command with args and options", () => {
      let pathArg = "";
      let fooOpt = false;
      let barOpt: number | undefined;
      let quxxOpt: string | undefined;

      const cmd = command({
        name: "my-cli",
        version: "1.0.0",
        args: [
          {
            name: "path",
            description: "path to a file",
            type: "string",
          },
        ],
        options: {
          foo: { type: "boolean", long: "foo" },
          bar: { type: "number", long: "bar", short: "b" },
          baz: { type: "number", long: "bar", short: "z" },
          quxx: { type: "string", long: "quxx", short: "x" },
        },
        handler: (args, { foo, bar, quxx }) => {
          pathArg = args[0];
          fooOpt = foo;
          barOpt = bar;
          quxxOpt = quxx;
        },
      });
      cmd.run(["--foo", "--bar", "9", "-x", "str", "/path/to/file"]);

      expect(pathArg).toBe("/path/to/file");
      expect(fooOpt).toBeTrue();
      expect(barOpt).toBe(9);
      expect(quxxOpt).toBe("str");
    });
  });
});

describe("run", () => {
  describe("help", () => {
    it("shows help and skips handler when --help is passed", () => {
      let executed = false;
      const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

      const cmd = command({
        name: "my-cli",
        description: "Test CLI",
        handler: () => {
          executed = true;
        },
      });

      run(cmd, ["--help"]);

      expect(executed).toBeFalse();
      expect(stdoutSpy).toHaveBeenCalled();
      expect(stdoutSpy.mock.calls[0]?.[0]).toContain("Test CLI");

      stdoutSpy.mockRestore();
    });

    it("shows help and skips handler when -h is passed", () => {
      let executed = false;
      const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

      const cmd = command({
        name: "my-cli",
        description: "Test CLI",
        handler: () => {
          executed = true;
        },
      });

      run(cmd, ["-h"]);

      expect(executed).toBeFalse();
      expect(stdoutSpy).toHaveBeenCalled();

      stdoutSpy.mockRestore();
    });

    it("runs handler when no help flag is passed", () => {
      let executed = false;

      const cmd = command({
        name: "my-cli",
        handler: () => {
          executed = true;
        },
      });

      run(cmd, []);

      expect(executed).toBeTrue();
    });
  });

  describe("version", () => {
    it("shows version and skips handler when --version is passed", () => {
      let executed = false;
      const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

      const cmd = command({
        name: "my-cli",
        version: "1.2.3",
        handler: () => {
          executed = true;
        },
      });

      run(cmd, ["--version"]);

      expect(executed).toBeFalse();
      expect(stdoutSpy).toHaveBeenCalled();
      expect(stdoutSpy.mock.calls[0]?.[0]).toContain("1.2.3");

      stdoutSpy.mockRestore();
    });

    it("shows version and skips handler when -V is passed", () => {
      let executed = false;
      const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

      const cmd = command({
        name: "my-cli",
        version: "1.2.3",
        handler: () => {
          executed = true;
        },
      });

      run(cmd, ["-V"]);

      expect(executed).toBeFalse();
      expect(stdoutSpy).toHaveBeenCalled();
      expect(stdoutSpy.mock.calls[0]?.[0]).toContain("1.2.3");

      stdoutSpy.mockRestore();
    });

    it("shows error when version flag passed but no version defined", () => {
      let executed = false;
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

      const cmd = command({
        name: "my-cli",
        handler: () => {
          executed = true;
        },
      });

      run(cmd, ["--version"]);

      expect(executed).toBeFalse();
      expect(stderrSpy).toHaveBeenCalled();
      expect(stderrSpy.mock.calls[0]?.[0]).toContain("no version specified");

      stderrSpy.mockRestore();
    });
  });
});

describe("subcommands", () => {
  describe("routing", () => {
    it("routes to a single-level subcommand", () => {
      let executed = false;
      let receivedName = "";

      const add = command({
        name: "add",
        args: [{ name: "name", type: "string" }] as const,
        handler: ([name]) => {
          executed = true;
          receivedName = name;
        },
      });

      const cli = command({
        name: "cli",
        subcommands: [add],
      });

      cli.run(["add", "foo"]);

      expect(executed).toBeTrue();
      expect(receivedName).toBe("foo");
    });

    it("routes to a nested subcommand (2 levels)", () => {
      let executed = false;
      let receivedUrl = "";

      const add = command({
        name: "add",
        args: [{ name: "url", type: "string" }] as const,
        handler: ([url]) => {
          executed = true;
          receivedUrl = url;
        },
      });

      const remote = command({
        name: "remote",
        subcommands: [add],
      });

      const git = command({
        name: "git",
        subcommands: [remote],
      });

      git.run(["remote", "add", "https://example.com"]);

      expect(executed).toBeTrue();
      expect(receivedUrl).toBe("https://example.com");
    });

    it("routes to deeply nested subcommand (3+ levels)", () => {
      let executed = false;

      const deep = command({
        name: "deep",
        handler: () => {
          executed = true;
        },
      });

      const level2 = command({
        name: "level2",
        subcommands: [deep],
      });

      const level1 = command({
        name: "level1",
        subcommands: [level2],
      });

      const root = command({
        name: "root",
        subcommands: [level1],
      });

      root.run(["level1", "level2", "deep"]);

      expect(executed).toBeTrue();
    });
  });

  describe("errors", () => {
    it("throws MissingSubcommandError when no subcommand provided", () => {
      const add = command({
        name: "add",
        handler: () => {},
      });

      const cli = command({
        name: "cli",
        subcommands: [add],
      });

      expect(() => cli.run([])).toThrow(MissingSubcommandError);
    });

    it("throws UnknownSubcommandError for unknown subcommand", () => {
      const add = command({
        name: "add",
        handler: () => {},
      });

      const cli = command({
        name: "cli",
        subcommands: [add],
      });

      expect(() => cli.run(["unknown"])).toThrow(UnknownSubcommandError);
    });
  });

  describe("help", () => {
    it("shows parent command help with subcommand list", () => {
      const add = command({
        name: "add",
        description: "Add an item",
        handler: () => {},
      });

      const remove = command({
        name: "remove",
        description: "Remove an item",
        handler: () => {},
      });

      const cli = command({
        name: "cli",
        description: "Parent CLI",
        subcommands: [add, remove],
      });

      const helpText = cli.help();

      expect(helpText).toContain("Parent CLI");
      expect(helpText).toContain("Commands:");
      expect(helpText).toContain("add");
      expect(helpText).toContain("Add an item");
      expect(helpText).toContain("remove");
      expect(helpText).toContain("Remove an item");
    });

    it("routes --help to the correct subcommand", () => {
      const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

      const add = command({
        name: "add",
        description: "Add subcommand help",
        args: [{ name: "name", type: "string" }] as const,
        handler: () => {},
      });

      const cli = command({
        name: "cli",
        description: "Parent CLI help",
        subcommands: [add],
      });

      run(cli, ["add", "--help"]);

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain("Add subcommand help");
      expect(output).not.toContain("Commands:");

      stdoutSpy.mockRestore();
    });
  });

  describe("isParent", () => {
    it("returns true for parent commands", () => {
      const child = command({
        name: "child",
        handler: () => {},
      });

      const parent = command({
        name: "parent",
        subcommands: [child],
      });

      expect(parent.isParent()).toBeTrue();
    });

    it("returns false for leaf commands", () => {
      const leaf = command({
        name: "leaf",
        handler: () => {},
      });

      expect(leaf.isParent()).toBeFalse();
    });
  });

  describe("inherited options", () => {
    it("passes parent options to child handler", () => {
      let receivedVerbose = false;
      let receivedForce = false;

      const GlobalOptions = {
        verbose: { type: "boolean", long: "verbose", short: "v" },
      } as const;

      const deploy = command({
        name: "deploy",
        inherits: GlobalOptions,
        options: {
          force: { type: "boolean", long: "force", short: "f" },
        },
        handler: (_, { verbose, force }) => {
          receivedVerbose = verbose;
          receivedForce = force;
        },
      });

      const cli = command({
        name: "cli",
        options: GlobalOptions,
        subcommands: [deploy],
      });

      cli.run(["deploy", "--verbose", "--force"]);

      expect(receivedVerbose).toBeTrue();
      expect(receivedForce).toBeTrue();
    });

    it("handles multi-level inheritance", () => {
      let receivedDebug = false;
      let receivedService: string | undefined;
      let receivedTail: number | undefined;

      const RootOptions = {
        debug: { type: "boolean", long: "debug" },
      } as const;

      const ServiceOptions = {
        ...RootOptions,
        service: { type: "string", long: "service", short: "s" },
      } as const;

      const logs = command({
        name: "logs",
        inherits: ServiceOptions,
        options: {
          tail: { type: "number", long: "tail", short: "n" },
        },
        handler: (_, opts) => {
          receivedDebug = opts.debug;
          receivedService = opts.service;
          receivedTail = opts.tail;
        },
      });

      const service = command({
        name: "service",
        options: ServiceOptions,
        subcommands: [logs],
      });

      const root = command({
        name: "root",
        options: RootOptions,
        subcommands: [service],
      });

      root.run(["service", "logs", "--debug", "--service", "api", "--tail", "100"]);

      expect(receivedDebug).toBeTrue();
      expect(receivedService).toBe("api");
      expect(receivedTail).toBe(100);
    });

    it("throws error when inherited and own options conflict", () => {
      const ParentOptions = {
        verbose: { type: "boolean", long: "verbose" },
      } as const;

      expect(() =>
        command({
          name: "child",
          inherits: ParentOptions,
          options: {
            verbose: { type: "boolean", long: "verbose" }, // Conflict!
          },
          handler: () => {},
        }),
      ).toThrow("Option keys conflict with inherited: verbose");
    });

    it("works without inherits (backward compatible)", () => {
      let receivedFlag = false;

      const cmd = command({
        name: "standalone",
        options: {
          flag: { type: "boolean", long: "flag" },
        },
        handler: (_, { flag }) => {
          receivedFlag = flag;
        },
      });

      cmd.run(["--flag"]);

      expect(receivedFlag).toBeTrue();
    });

    it("shows inherited options in help text", () => {
      const GlobalOptions = {
        verbose: { type: "boolean", long: "verbose", description: "Enable verbose output" },
      } as const;

      const deploy = command({
        name: "deploy",
        description: "Deploy the app",
        inherits: GlobalOptions,
        options: {
          force: { type: "boolean", long: "force", description: "Force deploy" },
        },
        handler: () => {},
      });

      const helpText = deploy.help();

      expect(helpText).toContain("Global Options:");
      expect(helpText).toContain("--verbose");
      expect(helpText).toContain("Enable verbose output");
      expect(helpText).toContain("Options:");
      expect(helpText).toContain("--force");
      expect(helpText).toContain("Force deploy");
    });

    it("supports flags before subcommand name", () => {
      let receivedVerbose = false;
      let receivedForce = false;

      const GlobalOptions = {
        verbose: { type: "boolean", long: "verbose", short: "v" },
      } as const;

      const deploy = command({
        name: "deploy",
        inherits: GlobalOptions,
        options: {
          force: { type: "boolean", long: "force", short: "f" },
        },
        handler: (_, { verbose, force }) => {
          receivedVerbose = verbose;
          receivedForce = force;
        },
      });

      const cli = command({
        name: "cli",
        options: GlobalOptions,
        subcommands: [deploy],
      });

      // Flags can appear before subcommand: cli --verbose deploy --force
      cli.run(["--verbose", "deploy", "--force"]);

      expect(receivedVerbose).toBeTrue();
      expect(receivedForce).toBeTrue();
    });

    it("provides type inference for inherited options in handler", () => {
      const GlobalOptions = {
        verbose: { type: "boolean", long: "verbose" },
        count: { type: "number", long: "count" },
        name: { type: "string", long: "name" },
      } as const;

      let capturedVerbose: boolean = false;
      let capturedCount: number | undefined;
      let capturedName: string | undefined;
      let capturedOwn: boolean = false;

      const child = command({
        name: "child",
        inherits: GlobalOptions,
        options: {
          own: { type: "boolean", long: "own" },
        },
        handler: (_, opts) => {
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
  });

  describe("suggestions", () => {
    describe("subcommands", () => {
      it("includes suggestions in UnknownSubcommandError for typos", () => {
        const add = command({
          name: "add",
          handler: () => {},
        });

        const list = command({
          name: "list",
          handler: () => {},
        });

        const remove = command({
          name: "remove",
          handler: () => {},
        });

        const cli = command({
          name: "cli",
          subcommands: [add, list, remove],
        });

        try {
          cli.run(["addd"]);
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(UnknownSubcommandError);
          const e = error as UnknownSubcommandError;
          expect(e.suggestions).toContain("add");
          expect(e.message).toContain("Did you mean 'add'?");
        }
      });

      it("falls back to available list when no good suggestions", () => {
        const add = command({
          name: "add",
          handler: () => {},
        });

        const cli = command({
          name: "cli",
          subcommands: [add],
        });

        try {
          cli.run(["xyz"]);
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(UnknownSubcommandError);
          const e = error as UnknownSubcommandError;
          expect(e.suggestions).toEqual([]);
          expect(e.message).toContain("Available: add");
        }
      });
    });

    describe("unknown options", () => {
      it("throws UnknownOptionError for unknown long flag", () => {
        const cmd = command({
          name: "test",
          options: {
            verbose: { type: "boolean", long: "verbose" },
          },
          handler: () => {},
        });

        expect(() => cmd.run(["--unknown"])).toThrow(UnknownOptionError);
      });

      it("throws UnknownOptionError for unknown short flag", () => {
        const cmd = command({
          name: "test",
          options: {
            verbose: { type: "boolean", long: "verbose", short: "v" },
          },
          handler: () => {},
        });

        expect(() => cmd.run(["-x"])).toThrow(UnknownOptionError);
      });

      it("includes suggestions for typos in flags", () => {
        const cmd = command({
          name: "test",
          options: {
            verbose: { type: "boolean", long: "verbose" },
            debug: { type: "boolean", long: "debug" },
          },
          handler: () => {},
        });

        try {
          cmd.run(["--vrebose"]);
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(UnknownOptionError);
          const e = error as UnknownOptionError;
          expect(e.suggestions).toContain("verbose");
          expect(e.message).toContain("Did you mean 'verbose'?");
        }
      });

      it("does not throw for known flags", () => {
        let executed = false;

        const cmd = command({
          name: "test",
          options: {
            verbose: { type: "boolean", long: "verbose", short: "v" },
          },
          handler: () => {
            executed = true;
          },
        });

        cmd.run(["--verbose"]);
        expect(executed).toBeTrue();
      });

      it("does not throw for built-in --help flag", () => {
        const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

        const cmd = command({
          name: "test",
          handler: () => {},
        });

        run(cmd, ["--help"]);

        stdoutSpy.mockRestore();
      });

      it("does not throw for built-in --version flag", () => {
        const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

        const cmd = command({
          name: "test",
          version: "1.0.0",
          handler: () => {},
        });

        run(cmd, ["--version"]);

        stdoutSpy.mockRestore();
      });

      it("recognizes negatable boolean flags as valid", () => {
        let receivedColor = true;

        const cmd = command({
          name: "test",
          options: {
            color: { type: "boolean", long: "color", negatable: true },
          },
          handler: (_, { color }) => {
            receivedColor = color;
          },
        });

        cmd.run(["--no-color"]);
        expect(receivedColor).toBeFalse();
      });
    });
  });
});
