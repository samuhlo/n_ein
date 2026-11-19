// =============================================================================
// [FLOW] RUNTIMES DE N_EIN
// plan → apply → guard. El vigía de CI y Ein usan los mismos comandos:
//   plan         qué versiones nuevas se pueden probar (JSON por stdout)
//   apply        escribe runtime.json, lockfiles, VERSION y notas de un plan
//   next-version siguiente versión de mantenimiento sin tag existente
//   guard        falla si la release baja algún runtime respecto a la anterior
//   base         último tag publicado del canal (releases de gh por stdin)
//   issues       borradores de issue de bloqueo o de revisión del puente
//   groups       grupos que cambia un plan
//   state        convierte los issues del vigía en bloqueos y aprobaciones
// Los diagnósticos van a stderr; stdout queda para el resultado.
// =============================================================================

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve as resolvePath } from "node:path";
import {
  EMPTY_STATE, LABEL, breakingChanges, commitSubject, downgrades, markerText, newNetwork, newer, nextVersion, releaseNotes, resolve, restrict, stateFromIssues,
  type Change, type Group, type Issue, type Name, type Pins, type Plan, type Registry, type State,
} from "./resolve.ts";

export type HeldItem = { name: Name; version: string; reason: "review"; lines: string[] };
export type PlanFile = Plan & { base: Pins; held: HeldItem[] };

// Cada runtime de npm se instala desde su carpeta con lockfile propio (go/cmd/n-ein-install/runtime.go).
export const LOCKS: Partial<Record<Name, { dir: string; pkg: string }>> = {
  pi: { dir: "pi-runtime", pkg: "@earendil-works/pi-coding-agent" },
  claudeBridge: { dir: "claude-bridge-runtime", pkg: "pi-claude-bridge" },
  claude: { dir: "claude-runtime", pkg: "@anthropic-ai/claude-code" },
};

const log = (line: string): void => void process.stderr.write(`${line}\n`);

export function readPins(source: string, text = readFileSync(join(source, "runtime.json"), "utf8")): Pins {
  const config = JSON.parse(text);
  const pins: Pins = {
    pi: config.pi?.version ?? "",
    claudeBridge: config.claudeBridge?.version ?? "",
    claude: config.claude?.version ?? "",
    codegraph: { version: config.codegraph?.version ?? "", sha256: config.codegraph?.sha256 ?? {} },
  };
  return pins;
}

// -----------------------------------------------------------------------------
// [DATA] Registro: npm y releases de GitHub
// -----------------------------------------------------------------------------

async function getJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { "User-Agent": "n-ein-runtimes" };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token && url.startsWith("https://api.github.com/")) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function getText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

const npm = (): string => (process.env.N_EIN_NPM_REGISTRY || "https://registry.npmjs.org").replace(/\/$/, "");

export async function fetchRegistry(): Promise<Registry> {
  const codegraph = (process.env.N_EIN_CODEGRAPH_API || "https://api.github.com/repos/colbymchenry/codegraph").replace(/\/$/, "");
  const [pi, claudeBridge, claude, releases] = await Promise.all([
    getJson<Registry["pi"]>(`${npm()}/${LOCKS.pi!.pkg}`),
    getJson<Registry["claudeBridge"]>(`${npm()}/${LOCKS.claudeBridge!.pkg}`),
    getJson<Registry["claude"]>(`${npm()}/${LOCKS.claude!.pkg}`),
    getJson<Registry["codegraph"]>(`${codegraph}/releases?per_page=30`),
  ]);
  return { pi, claudeBridge, claude, codegraph: releases };
}

// -----------------------------------------------------------------------------
// [AUTH] Código del puente: tarball de npm extraído en una carpeta propia y leído como texto
// -----------------------------------------------------------------------------

async function packageFiles(registry: Registry, version: string): Promise<Record<string, string>> {
  const tarball = registry.claudeBridge.versions[version]?.dist?.tarball;
  if (!tarball) throw new Error(`puente ${version} sin tarball en npm`);
  const area = mkdtempSync(join(tmpdir(), "n-ein-bridge-"));
  try {
    const response = await fetch(tarball, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`${tarball}: HTTP ${response.status}`);
    writeFileSync(join(area, "package.tgz"), new Uint8Array(await response.arrayBuffer()));
    const tree = join(area, "tree");
    mkdirSync(tree);
    const untar = spawnSync("tar", ["-xzf", join(area, "package.tgz"), "-C", tree], { encoding: "utf8" });
    if (untar.status !== 0) throw new Error(`tar: ${untar.stderr.trim()}`);
    const files: Record<string, string> = {};
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile() && statSync(path).size < 2_000_000) files[relative(tree, path)] = readFileSync(path, "utf8");
      }
    };
    walk(tree);
    return files;
  } finally {
    rmSync(area, { recursive: true, force: true });
  }
}

// -----------------------------------------------------------------------------
// [FLOW] plan
// -----------------------------------------------------------------------------

export async function plan(source: string, options: { quarantineDays: number; state: State; now?: Date; registry?: Registry }): Promise<PlanFile> {
  const base = readPins(source);
  for (const name of ["pi", "claudeBridge", "claude"] as const) {
    if (!base[name]) throw new Error(`runtime.json sin ${LABEL[name]}`);
  }
  if (!base.codegraph.version) throw new Error("runtime.json sin CodeGraph");
  const registry = options.registry ?? (await fetchRegistry());
  const settings = { now: options.now ?? new Date(), quarantineDays: options.quarantineDays, state: options.state };
  let result = resolve(base, registry, settings);
  const held: HeldItem[] = [];
  const bridge = result.changes.find((change) => change.name === "claudeBridge");
  if (bridge && !(options.state.approved.claudeBridge ?? []).includes(bridge.to)) {
    const lines = newNetwork(await packageFiles(registry, bridge.from), await packageFiles(registry, bridge.to));
    if (lines.length > 0) {
      held.push({ name: "claudeBridge", version: bridge.to, reason: "review", lines });
      // Pi sigue adelante con el puente actual, si este lo admite.
      result = resolve(base, registry, { ...settings, hold: ["claudeBridge"] });
    }
  }
  return { base, ...result, held };
}

// -----------------------------------------------------------------------------
// [FLOW] apply
// -----------------------------------------------------------------------------

export type Lock = (dir: string) => void;

// Un lockfile nuevo resuelve también las dependencias transitivas; la matriz las prueba antes de publicar.
export const bunLock: Lock = (dir) => {
  const result = spawnSync("bun", ["install", "--lockfile-only"], { cwd: resolvePath(dir), encoding: "utf8" });
  if (result.status !== 0) throw new Error(`bun install --lockfile-only en ${dir}: ${result.stderr.trim()}`);
};

export function applyPlan(source: string, chosen: Plan, options: { lock: Lock; version?: string; piBreaking?: string[] }): void {
  const base = readPins(source);
  for (const change of chosen.changes) {
    const pinned = change.name === "codegraph" ? base.codegraph.version : base[change.name];
    if (pinned !== change.from) throw new Error(`runtime.json fija ${LABEL[change.name]} ${pinned}; el plan parte de ${change.from}`);
  }
  const runtimePath = join(source, "runtime.json");
  const config = JSON.parse(readFileSync(runtimePath, "utf8"));
  config.pi.version = chosen.pins.pi;
  config.claudeBridge.version = chosen.pins.claudeBridge;
  config.claude.version = chosen.pins.claude;
  config.codegraph = { ...config.codegraph, version: chosen.pins.codegraph.version, sha256: chosen.pins.codegraph.sha256 };
  writeFileSync(runtimePath, JSON.stringify(config, null, 2) + "\n");
  for (const change of chosen.changes) {
    const lock = LOCKS[change.name];
    if (!lock) continue;
    const manifestPath = join(source, lock.dir, "package.json");
    const manifest = readFileSync(manifestPath, "utf8");
    const pinned = `"${lock.pkg}": "${change.from}"`;
    if (manifest.split(pinned).length !== 2) throw new Error(`${lock.dir}/package.json no fija ${pinned}`);
    writeFileSync(manifestPath, manifest.replace(pinned, `"${lock.pkg}": "${change.to}"`));
    rmSync(join(source, lock.dir, "bun.lock"), { force: true });
    options.lock(join(source, lock.dir));
  }
  if (options.version) {
    writeFileSync(join(source, "VERSION"), options.version + "\n");
    writeFileSync(join(source, "docs", "releases", `${options.version}.md`), releaseNotes(options.version, chosen.changes, options.piBreaking ?? []));
  }
}

export async function piBreaking(changes: Change[]): Promise<string[]> {
  const pi = changes.find((change) => change.name === "pi");
  if (!pi) return [];
  const base = (process.env.N_EIN_CHANGELOG_BASE || "https://cdn.jsdelivr.net/npm").replace(/\/$/, "");
  const changelog = await getText(`${base}/${LOCKS.pi!.pkg}@${pi.to}/CHANGELOG.md`);
  if (changelog === null) log(`[RUNTIME] :: NOTES_PARTIAL :: reason: changelog de Pi ${pi.to} no disponible`);
  return changelog ? breakingChanges(changelog, pi.from, pi.to) : [];
}

// -----------------------------------------------------------------------------
// [FLOW] next-version y guard: leen los tags del repositorio
// -----------------------------------------------------------------------------

function git(source: string, ...args: string[]): string {
  const result = spawnSync("git", ["-C", source, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const tagVersions = (source: string): string[] =>
  git(source, "tag", "-l", "v*").split("\n").map((tag) => tag.slice(1)).filter((version) => SEMVER.test(version));

export function freshVersion(source: string): string {
  const taken = new Set(tagVersions(source));
  let version = nextVersion(readFileSync(join(source, "VERSION"), "utf8").trim());
  while (taken.has(version)) version = nextVersion(version);
  return version;
}

/** Tag inmediatamente anterior en orden SemVer a la versión del árbol. */
export function previousTag(source: string): string | null {
  const current = readFileSync(join(source, "VERSION"), "utf8").trim();
  const older = tagVersions(source).filter((version) => newer(current, version));
  older.sort((a, b) => Bun.semver.order(b, a));
  return older[0] ? `v${older[0]}` : null;
}

export function guard(source: string, previous: string | null = previousTag(source)): string[] {
  if (!previous) return [];
  return downgrades(readPins(source, git(source, "show", `${previous}:runtime.json`)), readPins(source));
}

// -----------------------------------------------------------------------------
// [FLOW] base e issue: piezas del vigía de CI
// -----------------------------------------------------------------------------

export type PublishedRelease = { tagName: string; isPrerelease: boolean; isDraft?: boolean };

/** Último tag publicado del canal: de ahí parte la versión de mantenimiento. */
export function baseTag(releases: PublishedRelease[], channel: "preview" | "stable"): string | null {
  const versions = releases
    .filter((release) => !release.isDraft && release.tagName.startsWith("v") && SEMVER.test(release.tagName.slice(1)))
    .filter((release) => release.isPrerelease === (channel === "preview") && release.tagName.includes("-") === (channel === "preview"))
    .map((release) => release.tagName.slice(1))
    .sort((a, b) => Bun.semver.order(b, a));
  return versions[0] ? `v${versions[0]}` : null;
}

export type IssueDraft = { title: string; body: string };

/** Issues que deja el vigía: bloqueo de grupos que rompen n_ein y revisión de un puente con red nueva. */
export function issueDrafts(planned: PlanFile, kind: "blocked" | "review", groups: readonly Group[], run: string): IssueDraft[] {
  if (kind === "review") {
    return planned.held.map((item) => ({
      title: `runtimes: revisar ${LABEL[item.name]} ${item.version} (red nueva)`,
      body: [
        `El vigía retuvo ${LABEL[item.name]} ${item.version}: su código trae llamadas de red que ${planned.base[item.name as "claudeBridge"]} no tenía.`,
        "",
        "```text",
        ...item.lines.slice(0, 60),
        "```",
        "",
        "Ciérralo como **completado** para aprobar la versión, o como **no planificado** para descartarla. Mientras siga abierto, el vigía no la usa.",
        "",
        `Ejecución: ${run}`,
        "",
        markerText({ kind: "review", versions: { [item.name]: item.version } }),
      ].join("\n"),
    }));
  }
  const changes = planned.changes.filter((change) => groups.includes(change.group));
  if (changes.length === 0) return [];
  const versions = Object.fromEntries(changes.map((change) => [change.name, change.to]));
  return [{
    title: `runtimes: ${changes.map((change) => `${LABEL[change.name]} ${change.to}`).join(", ")} rompe n_ein`,
    body: [
      "La matriz de n_ein falla con estas versiones, así que el vigía no las publica:",
      "",
      ...changes.map((change) => `- ${LABEL[change.name]}: ${change.from} → ${change.to}`),
      "",
      `Log: ${run}`,
      "",
      "Para adaptarlo, pídele a Ein en el repositorio «arregla la compatibilidad con estas versiones» y publica la versión normal. Cerrar este issue desbloquea estas versiones para el vigía; una versión más nueva se prueba igualmente.",
      "",
      markerText({ kind: "blocked", versions }),
    ].join("\n"),
  }];
}

// -----------------------------------------------------------------------------
// [FLOW] CLI
// -----------------------------------------------------------------------------

function flag(args: string[], name: string, fallback?: string): string {
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] !== undefined) return args[index + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`falta --${name}`);
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  const source = flag(args, "source", ".");
  switch (command) {
    case "plan": {
      const statePath = flag(args, "state", "");
      const state = statePath ? (JSON.parse(readFileSync(statePath, "utf8")) as State) : EMPTY_STATE;
      const result = await plan(source, { quarantineDays: Number(flag(args, "quarantine-days", "3")), state });
      for (const change of result.changes) log(`[RUNTIME] :: CHANGE :: ${LABEL[change.name]}: ${change.from} → ${change.to}`);
      for (const item of result.held) log(`[RUNTIME] :: HELD :: ${LABEL[item.name]}: ${item.version} | reason: red nueva en ${item.lines.length} líneas`);
      if (result.changes.length === 0) log("[RUNTIME] :: UP_TO_DATE :: sin versiones nuevas que probar");
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return;
    }
    case "apply": {
      const planned = JSON.parse(readFileSync(flag(args, "plan"), "utf8")) as PlanFile;
      const groups = flag(args, "groups", "pi,claude,codegraph").split(",").filter(Boolean) as Group[];
      const chosen = restrict(readPins(source), planned, groups);
      if (chosen.changes.length === 0) throw new Error("el plan no cambia nada en esos grupos");
      const version = flag(args, "version", "") || undefined;
      applyPlan(source, chosen, { lock: bunLock, version, piBreaking: version ? await piBreaking(chosen.changes) : [] });
      process.stdout.write(commitSubject(chosen.changes) + "\n");
      return;
    }
    case "next-version":
      process.stdout.write(freshVersion(source) + "\n");
      return;
    case "guard": {
      const previous = flag(args, "previous", "") || previousTag(source);
      const found = guard(source, previous);
      if (found.length > 0) {
        log(`[ERR] :: RUNTIME_DOWNGRADE :: previous: ${previous} | changes: ${found.join(", ")} | fix: integra en main la PR de runtimes antes de publicar`);
        process.exitCode = 1;
        return;
      }
      log(`[RUNTIME] ++ GUARD_OK :: previous: ${previous ?? "ninguna"}`);
      return;
    }
    case "base": {
      const releases = JSON.parse(await Bun.stdin.text()) as PublishedRelease[];
      const tag = baseTag(releases, flag(args, "channel", "preview") === "stable" ? "stable" : "preview");
      if (!tag) throw new Error("no hay release publicada en el canal");
      process.stdout.write(tag + "\n");
      return;
    }
    case "issues": {
      const planned = JSON.parse(readFileSync(flag(args, "plan"), "utf8")) as PlanFile;
      const kind = flag(args, "kind") === "review" ? "review" : "blocked";
      const groups = flag(args, "groups", "pi,claude,codegraph").split(",").filter(Boolean) as Group[];
      process.stdout.write(JSON.stringify(issueDrafts(planned, kind, groups, flag(args, "run", "")), null, 2) + "\n");
      return;
    }
    case "groups": {
      const planned = JSON.parse(readFileSync(flag(args, "plan"), "utf8")) as PlanFile;
      process.stdout.write([...new Set(planned.changes.map((change) => change.group))].join(",") + "\n");
      return;
    }
    case "state": {
      const issues = JSON.parse(await Bun.stdin.text()) as Issue[];
      process.stdout.write(JSON.stringify(stateFromIssues(issues), null, 2) + "\n");
      return;
    }
    default:
      throw new Error("uso: cli.ts plan|apply|next-version|guard|base|issues|groups|state [--source DIR] ...");
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    log(`[ERR] :: RUNTIMES_FAIL :: reason: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

