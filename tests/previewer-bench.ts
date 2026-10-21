// [CHECK] El banco del revisor sin modelo: la reconstrucción no deja ver el arreglo
// y la contaminación se detecta en los eventos de Pi y de Claude Code.
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contamination, materialize, type Case } from "../evals/previewer/bench.ts";

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "nein-previewer-bench-")));
const git = (cwd: string, ...args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

// --- Un caso del historial: base, cambio con fallo y arreglo posterior -------------------------
const source = join(scratch, "source");
mkdirSync(source);
git(source, "init", "-q", "-b", "main");
git(source, "config", "user.email", "test@local");
git(source, "config", "user.name", "Test");
writeFileSync(join(source, "clip.ts"), "export const clip = (text: string) => text;\n");
writeFileSync(join(source, "gone.ts"), "export const gone = 1;\n");
git(source, "add", ".");
git(source, "commit", "-qm", "base");
const base = git(source, "rev-parse", "HEAD");
writeFileSync(join(source, "clip.ts"), "export const clip = (text: string) => text.slice(0, 3);\n");
git(source, "rm", "-q", "gone.ts");
git(source, "commit", "-qam", "feat: clip names\n\nCorta los nombres largos.");
const head = git(source, "rev-parse", "HEAD");
writeFileSync(join(source, "clip.ts"), "export const clip = (text: string) => [...text].slice(0, 3).join('');\n");
git(source, "commit", "-qam", "fix: no partir caracteres ARREGLO-SECRETO");

const item: Case = { id: "demo", split: "dev", category: "bug", origin: "test", source: { kind: "git", repo: source, base, head } };
const repo = join(scratch, "case");
materialize(item, repo);
assert.deepEqual(git(repo, "log", "--all", "--format=%s").split("\n"), ["feat: clip names", "base"], "solo base y cambio, con el mensaje original");
assert.equal(git(repo, "rev-parse", "--abbrev-ref", "HEAD"), "change");
assert.match(readFileSync(join(repo, "clip.ts"), "utf8"), /text\.slice\(0, 3\)/);
assert.doesNotMatch(execFileSync("git", ["log", "--all", "-p"], { cwd: repo, encoding: "utf8" }), /ARREGLO-SECRETO|\[\.\.\.text\]/, "el arreglo no está en la copia");
assert.match(git(repo, "diff", "--name-status", "main", "change"), /D\tgone\.ts/, "lo borrado en el cambio también se borra");

// --- Un caso del corpus de lang-pr-review -------------------------------------------------------
const lang = join(scratch, "lang");
materialize({ id: "lang", split: "dev", category: "bug", origin: "test", source: { kind: "dir", path: "lang/dev-01", message: "Simplificar el presupuesto" } }, lang);
assert.deepEqual(git(lang, "diff", "--name-only", "main", "change").split("\n"), ["pricing.py"], "head solo sustituye lo que trae");
assert.ok(readFileSync(join(lang, "checkout.py"), "utf8").length > 0, "lo demás se hereda de base");

// --- Contaminación ------------------------------------------------------------------------------
const runDir = join(scratch, "run");
mkdirSync(runDir);
const events = [
  { type: "tool_execution_start", toolName: "read", args: { path: join(repo, "clip.ts") } },
  { type: "message_update", text: `menciona ${source} sin usarlo` },
  { type: "tool_execution_start", toolName: "bash", args: { command: `git -C ${source} log` } },
  { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/x/evals/previewer/references/demo.json" } }] } },
];
writeFileSync(join(runDir, "events.jsonl"), events.map((event) => JSON.stringify(event)).join("\n"));
const hits = contamination(runDir, item);
assert.equal(hits.length, 2, hits.join("\n"));
assert.ok(hits.some((hit) => hit.startsWith(source)), "Pi: un comando sobre el repositorio de origen");
assert.ok(hits.some((hit) => hit.startsWith("evals/previewer")), "Claude Code: leer las referencias");

console.log("previewer bench: OK");
