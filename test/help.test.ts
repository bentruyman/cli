import { describe, expect, it } from "bun:test";
import kleur from "kleur";

import { command } from "../src/command";

describe("help", () => {
  it("formats a command's help output", () => {
    const cmd = command({
      name: "my-cli",
      description: "A helpful description of my-cli",
      args: [
        {
          name: "path",
          description: "path to a file",
          type: "string",
        },
      ],
      options: {
        foo: { description: "a foo flag", type: "boolean", long: "foo" },
        bar: { description: "a bar flag", type: "number", long: "bar", short: "b" },
        quxx: { description: "a quxx flag", type: "string", long: "quxx", short: "x" },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toBe(`
A helpful description of my-cli

${kleur.bold("Usage:")}
  ${kleur.blue("my-cli")} ${kleur.cyan("[options]")} ${kleur.green("<path>")}

${kleur.bold("Arguments:")}
  ${kleur.green("<path>")}  path to a file

${kleur.bold("Options:")}
  ${kleur.cyan("    --foo")}         a foo flag
  ${kleur.cyan(`-b, --bar${kleur.dim("=<num>")}`)}   a bar flag
  ${kleur.cyan(`-x, --quxx${kleur.dim("=<str>")}`)}  a quxx flag
  ${kleur.cyan("-h, --help")}        Show help
  ${kleur.cyan("-V, --version")}     Show version`);
  });

  it("shows ... suffix for multiple options", () => {
    const cmd = command({
      name: "my-cli",
      options: {
        file: {
          description: "files to process",
          type: "string",
          long: "file",
          short: "f",
          multiple: true,
        },
        port: { description: "ports to listen on", type: "number", long: "port", multiple: true },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(`-f, --file${kleur.dim("=<str>...")}`);
    expect(help).toContain(`--port${kleur.dim("=<num>...")}`);
  });

  it("shows inferred long option name in help", () => {
    const cmd = command({
      name: "my-cli",
      options: {
        verbose: { description: "enable verbose mode", type: "boolean" },
        output: { description: "output file", type: "string", short: "o" },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain("--verbose");
    expect(help).toContain("enable verbose mode");
    expect(help).toContain(`-o, --output${kleur.dim("=<str>")}`);
    expect(help).toContain("output file");
  });

  it("shows custom placeholder in help", () => {
    const cmd = command({
      name: "my-cli",
      options: {
        config: { type: "string", placeholder: "path" },
        port: { type: "number", placeholder: "port" },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(`--config${kleur.dim("=<path>")}`);
    expect(help).toContain(`--port${kleur.dim("=<port>")}`);
  });

  it("shows custom placeholder with multiple suffix", () => {
    const cmd = command({
      name: "my-cli",
      options: {
        file: { type: "string", placeholder: "file", multiple: true },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(`--file${kleur.dim("=<file>...")}`);
  });

  it("shows optional args with [brackets] in usage and arguments", () => {
    const cmd = command({
      name: "my-cli",
      args: [
        { name: "input", type: "string" },
        { name: "output", type: "string", optional: true },
      ],
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(`${kleur.green("<input>")} ${kleur.green("[output]")}`);
    expect(help).toContain(`${kleur.green("<input>")}`);
    expect(help).toContain(`${kleur.green("[output]")}`);
  });

  it("shows required variadic args with <name...> in help", () => {
    const cmd = command({
      name: "my-cli",
      args: [{ name: "files", type: "string", variadic: true }] as const,
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(kleur.green("<files...>"));
  });

  it("shows optional variadic args with [name...] in help", () => {
    const cmd = command({
      name: "my-cli",
      args: [{ name: "files", type: "string", variadic: true, optional: true }] as const,
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(kleur.green("[files...]"));
  });

  it("shows mixed args with variadic last in help", () => {
    const cmd = command({
      name: "copy",
      args: [
        { name: "dest", type: "string" },
        { name: "files", type: "string", variadic: true },
      ] as const,
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain(`${kleur.green("<dest>")} ${kleur.green("<files...>")}`);
  });

  it("shows negatable boolean with --[no-]flag format", () => {
    const cmd = command({
      name: "my-cli",
      options: {
        color: { type: "boolean", negatable: true, description: "Enable colors" },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain("--[no-]color");
    expect(help).toContain("Enable colors");
  });

  it("shows negatable boolean with short flag", () => {
    const cmd = command({
      name: "my-cli",
      options: {
        color: { type: "boolean", short: "c", negatable: true },
      },
      handler: () => {},
    });

    const help = cmd.help();

    expect(help).toContain("-c, --[no-]color");
  });
});
