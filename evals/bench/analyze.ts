// =============================================================================
// [BENCH] MÉTRICAS DE UNA EJECUCIÓN
// uso: bun analyze.ts <run>   → escribe logs/<run>/metrics.json y lo imprime
// Suma el uso de todas las sesiones de Pi del hogar de la ejecución (padre e
// hijos con sesión) más el uso que los hijos sin sesión devuelven en
// `details.usage`, o los eventos de Codex. El coste se recalcula con la misma
// tarifa de catálogo para todas las variantes: es una estimación, no lo facturado.
// =============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const bench = process.env.N_EIN_BENCH ?? "/Users/samu/Documents/01_Proyectos/n_ein-bench";
const run = process.argv[2]!;
const home = join(bench, "homes", run), copy = join(bench, "copies", run), log = join(bench, "logs", run);
const meta = JSON.parse(readFileSync(join(log, "meta.json"), "utf8"));
// Tarifa de catálogo de Pi para gpt-6-sol (USD por millón; tramo hasta 272k).
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number };
const zero = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 });
const add = (a: Usage, u: Partial<Usage>) => { for (const k of Object.keys(a) as (keyof Usage)[]) a[k] += Number(u[k] ?? 0) || 0; };
const usd = (u: Usage) => (u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite) / 1e6;

function files(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== "node_modules" && name !== "npm") files(p, out); }
    else if (name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

const total = zero(), parent = zero(), children = zero();
let childUsd = 0, childUsdMissing = false, parentUsd = 0;
const tools: Record<string, number> = {};
const childRoles: Record<string, number> = {};
const sessions: string[] = [];
let firstCodegraph = -1, firstLook = -1, toolIndex = 0, assistantTurns = 0, models = new Set<string>();
const LOOK = new Set(["read", "grep", "find", "ls"]);

function countTool(name: string, args: Record<string, unknown> | undefined) {
  toolIndex++;
  tools[name] = (tools[name] ?? 0) + 1;
  if (/codegraph/i.test(name) && firstCodegraph < 0) firstCodegraph = toolIndex;
  const cmd = String(args?.command ?? "");
  const looks = LOOK.has(name) || (name === "bash" && /(^|[;&|]\s*)(rg|grep|find|cat|sed -n|ls)\b/.test(cmd));
  if (looks && firstLook < 0) firstLook = toolIndex;
}

if (meta.arm === "C") {
  for (const f of readdirSync(log).filter((n) => n.startsWith("events-"))) {
    for (const line of readFileSync(join(log, f), "utf8").split("\n").filter(Boolean)) {
      let e: any; try { e = JSON.parse(line); } catch { continue; }
      if (e.type === "turn.completed" && e.usage) {
        const cached = e.usage.cached_input_tokens ?? 0;
        add(parent, { input: (e.usage.input_tokens ?? 0) - cached, cacheRead: cached, output: e.usage.output_tokens ?? 0, reasoning: e.usage.reasoning_output_tokens ?? 0 });
        assistantTurns++;
      }
      if (e.type === "item.completed" && e.item) {
        const t = e.item.type;
        if (t === "command_execution") countTool("bash", { command: e.item.command });
        else if (t === "file_change") countTool("edit", {});
        else if (t === "mcp_tool_call") countTool(String(e.item.tool ?? "mcp"), {});
      }
    }
  }
  add(total, parent);
} else {
  const seen = new Set<string>();
  for (const f of files(home)) {
    const lines = readFileSync(f, "utf8").split("\n").filter(Boolean);
    let isSession = false, localUsd = 0, localUsdMissing = false;
    const local = zero();
    for (const line of lines) {
      let e: any; try { e = JSON.parse(line); } catch { continue; }
      if (e.type === "session") isSession = true;
      if (e.type !== "message" || !e.message) continue;
      const key = `${f}:${e.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = e.message;
      if (m.role === "assistant") {
        if (m.usage) add(local, m.usage);
        // Pi anota el coste de catálogo del modelo que respondió: es la cifra justa cuando no es Sol.
        if (typeof m.usage?.cost?.total === "number") localUsd += m.usage.cost.total; else localUsdMissing = true;
        if (m.model) models.add(`${m.provider}/${m.model}`);
        assistantTurns++;
        for (const c of m.content ?? []) if (c.type === "toolCall") countTool(c.name, c.arguments);
      }
      // Hijos sin sesión propia (n_ein): su uso vuelve en el resultado de la herramienta.
      if (m.role === "toolResult" && m.details?.usage && typeof m.details.usage.input === "number") {
        add(children, m.details.usage);
        // El hijo trae su propia estimación de catálogo con la tarifa de su modelo (Luna no cuesta como Sol).
        if (typeof m.details.usage.catalogEstimateUsd === "number") childUsd += m.details.usage.catalogEstimateUsd;
        else childUsdMissing = true;
        const role = m.details.role ?? m.toolName ?? "child";
        childRoles[role] = (childRoles[role] ?? 0) + 1;
      }
    }
    if (isSession) sessions.push(relative(home, f));
    // Gentle guarda las sesiones de sus subagentes aparte: cuentan como hijos.
    if (f.includes("/gentle-agents/")) { add(children, local); childRoles["gentle-subagent"] = (childRoles["gentle-subagent"] ?? 0) + 1; childUsd += localUsdMissing ? usd(local) : localUsd; }
    else { add(parent, local); parentUsd += localUsdMissing ? usd(local) : localUsd; }
  }
  add(total, parent); add(total, children);
}

// --- método y artefactos, desde Git ----------------------------------------
const git = (...args: string[]) => { try { return execFileSync("git", ["-C", copy, ...args], { encoding: "utf8" }).trim(); } catch { return ""; } };
const baseRev: string = meta.base_rev;
const branches = git("for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n").filter(Boolean);
const commits = git("rev-list", "--all", `^${baseRev}`).split("\n").filter(Boolean);
const pushed = git("--git-dir", join(bench, "remotes", `${run}.git`), "for-each-ref", "--format=%(refname:short)", "refs/heads")
  .split("\n").filter((b) => b && b !== "main").length > 0 || git("--git-dir", join(bench, "remotes", `${run}.git`), "rev-parse", "main") !== baseRev;
const coauthor = commits.some((c) => /Co-Authored-By/i.test(git("log", "-1", "--format=%B", c)));
const status = git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean);
const changed = git("diff", "--name-only", baseRev).split("\n").filter(Boolean);
const untracked = status.filter((l) => l.startsWith("??")).map((l) => l.slice(3));
const docPatterns = [/^WORK\.md$/, /^work\//, /^odd\/tasks\//, /^\.scratch\//];
const docs = [...new Set([...changed, ...untracked])].filter((p) => docPatterns.some((r) => r.test(p)));
const docBytes = docs.reduce((n, p) => n + (existsSync(join(copy, p)) ? statSync(join(copy, p)).size : 0), 0);
const stat = git("diff", "--shortstat", baseRev);

const metrics = {
  ...meta,
  usage: { total, parent, children, usd: Number((meta.arm === "C" ? usd(total) : parentUsd + (childUsdMissing ? usd(children) : childUsd)).toFixed(4)), usdAllSol: Number(usd(total).toFixed(4)) },
  assistantTurns, toolCalls: toolIndex, tools, childRoles, models: [...models],
  firstCodegraph, firstLook, sessions: sessions.length,
  git: { branches, commits: commits.length, pushed, coauthor, dirty: status.length, changedFiles: changed.length + untracked.length, shortstat: stat },
  docs, docBytes,
  stopped: existsSync(join(log, "stopped")),
};
writeFileSync(join(log, "metrics.json"), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics));
