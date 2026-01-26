import { describe, expect, it } from "bun:test";

import { command } from "../../src/command";
import { generateCompletions } from "../../src/completions";

describe("generateCompletions", () => {
  it("generates bash completions from command", () => {
    const cmd = command({
      name: "my-cli",
      description: "Test CLI",
      options: {
        verbose: { type: "boolean", short: "v", description: "Verbose" },
      },
      handler: () => {},
    });

    const script = generateCompletions(cmd, "bash");

    expect(script).toContain("# Bash completions for my-cli");
    expect(script).toContain("--verbose");
    expect(script).toContain("-v");
    expect(script).toContain("complete -F");
  });

  it("generates zsh completions from command", () => {
    const cmd = command({
      name: "my-cli",
      description: "Test CLI",
      options: {
        output: { type: "string", short: "o", description: "Output file" },
      },
      handler: () => {},
    });

    const script = generateCompletions(cmd, "zsh");

    expect(script).toContain("#compdef my-cli");
    expect(script).toContain("--output");
    expect(script).toContain("Output file");
  });

  it("generates fish completions from command", () => {
    const cmd = command({
      name: "my-cli",
      description: "Test CLI",
      options: {
        count: { type: "number", description: "Count value" },
      },
      handler: () => {},
    });

    const script = generateCompletions(cmd, "fish");

    expect(script).toContain("# Fish completions for my-cli");
    expect(script).toContain("-l count");
    expect(script).toContain("-d 'Count value'");
  });

  it("includes subcommands in completions", () => {
    const init = command({
      name: "init",
      description: "Initialize project",
      handler: () => {},
    });

    const build = command({
      name: "build",
      description: "Build project",
      options: {
        prod: { type: "boolean", description: "Production build" },
      },
      handler: () => {},
    });

    const cli = command({
      name: "my-cli",
      subcommands: [init, build],
    });

    const bashScript = generateCompletions(cli, "bash");
    expect(bashScript).toContain("init");
    expect(bashScript).toContain("build");

    const zshScript = generateCompletions(cli, "zsh");
    expect(zshScript).toContain("init");
    expect(zshScript).toContain("build");

    const fishScript = generateCompletions(cli, "fish");
    expect(fishScript).toContain("-a init");
    expect(fishScript).toContain("-a build");
  });

  it("excludes hidden commands from completions", () => {
    const visible = command({
      name: "visible",
      description: "Visible command",
      handler: () => {},
    });

    const hidden = command({
      name: "hidden",
      description: "Hidden command",
      hidden: true,
      handler: () => {},
    });

    const cli = command({
      name: "my-cli",
      subcommands: [visible, hidden],
    });

    const bashScript = generateCompletions(cli, "bash");
    expect(bashScript).toContain("visible");
    expect(bashScript).not.toMatch(/commands="[^"]*hidden/);

    const zshScript = generateCompletions(cli, "zsh");
    expect(zshScript).toContain("visible");
    expect(zshScript).not.toContain("'hidden:Hidden command'");

    const fishScript = generateCompletions(cli, "fish");
    expect(fishScript).toContain("-a visible");
    expect(fishScript).not.toContain("-a hidden");
  });

  it("handles nested subcommands", () => {
    const get = command({
      name: "get",
      description: "Get config value",
      handler: () => {},
    });

    const set = command({
      name: "set",
      description: "Set config value",
      handler: () => {},
    });

    const config = command({
      name: "config",
      description: "Manage configuration",
      subcommands: [get, set],
    });

    const cli = command({
      name: "my-cli",
      subcommands: [config],
    });

    const bashScript = generateCompletions(cli, "bash");
    expect(bashScript).toContain("config");
    expect(bashScript).toContain("get");
    expect(bashScript).toContain("set");

    const zshScript = generateCompletions(cli, "zsh");
    expect(zshScript).toContain("config");
    expect(zshScript).toContain("get");
    expect(zshScript).toContain("set");

    const fishScript = generateCompletions(cli, "fish");
    expect(fishScript).toContain("-a config");
    expect(fishScript).toContain("-a get");
    expect(fishScript).toContain("-a set");
  });

  it("throws for unknown shell", () => {
    const cmd = command({
      name: "my-cli",
      handler: () => {},
    });

    expect(() => {
      generateCompletions(cmd, "powershell" as any);
    }).toThrow("Unknown shell: powershell");
  });
});
