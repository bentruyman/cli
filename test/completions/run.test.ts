import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { command } from "../../src/command";
import { run } from "../../src/index";

describe("run completions subcommand", () => {
  let stdoutSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;
  let stdoutOutput: string;
  let stderrOutput: string;

  beforeEach(() => {
    stdoutOutput = "";
    stderrOutput = "";
    stdoutSpy = spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdoutOutput += chunk.toString();
      return true;
    });
    stderrSpy = spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderrOutput += chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("outputs bash completions", async () => {
    const cmd = command({
      name: "my-cli",
      handler: () => {},
    });

    await run(cmd, ["completions", "bash"]);

    expect(stdoutOutput).toContain("# Bash completions for my-cli");
    expect(stdoutOutput).toContain("complete -F");
  });

  it("outputs zsh completions", async () => {
    const cmd = command({
      name: "my-cli",
      handler: () => {},
    });

    await run(cmd, ["completions", "zsh"]);

    expect(stdoutOutput).toContain("#compdef my-cli");
    expect(stdoutOutput).toContain("_my_cli()");
  });

  it("outputs fish completions", async () => {
    const cmd = command({
      name: "my-cli",
      handler: () => {},
    });

    await run(cmd, ["completions", "fish"]);

    expect(stdoutOutput).toContain("# Fish completions for my-cli");
    expect(stdoutOutput).toContain("complete -c my-cli");
  });

  it("shows usage for invalid shell argument", async () => {
    const cmd = command({
      name: "my-cli",
      handler: () => {},
    });

    await run(cmd, ["completions", "powershell"]);

    expect(stderrOutput).toContain("Usage: my-cli completions <bash|zsh|fish>");
  });

  it("shows usage when no shell argument provided", async () => {
    const cmd = command({
      name: "my-cli",
      handler: () => {},
    });

    await run(cmd, ["completions"]);

    expect(stderrOutput).toContain("Usage: my-cli completions <bash|zsh|fish>");
  });

  it("includes command options in completions", async () => {
    const cmd = command({
      name: "my-cli",
      options: {
        verbose: { type: "boolean", short: "v", description: "Verbose mode" },
      },
      handler: () => {},
    });

    await run(cmd, ["completions", "bash"]);

    expect(stdoutOutput).toContain("--verbose");
    expect(stdoutOutput).toContain("-v");
  });

  it("includes subcommands in completions", async () => {
    const init = command({
      name: "init",
      description: "Initialize project",
      handler: () => {},
    });

    const cli = command({
      name: "my-cli",
      subcommands: [init],
    });

    await run(cli, ["completions", "bash"]);

    expect(stdoutOutput).toContain("init");
  });

  it("excludes hidden subcommands from completions", async () => {
    const visible = command({
      name: "visible",
      handler: () => {},
    });

    const hidden = command({
      name: "hidden",
      hidden: true,
      handler: () => {},
    });

    const cli = command({
      name: "my-cli",
      subcommands: [visible, hidden],
    });

    await run(cli, ["completions", "bash"]);

    expect(stdoutOutput).toContain("visible");
    expect(stdoutOutput).not.toMatch(/commands="[^"]*hidden/);
  });
});
