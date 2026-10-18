import { afterEach, describe, expect, expectTypeOf, it, spyOn } from "bun:test";
import { command, run, type Options, type Option, type AnyCommand } from "../src/index";

afterEach(() => {
  process.exitCode = 0;
  delete process.env.CLI_TEST_TAG;
});

for (const depth of [0, 1, 3]) {
  describe(`argument conventions at depth ${depth}`, () => {
    function invoke(argv: string[]) {
      let result: { args: readonly [string[]]; opts: Record<string, unknown> } | undefined;
      let cmd: AnyCommand = command({
        name: "child",
        args: [{ name: "files", type: "string", variadic: true, optional: true }],
        options: {
          tag: { type: "string", short: "t", multiple: true },
          id: { type: "string" },
          count: { type: "number", short: "n" },
          color: { type: "boolean", negatable: true, default: true },
          verbose: { type: "boolean", short: "v" },
        },
        handler: (args, opts) => {
          result = { args, opts };
        },
      });
      const prefix: string[] = [];
      for (let i = 0; i < depth; i++) {
        prefix.unshift(cmd.name);
        cmd = command({ name: `parent${i}`, subcommands: [cmd] });
      }
      cmd.run([...prefix, ...argv]);
      return result!;
    }

    it("preserves repeated strings, leading zeros, false, and literal operands", () => {
      const { args, opts } = invoke([
        "--tag",
        "a",
        "-tb",
        "--id",
        "0012",
        "--no-color",
        "--",
        "--help",
        "--tag",
        "-",
      ]);
      expect(opts).toMatchObject({ tag: ["a", "b"], id: "0012", color: false });
      expect(args).toEqual([["--help", "--tag", "-"]]);
    });
    it("uses the last scalar occurrence and leaves numeric-looking strings alone", () => {
      const { args, opts } = invoke([
        "--id",
        "one",
        "--id",
        "two",
        "-vv",
        "123",
        "-",
        "--no-color",
        "--color",
      ]);
      expect(opts).toMatchObject({ id: "two", verbose: true, color: true });
      expect(args).toEqual([["123", "-"]]);
    });
    it("supports negative numbers, attached short values, and explicit empties", () => {
      expect(invoke(["--count", "-1"]).opts.count).toBe(-1);
      expect(invoke(["-vn3"]).opts).toMatchObject({ verbose: true, count: 3 });
      expect(invoke(["--id=", "next"])).toMatchObject({ args: [["next"]], opts: { id: "" } });
      expect(invoke(["--id", ""]).opts.id).toBe("");
    });
    it("rejects missing values and undeclared negation", () => {
      for (const argv of [
        ["--id"],
        ["--count"],
        ["--id", "--verbose"],
        ["--count="],
        ["--no-id"],
        ["--no-verbose"],
      ]) {
        expect(() => invoke(argv)).toThrow();
      }
      expect(invoke([]).opts.verbose).toBeUndefined();
    });
  });
}

it("resolves inherited values before required checks and validators", () => {
  const globals = {
    token: { type: "string", required: true },
    port: { type: "number", default: 3000 },
  } as const satisfies Options;
  let received: unknown;
  const child = command({
    name: "child",
    inherits: {
      ...globals,
      port: { type: "number", default: 3000, validate: (v) => v < 65536 || "invalid port" },
    },
    handler: (_, opts) => {
      received = opts;
    },
  });
  const parent = command({ name: "cli", options: globals, subcommands: [child] });
  parent.run(["--port", "4000", "child", "--token", "valid"]);
  expect(received).toEqual({ token: "valid", port: 4000 });
  expect(() => parent.run(["child", "--token", "valid", "--port", "99999"])).toThrow(
    "invalid port",
  );
});

it("applies precedence, validation, and required checks to multiple options", () => {
  let tags: string[] = [];
  const cmd = command({
    name: "cli",
    options: {
      tag: {
        type: "string",
        multiple: true,
        required: true,
        env: "CLI_TEST_TAG",
        default: ["default"],
        validate: (v) => v.length > 0 || "empty tag",
      },
    },
    handler: (_, opts) => {
      tags = opts.tag;
    },
  });
  cmd.run([]);
  expect(tags).toEqual(["default"]);
  process.env.CLI_TEST_TAG = "env,one";
  cmd.run([]);
  expect(tags).toEqual(["env,one"]);
  cmd.run(["--tag", "cli"]);
  expect(tags).toEqual(["cli"]);
  expect(() => cmd.run(["--tag="])).toThrow("empty tag");
  expect(() =>
    command({
      name: "cli",
      options: { tag: { type: "string", multiple: true, required: true } },
      handler: () => {},
    }).run([]),
  ).toThrow("Missing required option");
});

it("rejects surplus operands", () => {
  expect(() =>
    command({ name: "remove", args: [{ name: "file", type: "string" }], handler: () => {} }).run([
      "one",
      "two",
    ]),
  ).toThrow("Unexpected argument: two");
});

it("routes help past option values and prints the complete invocation", async () => {
  const child = command({
    name: "child",
    args: [{ name: "file", type: "string" }],
    handler: () => {
      throw new Error("must not run");
    },
  });
  const root = command({
    name: "cli",
    options: { config: { type: "string", required: true } },
    subcommands: [command({ name: "group", subcommands: [child] })],
  });
  const stdout = spyOn(process.stdout, "write").mockReturnValue(true);
  try {
    await run(root, ["--config", "path", "group", "child", "--help"]);
    expect(stdout.mock.calls.flat().join("")).toContain("cli group child [options] <file>");
  } finally {
    stdout.mockRestore();
  }
});

it("does not reserve positional values or explicit commands named completions", async () => {
  let value: string | undefined;
  await run(
    command({
      name: "greet",
      args: [{ name: "name", type: "string" }],
      handler: ([name]) => {
        value = name;
      },
    }),
    ["completions"],
  );
  expect(value).toBe("completions");
  let called = false;
  await run(
    command({
      name: "cli",
      subcommands: [
        command({
          name: "completions",
          handler: () => {
            called = true;
          },
        }),
      ],
    }),
    ["completions"],
  );
  expect(called).toBe(true);
});

it("reports failing usage through process exit status", () => {
  const module = JSON.stringify(new URL("../src/index.ts", import.meta.url).pathname);
  for (const argv of [[], ["--bad"], ["completions", "invalid"]]) {
    const code = `import {command,run} from ${module}; await run(command({name:'cli',options:{token:{type:'string',required:true}},handler:()=>{}}),${JSON.stringify(argv)});`;
    const result = Bun.spawnSync([process.execPath, "-e", code]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  }
});

it("rejects ambiguous command and option names and invalid defaults", () => {
  const first = command({ name: "first", aliases: ["go"], handler: () => {} });
  const second = command({ name: "second", aliases: ["go"], handler: () => {} });
  expect(() => command({ name: "cli", subcommands: [first, second] })).toThrow("Duplicate command");
  expect(() => command({ name: "cli", subcommands: [first, first] })).toThrow("Duplicate command");
  expect(() =>
    command({
      name: "cli",
      options: { a: { type: "boolean", short: "f" }, b: { type: "boolean", short: "f" } },
      handler: () => {},
    }),
  ).toThrow("Duplicate option");
  expect(() =>
    command({
      name: "cli",
      options: {
        a: { type: "boolean", long: "color", negatable: true },
        b: { type: "boolean", long: "no-color" },
      },
      handler: () => {},
    }),
  ).toThrow("Duplicate option");
  expect(() =>
    command({
      name: "cli",
      options: { port: { type: "number", default: "oops" } } as never,
      handler: () => {},
    }),
  ).toThrow("Invalid default");
});

it("infers validators, inline tuples, choices, and absent booleans", () => {
  command({
    name: "typed",
    args: [{ name: "file", type: "string", validate: (v) => v.length > 0 || "empty" }],
    options: {
      port: { type: "number", validate: (v) => v > 0 || "invalid" },
      flag: { type: "boolean" },
      color: { type: "boolean", default: true },
      unset: { type: "boolean", default: undefined },
      mode: { type: "string", choices: ["json", "yaml"], default: "json" },
    },
    handler: ([file], opts) => {
      expectTypeOf(file).toEqualTypeOf<string>();
      expectTypeOf(opts.flag).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(opts.color).toEqualTypeOf<boolean>();
      expectTypeOf(opts.unset).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(opts.mode).toEqualTypeOf<"json" | "yaml">();
    },
  });
  // @ts-expect-error Defaults must match the declared primitive.
  const badDefault: Option = { type: "number", default: "oops" };
  // @ts-expect-error Choices must match the declared primitive.
  const badChoices: Option = { type: "string", choices: [1] };
  // @ts-expect-error Only boolean options are negatable.
  const badNegation: Option = { type: "string", negatable: true };
  void [badDefault, badChoices, badNegation];
});

it("preserves ancestor fallbacks and constraints when a child adds validation", () => {
  let calls = 0;
  const validate = (value: number) => {
    calls++;
    return value > 0 || "must be positive";
  };
  let received: unknown;
  const child = command({
    name: "child",
    inherits: { port: { type: "number", validate } },
    handler: (_, opts) => {
      received = opts.port;
    },
  });
  const root = command({
    name: "cli",
    options: { port: { type: "number", default: 3000, validate } },
    subcommands: [child],
  });
  root.run(["child"]);
  expect(received).toBe(3000);
  expect(calls).toBe(1);
  expect(() => root.run(["child", "--port", "-1"])).toThrow("must be positive");
});

it("resolves nested stdin operands after routing and retains full error paths", () => {
  const module = JSON.stringify(new URL("../src/index.ts", import.meta.url).pathname);
  const code = `import {command,run} from ${module};
    const child = command({name:'child',args:[{name:'input',type:'string',variadic:true,allowStdin:true,
      validate:value=>value !== 'invalid' || 'invalid input'}],
      handler:args=>console.log(JSON.stringify(args))});
    await run(command({name:'cli',subcommands:[command({name:'group',subcommands:[child]})]}),
      ['group','child','--','-','-']);`;
  const success = Bun.spawnSync([process.execPath, "-e", code], {
    stdin: Buffer.from("--help\n0012\n"),
  });
  expect(success.exitCode).toBe(0);
  expect(JSON.parse(success.stdout.toString())).toEqual([["--help\n0012\n", "--help\n0012\n"]]);
  const failure = Bun.spawnSync([process.execPath, "-e", code], {
    stdin: Buffer.from("invalid"),
  });
  expect(failure.exitCode).toBe(1);
  expect(failure.stderr.toString()).toContain("invalid input");
  expect(failure.stderr.toString()).toContain("cli group child");
});
