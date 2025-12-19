import { command } from "../../../src/index";
import { GlobalOptions } from "../options";

export const add = command({
  name: "add",
  description: "Add a new note",
  inherits: GlobalOptions,
  args: [{ name: "content", type: "string", description: "Note content" }] as const,
  options: {
    tag: {
      type: "string",
      long: "tag",
      short: "t",
      description: "Tag for the note",
    },
  },
  handler: ([content], { verbose, config, tag }) => {
    if (verbose) {
      console.log(`[verbose] Config: ${config ?? "default"}`);
      console.log(`[verbose] Adding note...`);
    }
    console.log(`Added note: "${content}"${tag ? ` [${tag}]` : ""}`);
  },
});
