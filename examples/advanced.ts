/**
 * Advanced CLI Example
 *
 * Demonstrates underdocumented features:
 * - Variadic arguments (collect remaining args into array)
 * - Required options
 * - Multiple values (repeated flags)
 * - Default values
 * - Negatable flags
 * - Custom placeholders
 * - Async handlers
 *
 * Usage examples:
 *
 *   # Required option
 *   bun examples/advanced.ts file1.txt file2.txt --output ./dist
 *
 *   # Multiple tags
 *   bun examples/advanced.ts *.ts -o ./dist --tag important --tag urgent
 *
 *   # Negatable flag
 *   bun examples/advanced.ts file.txt -o ./out --no-color
 *
 *   # Default value (workers defaults to 4)
 *   bun examples/advanced.ts file.txt -o ./out -w 8
 */

import { command, run } from "../src/index";

const process_cmd = command({
  name: "process",
  description: "Process files with advanced options",
  version: "1.0.0",
  args: [
    { name: "files", type: "string", variadic: true, description: "Files to process" },
  ] as const,
  options: {
    output: {
      type: "string",
      short: "o",
      required: true,
      placeholder: "dir",
      description: "Output directory (required)",
    },
    tag: {
      type: "string",
      short: "t",
      multiple: true,
      description: "Tags to apply (can specify multiple)",
    },
    workers: {
      type: "number",
      short: "w",
      default: 4,
      description: "Number of parallel workers",
    },
    color: {
      type: "boolean",
      negatable: true,
      description: "Colorize output",
    },
  },
  handler: async ([files], { output, tag, workers, color }) => {
    console.log(`Processing ${files.length} files...`);
    console.log(`Output: ${output}`);
    console.log(`Workers: ${workers}`);
    console.log(`Tags: ${tag?.join(", ") || "none"}`);
    console.log(`Color: ${color ?? "default"}`);

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("Done!");
  },
});

run(process_cmd, process.argv.slice(2));
