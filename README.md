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

\* A command has either `handler` OR `subcommands`, never both.

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

### Positional Args

```typescript
{ name: "file", type: "string", optional: true, description: "Input file" }
```

Types: `"string"` | `"number"` | `"boolean"`

### Options

```typescript
{
  verbose: {
    type: "boolean",
    long: "verbose",
    short: "v",
    description: "Extra output"
  }
}
```

### `run(command, argv)`

Runs the command. Handles `-h`/`--help` automatically. Missing args? Shows help. Bad option? Red error + usage.

### `command.help()`

Returns the auto-generated help string. For when you need it manually.

## License

MIT
