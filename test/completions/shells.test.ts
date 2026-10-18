import { expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "../../src/index";
import { generateCompletions } from "../../src/completions";

const root = command({
  name: "cli",
  options: { config: { type: "string", short: "c" } },
  subcommands: [
    command({
      name: "remote",
      aliases: ["r"],
      subcommands: [
        command({
          name: "add",
          aliases: ["a"],
          options: {
            tag: { type: "string", short: "t" },
            color: { type: "boolean", negatable: true },
          },
          handler: () => {},
        }),
      ],
    }),
    command({
      name: "user",
      subcommands: [
        command({ name: "add", options: { role: { type: "string" } }, handler: () => {} }),
      ],
    }),
  ],
});
const cases: [string[], string][] = [
  [["cli", "--config", "user", "r", "a", "--ta"], "--tag"],
  [["cli", "--config=user", "remote", "add", "--no-co"], "--no-color"],
  [["cli", "-cuser", "r", "a", "--ta"], "--tag"],
  [["cli", "user", "add", "--ro"], "--role"],
  [["cli", "r", "a", "--con"], "--config"],
];
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

for (const shell of ["bash", "fish"] as const) {
  it.skipIf(!Bun.which(shell))(
    `${shell} completes aliases, inherited flags, and full paths in the actual shell`,
    () => {
      for (const [words, expected] of cases) {
        const script =
          generateCompletions(root, shell) +
          (shell === "bash"
            ? `\nCOMP_WORDS=(${words.map(quote).join(" ")}); COMP_CWORD=${words.length - 1}; _cli_completions; printf '%s\\n' "\u0024{COMPREPLY[@]}"\n`
            : `\ncomplete -C ${quote(words.join(" "))}\n`);
        const result = Bun.spawnSync(
          [shell, ...(shell === "bash" ? ["--noprofile", "--norc"] : ["--no-config"])],
          { stdin: Buffer.from(script), timeout: 5000 },
        );
        expect(result.stderr.toString()).toBe("");
        expect(result.exitCode).toBe(0);
        expect(
          result.stdout
            .toString()
            .split(/\n/)
            .map((line) => line.split("\t")[0]),
        ).toContain(expected);
      }
    },
  );
}

it.skipIf(!Bun.which("zsh"))(
  "zsh registers and completes nested commands through its real line editor",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-completions-"));
    try {
      const path = join(dir, "completion.zsh");
      writeFileSync(path, generateCompletions(root, "zsh"));
      for (const [words, expected] of cases) {
        const setup = `autoload -Uz compinit; compinit -D; source ${quote(path)}; PS1=""; function dump_buffer { print -r -- "RES""ULT:$BUFFER:END"; zle reset-prompt; }; zle -N dump_buffer; bindkey "^X" dump_buffer; print -r -- RE""ADY`;
        const script = `zmodload zsh/zpty
zpty -b worker zsh -f
trap 'zpty -d worker' EXIT
zmodload zsh/zselect
wait_for_output() {
  local output="" chunk
  for attempt in {1..500}; do
    if zpty -r worker chunk; then
      output+="$chunk"
      if [[ "$output" == \${~1} ]]; then
        print -r -- "$output"
        return
      fi
    fi
    zselect -t 1
  done
  print -ru2 -- "Timed out waiting for $1. Terminal output: $output"
  return 1
}
zpty -w worker ${quote(setup)}
wait_for_output '*READY*' || exit 1
zpty -w -n worker ${quote(words.join(" ") + "\t\x18")}
wait_for_output '*RESULT:*:END*' || exit 1
`;
        const result = Bun.spawnSync(["zsh", "-f"], {
          stdin: Buffer.from(script),
          timeout: 15000,
          env: { ...process.env, TERM: "xterm" },
        });
        expect(result.stderr.toString()).toBe("");
        expect(result.exitCode).toBe(0);
        const output = result.stdout.toString();
        const prefix = `RESULT:${words.slice(0, -1).join(" ")} ${expected}`;
        expect(output.includes(`${prefix} :END`) || output.includes(`${prefix}=:END`)).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  20_000,
);
