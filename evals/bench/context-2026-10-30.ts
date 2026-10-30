// [BENCH] DIRECTO, CONTINUACIÓN Y UNIDAD DELEGADA
// Piloto pequeño, no prueba de rentabilidad en sesiones largas. Mismo modelo,
// misma aceptación, preparación contabilizada y credenciales en su hogar nativo.
import { spawn, execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { continuationNote } from "../../pi-package/extensions/context-panel.ts";
const root = resolve(import.meta.dir, "../.."),
  out = join(root, ".n_ein/context-20261030");
mkdirSync(out, { recursive: true });
const model = "openai-codex/gpt-6.1-sol",
  thinking = "high";
const version = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).pi
  .version;
const results: any[] = [];
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const files = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : e.name.endsWith(".jsonl")
            ? [join(dir, e.name)]
            : [],
      )
    : [];
for (const arm of ["direct", "fresh", "delegated"]) {
  const folder = join(out, arm),
    project = join(folder, "project"),
    home = join(folder, "home"),
    report = join(folder, "result.json");
  if (existsSync(report)) {
    results.push(JSON.parse(readFileSync(report, "utf8")));
    continue;
  }
  if (existsSync(folder))
    throw new Error(
      `Intento incompleto conservado en ${folder}; diagnostica antes de repetir`,
    );
  mkdirSync(folder, { recursive: true });
  cpSync(join(root, "evals/fixtures/continuity"), project, { recursive: true });
  const work = join(project, "WORK.md");
  let content = readFileSync(work, "utf8")
    .replace(
      "## Decisions",
      "## Authorization\n\nImplement T1, T2 and T3, run checks and commit locally. No push, release or changes outside this fixture.\n\n## Decisions",
    )
    .replace(
      "T1 only in Pi, then hand off to Claude for T2, then return to Pi for T3.",
      "Finish T1, T2 and T3 in this fixture, preserving the zero contract.",
    );
  writeFileSync(work, content);
  const pkg = JSON.parse(readFileSync(join(project, "package.json"), "utf8"));
  pkg.devDependencies = { typescript: "5.9.3" };
  writeFileSync(join(project, "package.json"), JSON.stringify(pkg, null, 2));
  writeFileSync(
    join(project, ".gitignore"),
    "node_modules/\n.codegraph/\n.n_ein/\n",
  );
  execFileSync("bun", ["install"], { cwd: project, stdio: "pipe" });
  git(project, "init", "-q", "-b", "main");
  git(project, "config", "user.name", "n_ein evaluation");
  git(project, "config", "user.email", "eval@local");
  git(project, "config", "commit.gpgsign", "false");
  git(project, "add", ".");
  git(project, "commit", "-qm", "fixture");
  git(project, "switch", "-qc", "work");
  const env = {
    ...process.env,
    N_EIN_HOME: home,
    N_EIN_AGENT_DIR: join(homedir(), ".n_ein/dev/pi-agent"),
    N_EIN_PI_BIN: join(homedir(), `.n_ein/runtimes/pi/${version}/bin/pi`),
    N_EIN_CODEGRAPH_BIN: join(
      homedir(),
      ".n_ein/runtimes/codegraph/1.6.1/bin/codegraph",
    ),
    N_EIN_CODEGRAPH_ALLOW_TEMP: "1",
    N_EIN_TEAM: arm === "delegated" ? "1" : "0",
    N_EIN_ROOT: root,
    N_EIN_TEAM_SESSION_DIR: join(folder, "child-sessions"),
  };
  const started = Date.now(),
    stages: any[] = [];
  async function run(stage: string, prompt: string, session: string) {
    const log = join(folder, `${stage}.events.jsonl`),
      err = join(folder, `${stage}.stderr`),
      a = Bun.file(log).writer(),
      b = Bun.file(err).writer();
    const child = spawn(
      join(root, "bin/n-ein-dev"),
      [
        "-p",
        "--mode",
        "json",
        "--model",
        model,
        "--thinking",
        thinking,
        "--session",
        session,
        prompt,
      ],
      { cwd: project, env, stdio: ["ignore", "pipe", "pipe"], detached: true },
    );
    child.stdout!.on("data", (d) => a.write(d));
    child.stderr!.on("data", (d) => b.write(d));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {}
    }, 420000);
    const at = Date.now(),
      exit = await new Promise<number | null>((done) =>
        child.once("close", done),
      );
    clearTimeout(timer);
    await a.end();
    await b.end();
    stages.push({ stage, seconds: (Date.now() - at) / 1000, exit, timedOut });
    return exit === 0 && !timedOut;
  }
  console.log(`[BENCH] >> CONTEXT :: arm: ${arm}`);
  const old = join(folder, "initial.jsonl");
  const ready = await run(
    "explore",
    "Investiga los contratos y consumidores de las tres tareas de WORK.md. No escribas ni implementes. Explica los riesgos y los casos de aceptación en menos de 200 palabras.",
    old,
  );
  if (ready)
    await run(
      "implement",
      arm === "delegated"
        ? "Implementación autorizada: completa T1, T2 y T3 de WORK.md mediante un único escritor de nein_team (taskId T1, clase riesgo) que haga la unidad completa: parser, formato, consumidor, pruebas y documentación. Integra su trabajo, comprueba el resultado completo y termina. No hagas polling ni lances otro escritor."
        : `${arm === "fresh" ? continuationNote(project) + "\n\n" : ""}Implementa T1, T2 y T3 de WORK.md, comprueba el resultado y haz los commits locales. Trabaja directamente sin subagentes.`,
      arm === "fresh" ? join(folder, "fresh.jsonl") : old,
    );
  let accepted = false,
    acceptance = "";
  try {
    acceptance = execFileSync(
      "bun",
      [
        "-e",
        `import {parsePort} from './src/parse-port.ts';import{formatPort}from './src/format-port.ts';import{configurationLabel}from './src/configuration-label.ts';import{strict as a}from 'node:assert';for(const [s,n]of [['0',0],[' 42 ',42],['65535',65535]])a.equal(parsePort(s),n);for(const s of ['', '-1','1.5','3px','65536'])a.throws(()=>parsePort(s));a.equal(formatPort('0'),'Port: 0 (automatic)');a.equal(configurationLabel('0'),'Listening on Port: 0 (automatic)');console.log('acceptance OK')`,
      ],
      { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    accepted = true;
  } catch (e) {
    acceptance = String(e);
  }
  const logs = [
    ...new Set([
      old,
      ...(arm === "fresh" ? [join(folder, "fresh.jsonl")] : []),
      ...files(join(folder, "child-sessions")),
      ...files(home).filter((p) => !p.endsWith("events.jsonl")),
    ]),
  ];
  let input = 0,
    output = 0,
    cacheRead = 0,
    cacheWrite = 0,
    usd = 0,
    messages = 0,
    priced = 0;
  const ids = new Set<string>();
  for (const path of logs)
    if (existsSync(path))
      for (const line of readFileSync(path, "utf8").split("\n")) {
        try {
          const e = JSON.parse(line),
            m = e.message;
          if (e.type !== "message" || m?.role !== "assistant") continue;
          const key = `${path}:${e.id}`;
          if (ids.has(key)) continue;
          ids.add(key);
          messages++;
          const u = m.usage;
          if (!u) continue;
          input += u.input ?? 0;
          output += u.output ?? 0;
          cacheRead += u.cacheRead ?? 0;
          cacheWrite += u.cacheWrite ?? 0;
          if (typeof u.cost?.total === "number") {
            usd += u.cost.total;
            priced++;
          }
        } catch {}
      }
  const result = {
    arm,
    model,
    thinking,
    seconds: (Date.now() - started) / 1000,
    stages,
    accepted,
    acceptance,
    usage: { input, output, cacheRead, cacheWrite, usd, messages, priced },
    sessionFiles: logs.map((p) => p.replace(root + "/", "")),
    head: git(project, "rev-parse", "HEAD"),
    status: git(project, "status", "--porcelain"),
  };
  writeFileSync(report, JSON.stringify(result, null, 2));
  results.push(result);
  console.log(
    `[BENCH] ++ CONTEXT :: arm: ${arm} | accepted: ${accepted} | seconds: ${result.seconds.toFixed(1)}`,
  );
}
writeFileSync(join(out, "summary.json"), JSON.stringify(results, null, 2));
