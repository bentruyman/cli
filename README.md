# > cli

Build CLIs. TypeScript does the rest.

## Install

```bash
npm i @truyman/cli
```

## Quick Start

```typescript
import { command, run } from "@truyman/cli";

const greet = command({
  name: "greet",
  args: [{ name: "name", type: "string" }],
  handler: ([name]) => console.log(`Hello, ${name}!`),
});

run(greet, process.argv.slice(2));
```

```bash
$ bun greet.ts World
Hello, World!
```

That's it. Your args are typed. Your handler knows what it's getting.

## Features

- **Type-safe everything** - Args and options flow into your handler with full type inference
- **Subcommands** - Nest commands infinitely: `cli foo bar baz`
- **Built-in help** - `-h` and `--help` just work
- **Graceful errors** - `run()` catches known errors and prints them pretty
- **Short & long flags** - `-v` and `--verbose`, the way nature intended

## Full Example

```typescript
import { command, run } from "@truyman/cli";

const greet = command({
  name: "greet",
  description: "A friendly greeting CLI",
  version: "1.0.0",
  args: [
    { name: "name", type: "string", description: "Who to greet" },
  ],
  options: {
    shout: {
      type: "boolean",
      long: "shout",
      short: "s",
      description: "LOUD MODE",
    },
    times: {
      type: "number",
      long: "times",
      short: "n",
      description: "Repeat N times",
    },
  },
  handler: ([name], { shout, times }) => {
    let msg = `Hello, ${name}!`;
    if (shout) msg = msg.toUpperCase();
    for (let i = 0; i < (times || 1); i++) {
      console.log(msg);
    }
  },
});

run(greet, process.argv.slice(2));
```

```bash
$ bun greet.ts Ada --shout -n 3
HELLO, ADA!
HELLO, ADA!
HELLO, ADA!
```

## API

### `command(options)`

| Property      | Type                      | Required | Description                    |
| ------------- | ------------------------- | -------- | ------------------------------ |
| `name`        | `string`                  | Yes      | Command name                   |
| `description` | `string`                  | No       | Shown in help                  |
| `version`     | `string`                  | No       | Version string                 |
| `args`        | `PositionalArg[]`         | No       | Positional arguments           |
| `options`     | `Options`                 | No       | Flag options                   |
| `inherits`    | `Options`                 | No       | Options inherited from parents |
| `handler`     | `(args, options) => void` | \*       | Your code goes here            |
| `subcommands` | `Command[]`               | \*       | Nested commands                |
| `groups`      | `CommandGroups`           | No       | Group subcommands in help      |
| `examples`    | `Examples`                | No       | Usage examples in help         |

\* A command has `handler`, `subcommands`, or both. When both are provided (hybrid command), the handler runs as the default when no subcommand matches.

### Subcommands

```typescript
// options.ts
import type { Options } from "@truyman/cli";

export const GlobalOptions = {
  verbose: { type: "boolean", long: "verbose", short: "v" },
} as const satisfies Options;
```

```typescript
// commands/add.ts
import { command } from "@truyman/cli";
import { GlobalOptions } from "../options";

export const add = command({
  name: "add",
  inherits: GlobalOptions,
  args: [{ name: "url", type: "string" }] as const,
  handler: ([url], { verbose }) => {
    if (verbose) console.log("[verbose] Adding remote...");
    console.log(`Added ${url}`);
  },
});
```

```typescript
// index.ts
import { command, run } from "@truyman/cli";
import { GlobalOptions } from "./options";
import { add } from "./commands/add";

const remote = command({
  name: "remote",
  options: GlobalOptions,
  subcommands: [add],
});

const git = command({
  name: "git",
  subcommands: [remote],
});

run(git, process.argv.slice(2));
```

```bash
$ git remote add https://github.com/... --verbose
```

The `inherits` property tells the leaf command which parent options it should parse and receive in its handler. This enables full type inference for inherited options.

### Command Aliases

Define alternative names for subcommands using the `aliases` property:

```typescript
const checkout = command({
  name: "checkout",
  aliases: ["co", "switch"],
  args: [{ name: "branch", type: "string" }] as const,
  handler: ([branch]) => console.log(`Switching to ${branch}`),
});

const git = command({
  name: "git",
  subcommands: [checkout],
});

run(git, process.argv.slice(2));
```

```bash
$ git checkout main    # works
$ git co main          # also works
$ git switch main      # also works
```

Aliases appear in help text alongside the primary name:

```
Commands:
  checkout (co, switch)  Switch branches
```

### Command Groups

Organize subcommands into groups for cleaner help output:

```typescript
const cli = command({
  name: "my-cli",
  groups: {
    "Project": ["init", "build", "test"],
    "Development": ["serve", "watch"],
  },
  subcommands: [init, build, test, serve, watch, help],
});
```

```
$ my-cli --help

Usage:
  my-cli [options] <command> [args...]

Project:
  init    Initialize a new project
  build   Build the project
  test    Run tests

Development:
  serve   Start development server
  watch   Watch for changes

  help    Show help

Options:
  -h, --help     Show help
  -V, --version  Show version
```

Groups appear in definition order. Commands not assigned to any group appear last without a header. This is optional—omit `groups` for a flat command list.

### Examples

Add usage examples to help output:

```typescript
const cli = command({
  name: "my-cli",
  description: "A deployment tool",
  examples: [
    "my-cli deploy",
    "my-cli deploy --env staging",
    { command: "my-cli deploy --env prod", description: "Deploy to production" },
  ],
  handler: () => {},
});
```

```
$ my-cli --help

A deployment tool

Examples:
  my-cli deploy
  my-cli deploy --env staging
  my-cli deploy --env prod  Deploy to production

Usage:
  my-cli [options]

Options:
  -h, --help     Show help
  -V, --version  Show version
```

Examples can be simple strings or objects with `{ command, description }` for annotated examples. Descriptions are shown dimmed and aligned.

### Positional Args

| Property      | Type       | Description                                      |
| ------------- | ---------- | ------------------------------------------------ |
| `name`        | `string`   | Argument name shown in help                      |
| `type`        | `string`   | `"string"`, `"number"`, or `"boolean"`           |
| `description` | `string`   | Shown in help output                             |
| `optional`    | `boolean`  | Shows as `[name]` instead of `<name>`            |
| `variadic`    | `boolean`  | Collect remaining args into array (must be last) |
| `choices`     | `array`    | Restrict value to predefined set                 |
| `validate`    | `function` | Custom validation function                       |

#### Variadic Arguments

```typescript
const rm = command({
  name: "rm",
  args: [{ name: "files", type: "string", variadic: true }] as const,
  handler: ([files]) => files.forEach(f => console.log(`Removing ${f}`)),
});
// rm file1.txt file2.txt file3.txt → files = ["file1.txt", "file2.txt", "file3.txt"]
```

### Options

| Property      | Type       | Description                                 |
| ------------- | ---------- | ------------------------------------------- |
| `type`        | `string`   | `"string"`, `"number"`, or `"boolean"`      |
| `long`        | `string`   | Long flag name (defaults to key name)       |
| `short`       | `string`   | Single-character short flag                 |
| `description` | `string`   | Shown in help output                        |
| `default`     | `any`      | Default value when not provided             |
| `required`    | `boolean`  | Throw error if not provided                 |
| `multiple`    | `boolean`  | Collect repeated flags into array           |
| `negatable`   | `boolean`  | Allow `--no-<flag>` syntax (boolean only)   |
| `placeholder` | `string`   | Custom placeholder in help (e.g., `"path"`) |
| `env`         | `string`   | Environment variable name as fallback       |
| `choices`     | `array`    | Restrict value to predefined set            |
| `validate`    | `function` | Custom validation function                  |

#### Default Values

```typescript
port: { type: "number", default: 3000 }
// --port 8080 → 8080, (omitted) → 3000
```

#### Required Options

```typescript
config: { type: "string", required: true }
// Missing --config throws MissingOptionError
```

#### Multiple Values

```typescript
tag: { type: "string", multiple: true }
// --tag foo --tag bar → ["foo", "bar"]
```

#### Negatable Flags

```typescript
color: { type: "boolean", negatable: true }
// --color → true, --no-color → false
```

#### Environment Variable Fallbacks

Use the `env` property to specify an environment variable as a fallback when the option isn't provided via CLI:

```typescript
const deploy = command({
  name: "deploy",
  options: {
    token: {
      type: "string",
      env: "API_TOKEN",
      description: "Authentication token",
    },
    port: {
      type: "number",
      env: "PORT",
      default: 3000,
    },
    debug: {
      type: "boolean",
      env: "DEBUG",
    },
  },
  handler: (_, { token, port, debug }) => {
    // token comes from --token, API_TOKEN, or undefined
    // port comes from --port, PORT, or 3000
  },
});
```

Value precedence: CLI argument > environment variable > default value.

For booleans, the following env values are parsed as `true` (case-insensitive): `"1"`, `"true"`, `"yes"`. All other values are `false`.

Environment variables are shown in help text:

```
Options:
  --token=<str>  Authentication token [$API_TOKEN]
  --port=<num>   (default: 3000) [$PORT]
```

#### Custom Validation

Use the `validate` function for custom validation logic. Return `true` if valid, or an error message string if invalid:

```typescript
const serve = command({
  name: "serve",
  options: {
    port: {
      type: "number",
      validate: (v) => (v >= 1 && v <= 65535) || "Port must be between 1 and 65535",
    },
    host: {
      type: "string",
      validate: (v) => v.length > 0 || "Host cannot be empty",
    },
  },
  handler: (_, { port, host }) => {
    // port is guaranteed to be 1-65535 if provided
  },
});
```

```bash
$ serve --port 99999
Error: Port must be between 1 and 65535
```

Validation runs after type coercion, so you receive the typed value (not a raw string). Validation is not called on `undefined` values (optional args/options that weren't provided). For `multiple` options, validation runs on each value individually.

#### Choices (Enum Constraint)

Use `choices` to restrict values to a predefined set:

```typescript
const build = command({
  name: "build",
  args: [
    {
      name: "env",
      type: "string",
      choices: ["development", "staging", "production"] as const,
    },
  ] as const,
  options: {
    format: {
      type: "string",
      choices: ["json", "yaml", "toml"] as const,
      default: "json",
    },
    level: {
      type: "number",
      choices: [1, 2, 3] as const,
    },
  },
  handler: ([env], { format, level }) => {
    // env: "development" | "staging" | "production"
    // format: "json" | "yaml" | "toml"
    // level: 1 | 2 | 3 | undefined
  },
});
```

Use `as const` on the choices array for precise type inference.

Invalid choices show a helpful error:

```bash
$ build production --format xml
Error: Invalid value 'xml' for format. Valid choices: json, yaml, toml
```

Help text displays available choices:

```
Arguments:
  <env>  (development|staging|production)

Options:
  --format=<json|yaml|toml>  (default: json)
  --level=<1|2|3>
```

### Async Handlers

Handlers can be async. `run()` awaits completion:

```typescript
handler: async ([url]) => {
  const res = await fetch(url);
  console.log(await res.text());
}
```

### Error Handling

`run()` catches errors and displays helpful messages. For custom handling, call `command.run()` directly:

```typescript
import { MissingArgumentError } from "@truyman/cli";

try {
  myCommand.run(argv);
} catch (err) {
  if (err instanceof MissingArgumentError) {
    // Custom handling
  }
}
```

| Error                    | Cause                                       |
| ------------------------ | ------------------------------------------- |
| `MissingArgumentError`   | Required positional argument not provided   |
| `InvalidArgumentError`   | Argument value doesn't match expected type  |
| `MissingOptionError`     | Required option not provided                |
| `InvalidOptionError`     | Option value doesn't match expected type    |
| `UnknownOptionError`     | Unknown flag provided                       |
| `MissingSubcommandError` | Parent command invoked without subcommand   |
| `UnknownSubcommandError` | Unknown subcommand name (shows suggestions) |
| `ValidationError`        | Custom validation function returned error   |
| `InvalidChoiceError`     | Value not in allowed choices                |

### Type Safety

Use `as const` on args for precise type inference:

```typescript
// ✓ Handler receives [string, number | undefined]
args: [
  { name: "file", type: "string" },
  { name: "count", type: "number", optional: true },
] as const,

// ✗ Without as const: handler receives unknown[]
```

For reusable options, use `as const satisfies Options`:

```typescript
const GlobalOptions = {
  verbose: { type: "boolean", short: "v" },
} as const satisfies Options;
```

### `run(command, argv)`

Runs the command. Handles `-h`/`--help` automatically. Missing args? Shows help. Bad option? Red error + usage.

### `command.help()`

Returns the auto-generated help string. For when you need it manually.

## License

MIT
