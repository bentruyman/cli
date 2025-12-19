import { command, run } from "../../src/index";

import { add } from "./commands/add";
import { list } from "./commands/list";
import { remove } from "./commands/remove";
import { GlobalOptions } from "./options";

const notes = command({
  name: "notes",
  description: "A simple notes manager",
  version: "1.0.0",
  options: GlobalOptions,
  subcommands: [add, list, remove],
});

run(notes, process.argv.slice(2));
