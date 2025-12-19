import { command } from "../../../src/index";
import { GlobalOptions } from "../options";

export const list = command({
  name: "list",
  description: "List all notes",
  inherits: GlobalOptions,
  options: {
    tag: {
      type: "string",
      long: "tag",
      short: "t",
      description: "Filter by tag",
    },
    limit: {
      type: "number",
      long: "limit",
      short: "n",
      description: "Max notes to show",
    },
  },
  handler: (_, { verbose, config, tag, limit }) => {
    if (verbose) {
      console.log(`[verbose] Config: ${config ?? "default"}`);
      console.log(`[verbose] Fetching notes...`);
    }
    console.log("Listing notes...");
    if (tag) console.log(`  Filtered by tag: ${tag}`);
    if (limit) console.log(`  Limited to: ${limit}`);
  },
});
