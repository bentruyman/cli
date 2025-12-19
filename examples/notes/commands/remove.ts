import { command } from "../../../src/index";
import { GlobalOptions } from "../options";

export const remove = command({
  name: "remove",
  description: "Remove a note by ID",
  inherits: GlobalOptions,
  args: [{ name: "id", type: "number", description: "Note ID to remove" }] as const,
  options: {
    force: {
      type: "boolean",
      long: "force",
      short: "f",
      description: "Skip confirmation",
    },
  },
  handler: ([id], { verbose, config, force }) => {
    if (verbose) {
      console.log(`[verbose] Config: ${config ?? "default"}`);
      console.log(`[verbose] Removing note #${id}...`);
    }
    if (force) {
      console.log(`Removed note #${id}`);
    } else {
      console.log(`Would remove note #${id} (use --force to confirm)`);
    }
  },
});
