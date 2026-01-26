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

  describe("command grouping", () => {
    it("displays grouped commands with bold headers", () => {
      const init = command({ name: "init", description: "Initialize project", handler: () => {} });
      const build = command({ name: "build", description: "Build project", handler: () => {} });
      const serve = command({ name: "serve", description: "Start dev server", handler: () => {} });

      const cli = command({
        name: "my-cli",
        groups: {
          Project: ["init", "build"],
          Development: ["serve"],
        },
        subcommands: [init, build, serve],
      });

      const help = cli.help();

      expect(help).toContain(kleur.bold("Project:"));
      expect(help).toContain(kleur.bold("Development:"));
      expect(help).toContain("init");
      expect(help).toContain("Initialize project");
      expect(help).toContain("build");
      expect(help).toContain("serve");
    });

    it("displays commands in group definition order", () => {
      const alpha = command({ name: "alpha", handler: () => {} });
      const beta = command({ name: "beta", handler: () => {} });
      const gamma = command({ name: "gamma", handler: () => {} });

      const cli = command({
        name: "my-cli",
        groups: {
          Second: ["beta"],
          First: ["alpha"],
          Third: ["gamma"],
        },
        subcommands: [alpha, beta, gamma],
      });

      const help = cli.help();

      const secondIdx = help.indexOf("Second:");
      const firstIdx = help.indexOf("First:");
      const thirdIdx = help.indexOf("Third:");

      expect(secondIdx).toBeLessThan(firstIdx);
      expect(firstIdx).toBeLessThan(thirdIdx);
    });

    it("displays ungrouped commands last without header", () => {
      const init = command({ name: "init", description: "Initialize", handler: () => {} });
      const build = command({ name: "build", description: "Build", handler: () => {} });
      const help_cmd = command({ name: "help", description: "Show help", handler: () => {} });

      const cli = command({
        name: "my-cli",
        groups: {
          Project: ["init", "build"],
        },
        subcommands: [init, build, help_cmd],
      });

      const help = cli.help();

      expect(help).toContain(kleur.bold("Project:"));
      expect(help).toContain("help");
      expect(help).toContain("Show help");

      const projectIdx = help.indexOf("Project:");
      const helpIdx = help.indexOf("help");
      expect(projectIdx).toBeLessThan(helpIdx);
    });

    it("falls back to flat list when groups is empty object", () => {
      const init = command({ name: "init", handler: () => {} });
      const build = command({ name: "build", handler: () => {} });

      const cli = command({
        name: "my-cli",
        groups: {},
        subcommands: [init, build],
      });

      const help = cli.help();

      expect(help).toContain(kleur.bold("Commands:"));
      expect(help).not.toContain("Project:");
    });

    it("falls back to flat list when groups is undefined", () => {
      const init = command({ name: "init", handler: () => {} });
      const build = command({ name: "build", handler: () => {} });

      const cli = command({
        name: "my-cli",
        subcommands: [init, build],
      });

      const help = cli.help();

      expect(help).toContain(kleur.bold("Commands:"));
    });

    it("skips empty groups", () => {
      const init = command({ name: "init", handler: () => {} });

      const cli = command({
        name: "my-cli",
        groups: {
          Empty: [],
          Project: ["init"],
        },
        subcommands: [init],
      });

      const help = cli.help();

      expect(help).not.toContain("Empty:");
      expect(help).toContain("Project:");
    });

    it("displays commands within groups in array order", () => {
      const alpha = command({ name: "alpha", handler: () => {} });
      const beta = command({ name: "beta", handler: () => {} });
      const gamma = command({ name: "gamma", handler: () => {} });

      const cli = command({
        name: "my-cli",
        groups: {
          Letters: ["gamma", "alpha", "beta"],
        },
        subcommands: [alpha, beta, gamma],
      });

      const help = cli.help();

      const gammaIdx = help.indexOf("gamma");
      const alphaIdx = help.indexOf("alpha");
      const betaIdx = help.indexOf("beta");

      expect(gammaIdx).toBeLessThan(alphaIdx);
      expect(alphaIdx).toBeLessThan(betaIdx);
    });
  });

  describe("examples", () => {
    it("displays simple string examples", () => {
      const cmd = command({
        name: "my-cli",
        examples: ["my-cli init myapp", "my-cli build --prod"],
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain(kleur.bold("Examples:"));
      expect(help).toContain("my-cli init myapp");
      expect(help).toContain("my-cli build --prod");
    });

    it("displays examples with descriptions", () => {
      const cmd = command({
        name: "my-cli",
        examples: [
          { command: "my-cli deploy --env staging", description: "Deploy to staging" },
          { command: "my-cli deploy --env prod", description: "Deploy to production" },
        ],
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("my-cli deploy --env staging");
      expect(help).toContain(kleur.dim("Deploy to staging"));
      expect(help).toContain("my-cli deploy --env prod");
      expect(help).toContain(kleur.dim("Deploy to production"));
    });

    it("displays mixed examples (strings and objects)", () => {
      const cmd = command({
        name: "my-cli",
        examples: [
          "my-cli init myapp",
          { command: "my-cli build --prod", description: "Production build" },
        ],
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("my-cli init myapp");
      expect(help).toContain("my-cli build --prod");
      expect(help).toContain(kleur.dim("Production build"));
    });

    it("displays examples without description (object form)", () => {
      const cmd = command({
        name: "my-cli",
        examples: [{ command: "my-cli init myapp" }],
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("my-cli init myapp");
    });

    it("does not show Examples section when examples is undefined", () => {
      const cmd = command({
        name: "my-cli",
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).not.toContain("Examples:");
    });

    it("does not show Examples section when examples is empty", () => {
      const cmd = command({
        name: "my-cli",
        examples: [],
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).not.toContain("Examples:");
    });

    it("shows examples after description and before usage", () => {
      const cmd = command({
        name: "my-cli",
        description: "A test CLI",
        examples: ["my-cli init"],
        handler: () => {},
      });

      const help = cmd.help();

      const descIdx = help.indexOf("A test CLI");
      const examplesIdx = help.indexOf("Examples:");
      const usageIdx = help.indexOf("Usage:");

      expect(descIdx).toBeLessThan(examplesIdx);
      expect(examplesIdx).toBeLessThan(usageIdx);
    });

    it("works on parent commands", () => {
      const init = command({ name: "init", handler: () => {} });

      const cli = command({
        name: "my-cli",
        examples: ["my-cli init myapp", "my-cli build"],
        subcommands: [init],
      });

      const help = cli.help();

      expect(help).toContain(kleur.bold("Examples:"));
      expect(help).toContain("my-cli init myapp");
    });
  });

  describe("default values", () => {
    it("shows default value for string option", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          output: { type: "string", default: "out.txt", description: "Output file" },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("Output file");
      expect(help).toContain(kleur.dim("(default: out.txt)"));
    });

    it("shows default value for number option", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", default: 3000, description: "Port number" },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("Port number");
      expect(help).toContain(kleur.dim("(default: 3000)"));
    });

    it("shows default value for boolean option", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          verbose: { type: "boolean", default: true, description: "Verbose mode" },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("Verbose mode");
      expect(help).toContain(kleur.dim("(default: true)"));
    });

    it("does not show default suffix when no default", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", description: "Port number" },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("Port number");
      expect(help).not.toContain("(default:");
    });

    it("shows default alongside description", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          port: { type: "number", default: 8080, description: "Server port" },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain(`Server port ${kleur.dim("(default: 8080)")}`);
    });
  });

  describe("choices", () => {
    it("shows choices for options instead of type placeholder", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          format: {
            type: "string",
            choices: ["json", "yaml", "toml"] as const,
            description: "Output format",
          },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain(`--format${kleur.dim("=<json|yaml|toml>")}`);
      expect(help).toContain("Output format");
    });

    it("shows choices for arguments in description", () => {
      const cmd = command({
        name: "my-cli",
        args: [
          {
            name: "action",
            type: "string",
            description: "Action to perform",
            choices: ["start", "stop", "restart"] as const,
          },
        ] as const,
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("Action to perform (start|stop|restart)");
    });

    it("shows choices for arguments without description", () => {
      const cmd = command({
        name: "my-cli",
        args: [
          {
            name: "action",
            type: "string",
            choices: ["start", "stop"] as const,
          },
        ] as const,
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain("(start|stop)");
    });

    it("shows choices with multiple option suffix", () => {
      const cmd = command({
        name: "my-cli",
        options: {
          format: {
            type: "string",
            choices: ["json", "yaml"] as const,
            multiple: true,
          },
        },
        handler: () => {},
      });

      const help = cmd.help();

      expect(help).toContain(`--format${kleur.dim("=<json|yaml>...")}`);
    });
  });

  describe("hidden commands", () => {
    it("excludes hidden subcommands from help", () => {
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

      const help = cli.help();

      expect(help).toContain("visible");
      expect(help).toContain("Visible command");
      expect(help).not.toContain("hidden");
      expect(help).not.toContain("Hidden command");
    });

    it("excludes hidden commands from grouped help", () => {
      const visible = command({ name: "visible", description: "Visible", handler: () => {} });
      const hidden = command({
        name: "hidden",
        description: "Hidden",
        hidden: true,
        handler: () => {},
      });

      const cli = command({
        name: "my-cli",
        groups: {
          Commands: ["visible", "hidden"],
        },
        subcommands: [visible, hidden],
      });

      const help = cli.help();

      expect(help).toContain("visible");
      expect(help).not.toContain("hidden");
    });

    it("excludes hidden commands from ungrouped section", () => {
      const grouped = command({ name: "grouped", handler: () => {} });
      const visible = command({ name: "visible", description: "Visible", handler: () => {} });
      const hidden = command({
        name: "hidden",
        description: "Hidden",
        hidden: true,
        handler: () => {},
      });

      const cli = command({
        name: "my-cli",
        groups: {
          Main: ["grouped"],
        },
        subcommands: [grouped, visible, hidden],
      });

      const help = cli.help();

      expect(help).toContain("grouped");
      expect(help).toContain("visible");
      expect(help).not.toContain("hidden");
    });
  });
});
