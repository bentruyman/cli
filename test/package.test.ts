import { expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

it("builds a package usable by strict NodeNext consumers and Node", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-package-"));
  try {
    const configFile = ts.readConfigFile(resolve("tsconfig.build.json"), ts.sys.readFile);
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
    const program = ts.createProgram(config.fileNames, { ...config.options, outDir: dir });
    const emitted = program.emit();
    expect(ts.getPreEmitDiagnostics(program).concat(emitted.diagnostics)).toEqual([]);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    const consumer = join(dir, "consumer.mts");
    writeFileSync(
      consumer,
      `
      import { command, generateCompletions, type Option } from './index.js';
      const script: string = generateCompletions(command({name:'cli',handler:()=>{}}), 'zsh');
      command({name:'cli', args:[{name:'file',type:'string'}], options:{
        port:{type:'number',validate:v=>v>0 || 'invalid'}, flag:{type:'boolean'}
      }, handler:([file],opts)=>{
        const text: string = file;
        const port: number | undefined = opts.port;
        // @ts-expect-error Optional boolean may be absent.
        const flag: boolean = opts.flag;
        // @ts-expect-error The inferred tuple must not be any.
        const invalid: number = file;
      }});
      // @ts-expect-error Invalid default type.
      const invalid: Option = {type:'number',default:'oops'};
    `,
    );
    const check = ts.createProgram([consumer], {
      strict: true,
      noEmit: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
      types: [],
      skipLibCheck: false,
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(check)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    expect(diagnostics).toEqual([]);
    const build = await Bun.build({
      entrypoints: [resolve("src/index.ts")],
      outdir: dir,
      target: "node",
    });
    expect(build.success).toBe(true);
    const source = `import {command,run} from ${JSON.stringify(join(dir, "index.js"))}; await run(command({name:'cli',args:[{name:'file',type:'string'}],handler:([file])=>console.log(file)}),process.argv.slice(1));`;
    const success = Bun.spawnSync(["node", "--input-type=module", "-e", source, "0012"]);
    expect(success.exitCode).toBe(0);
    expect(success.stdout.toString().trim()).toBe("0012");
    const failure = Bun.spawnSync(["node", "--input-type=module", "-e", source]);
    expect(failure.exitCode).toBe(1);
    expect(failure.stderr.length).toBeGreaterThan(0);
    const nestedSource = `import {command,run} from ${JSON.stringify(join(dir, "index.js"))};
      const child = command({name:'child',args:[{name:'files',type:'string',variadic:true}],options:{
        tag:{type:'string',multiple:true}, id:{type:'string'}, count:{type:'number',short:'n'},
        color:{type:'boolean',negatable:true,default:true}
      },handler:(args,opts)=>console.log(JSON.stringify({args,opts}))});
      await run(command({name:'cli',subcommands:[child]}),process.argv.slice(1));`;
    const nested = Bun.spawnSync([
      "node",
      "--input-type=module",
      "-e",
      nestedSource,
      "child",
      "--tag",
      "a",
      "--tag",
      "b",
      "--id",
      "0012",
      "-n",
      "-1",
      "--no-color",
      "--",
      "--help",
      "-",
    ]);
    expect(nested.exitCode).toBe(0);
    expect(JSON.parse(nested.stdout.toString())).toEqual({
      args: [["--help", "-"]],
      opts: { tag: ["a", "b"], id: "0012", count: -1, color: false },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20_000);
