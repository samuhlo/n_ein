import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import {
  EMPTY_STATE, breakingChanges, downgrades, markerText, newNetwork, nextVersion, releaseNotes, resolve, restrict, stateFromIssues,
  type GithubRelease, type Packument, type Pins, type Registry,
} from "../scripts/runtimes/resolve.ts";
import { applyPlan, freshVersion, guard, plan, previousTag, readPins } from "../scripts/runtimes/cli.ts";

const root = resolvePath(import.meta.dir, "..");
const temp = mkdtempSync(join(tmpdir(), "n-ein-runtimes-"));
const NOW = new Date("2026-11-19T12:00:00Z");
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const sha = (char: string): string => char.repeat(64);

function packument(versions: Record<string, { days: number; peer?: Record<string, string>; deprecated?: string }>, tags: Record<string, string> = {}): Packument {
  const names = Object.keys(versions);
  return {
    "dist-tags": { latest: names[names.length - 1], ...tags },
    versions: Object.fromEntries(names.map((v) => [v, { peerDependencies: versions[v].peer, deprecated: versions[v].deprecated, dist: { tarball: `http://registry.invalid/${v}.tgz` } }])),
    time: Object.fromEntries(names.map((v) => [v, daysAgo(versions[v].days)])),
  };
}
const codegraphRelease = (version: string, days: number, complete = true): GithubRelease => ({
  tag_name: `v${version}`, draft: false, prerelease: false, published_at: daysAgo(days),
  assets: [
    { name: "codegraph-darwin-arm64.tar.gz", digest: `sha256:${sha("a")}` },
    ...(complete ? [{ name: "codegraph-linux-x64.tar.gz", digest: `sha256:${sha("b")}` }] : []),
  ],
});

const current: Pins = { pi: "1.0.2", claudeBridge: "0.9.3", claude: "2.1.302", codegraph: { version: "1.6.1", sha256: { "darwin-arm64": sha("1"), "linux-amd64": sha("2") } } };
const registry: Registry = {
  pi: packument({ "1.0.2": { days: 40 }, "1.4.0": { days: 20 }, "1.5.1": { days: 9 }, "1.5.2": { days: 8 }, "1.5.3": { days: 1 } }),
  claudeBridge: packument({
    "0.9.3": { days: 30, peer: { "@earendil-works/pi-coding-agent": ">=0.86.1" } },
    "0.12.0": { days: 9, peer: { "@earendil-works/pi-coding-agent": ">=1.4.0" } },
    "0.13.0": { days: 3, peer: { "@earendil-works/pi-coding-agent": ">=1.5.1", "@earendil-works/pi-ai": ">=1.5.1" } },
    "0.14.0": { days: 0, peer: { "@earendil-works/pi-coding-agent": ">=1.6.0" } },
  }),
  claude: packument({ "2.1.302": { days: 20 }, "2.1.311": { days: 8 }, "2.1.328": { days: 1 } }, { stable: "2.1.311" }),
  codegraph: [codegraphRelease("1.6.4", 1), codegraphRelease("1.6.3", 4), codegraphRelease("1.6.2", 10, false)],
};
const options = { now: NOW, quarantineDays: 3, state: EMPTY_STATE };

try {
  // [CORE] Selección
  const full = resolve(current, registry, options);
  assert.equal(full.pins.pi, "1.5.2", "Pi más nuevo fuera de la cuarentena; 1.5.3 aún espera");
  assert.equal(full.pins.claudeBridge, "0.13.0", "el puente más nuevo que admite ese Pi");
  assert.equal(full.pins.claude, "2.1.311", "Claude Code sigue la etiqueta stable, no latest");
  assert.deepEqual(full.pins.codegraph, { version: "1.6.3", sha256: { "darwin-arm64": sha("a"), "linux-amd64": sha("b") } }, "CodeGraph con el SHA que publica GitHub");
  assert.deepEqual(full.changes.map((c) => `${c.name}:${c.from}>${c.to}`), ["pi:1.0.2>1.5.2", "claudeBridge:0.9.3>0.13.0", "claude:2.1.302>2.1.311", "codegraph:1.6.1>1.6.3"]);

  const held = resolve(current, registry, { ...options, hold: ["claudeBridge"] });
  assert.equal(held.pins.claudeBridge, "0.9.3", "un puente retenido no cambia");
  assert.equal(held.pins.pi, "1.5.2", "Pi avanza si el puente actual lo admite");

  const narrow = { ...registry, claudeBridge: packument({ "0.9.3": { days: 30, peer: { "@earendil-works/pi-coding-agent": ">=0.86.1 <1.4.0" } }, "0.12.0": { days: 9, peer: { "@earendil-works/pi-coding-agent": "<1.5.0" } } }) };
  const coupled = resolve(current, narrow, options);
  assert.deepEqual([coupled.pins.pi, coupled.pins.claudeBridge], ["1.4.0", "0.12.0"], "Pi baja hasta el que admite algún puente, sin bajar de la versión actual");
  const stuck = resolve(current, { ...registry, claudeBridge: packument({ "0.9.3": { days: 30, peer: { "@earendil-works/pi-coding-agent": "<1.0.3" } } }) }, options);
  assert.equal(stuck.pins.pi, "1.0.2", "sin puente compatible, Pi se queda donde está");

  const blocked = resolve(current, registry, { ...options, state: { blocked: { pi: ["1.5.2"], claude: ["2.1.311"], codegraph: ["1.6.3"] }, approved: {} } });
  assert.equal(blocked.pins.pi, "1.5.1", "una versión bloqueada se salta y se prueba la anterior");
  assert.equal(blocked.pins.claude, "2.1.302", "Claude bloqueado no cae a versiones intermedias");
  assert.equal(blocked.pins.codegraph.version, "1.6.1", "CodeGraph sin SHA de todas las plataformas no se fija");

  const deprecated = resolve(current, { ...registry, pi: packument({ "1.0.2": { days: 40 }, "1.5.2": { days: 8, deprecated: "broken" } }) }, options);
  assert.equal(deprecated.pins.pi, "1.0.2", "una versión retirada en npm no se prueba");
  const ahead = resolve({ ...current, claude: "2.1.320" }, registry, options);
  assert.equal(ahead.pins.claude, "2.1.320", "nunca se baja de versión");

  const onlyClaude = restrict(current, full, ["claude"]);
  assert.deepEqual([onlyClaude.pins.pi, onlyClaude.pins.claude, onlyClaude.changes.length], ["1.0.2", "2.1.311", 1], "un grupo solo lleva sus runtimes");

  // [CORE] Versiones y guarda
  assert.equal(nextVersion("0.6.0-alpha.1"), "0.6.0-alpha.2");
  assert.equal(nextVersion("0.6.0"), "0.6.1");
  assert.equal(nextVersion("0.1.0-preview.1.hotfix.1"), "0.1.0-preview.1.hotfix.2");
  assert.throws(() => nextVersion("0.6.0-alpha"), /número final/);
  assert.deepEqual(downgrades(full.pins, current), ["Pi 1.5.2 → 1.0.2", "puente de Claude 0.13.0 → 0.9.3", "Claude Code 2.1.311 → 2.1.302", "CodeGraph 1.6.3 → 1.6.1"]);
  assert.deepEqual(downgrades(current, full.pins), [], "subir no es bajar");

  // [DATA] Memoria en issues
  const state = stateFromIssues([
    { state: "OPEN", body: `Rompe.\n${markerText({ kind: "blocked", versions: { pi: "1.6.0", claudeBridge: "0.14.0" } })}` },
    { state: "CLOSED", stateReason: "COMPLETED", body: markerText({ kind: "blocked", versions: { claude: "2.1.320" } }) },
    { state: "OPEN", body: markerText({ kind: "review", versions: { claudeBridge: "0.15.0" } }) },
    { state: "CLOSED", stateReason: "COMPLETED", body: markerText({ kind: "review", versions: { claudeBridge: "0.13.0" } }) },
    { state: "CLOSED", stateReason: "NOT_PLANNED", body: markerText({ kind: "review", versions: { claudeBridge: "0.12.0" } }) },
    { state: "OPEN", body: "<!-- n_ein-runtimes {roto} -->" },
  ]);
  assert.deepEqual(state.blocked, { pi: ["1.6.0"], claudeBridge: ["0.14.0", "0.15.0", "0.12.0"] }, "abierto bloquea; revisión pendiente o descartada también");
  assert.deepEqual(state.approved, { claudeBridge: ["0.13.0"] }, "revisión completada aprueba");

  // [AUTH] Red nueva en el puente
  const before = { "package/src/index.ts": "import x from 'y';\nconst docs = 'https://example.com/old';\n", "package/README.md": "https://docs" };
  const after = { ...before, "package/src/index.ts": before["package/src/index.ts"] + "await fetch(url);\n", "package/README.md": "https://other-docs" };
  assert.deepEqual(newNetwork(before, after), ["package/src/index.ts: await fetch(url);"], "solo cuentan las líneas de código con red nuevas");
  assert.deepEqual(newNetwork(before, before), []);

  // [DATA] Notas
  const changelog = "# Changelog\n\n## [1.5.2] - x\n\n### Fixed\n\n- nada\n\n## [1.5.0] - x\n\n### Breaking Changes\n\n- Tool argument validation runs on pi-schema. More text here.\n\n### Added\n\n- algo\n\n## [1.2.0] - x\n\n### Breaking Changes\n\n- Changed `before_agent_start` to fire more.\n\n## [1.0.2] - x\n\n### Breaking Changes\n\n- Antigua.\n";
  assert.deepEqual(breakingChanges(changelog, "1.0.2", "1.5.2"), ["1.5.0: Tool argument validation runs on pi-schema.", "1.2.0: Changed `before_agent_start` to fire more."]);
  const notes = releaseNotes("0.6.0-alpha.2", full.changes, ["1.5.0: x."]);
  assert.match(notes, /^# n_ein 0\.6\.0-alpha\.2/);
  assert.match(notes, /canal \*\*preview\*\*/);
  assert.match(notes, /- Pi: 1\.0\.2 → 1\.5\.2/);
  assert.match(notes, /volver a la versión anterior/);

  // [FLOW] apply sobre una copia de los archivos reales
  const tree = join(temp, "tree");
  for (const path of ["runtime.json", "VERSION", "pi-runtime/package.json", "claude-runtime/package.json", "claude-bridge-runtime/package.json"]) {
    mkdirSync(join(tree, path, ".."), { recursive: true });
    cpSync(join(root, path), join(tree, path));
  }
  mkdirSync(join(tree, "docs", "releases"), { recursive: true });
  const base = readPins(tree);
  const target = resolve(base, registry, options);
  const locked: string[] = [];
  applyPlan(tree, target, { version: "9.9.9-alpha.2", piBreaking: [], lock: (dir) => { locked.push(dir.slice(tree.length + 1)); writeFileSync(join(dir, "bun.lock"), "fake\n"); } });
  const written = readPins(tree);
  assert.equal(written.pi, target.pins.pi);
  assert.equal(written.claude, target.pins.claude);
  assert.deepEqual(written.codegraph, target.pins.codegraph);
  const runtime = JSON.parse(readFileSync(join(tree, "runtime.json"), "utf8"));
  assert.deepEqual(runtime.routing, JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).routing, "el resto de runtime.json no cambia");
  assert.deepEqual(locked.sort(), ["claude-bridge-runtime", "claude-runtime", "pi-runtime"], "un lockfile nuevo por runtime de npm cambiado");
  const claudeManifest = readFileSync(join(tree, "claude-runtime/package.json"), "utf8");
  assert.match(claudeManifest, /"@anthropic-ai\/claude-code": "2\.1\.311"/);
  assert.match(claudeManifest, /"trustedDependencies": \["@anthropic-ai\/claude-code"\]/, "el manifiesto conserva su forma");
  assert.equal(readFileSync(join(tree, "VERSION"), "utf8"), "9.9.9-alpha.2\n");
  assert.match(readFileSync(join(tree, "docs/releases/9.9.9-alpha.2.md"), "utf8"), /CodeGraph: 1\.6\.1 → 1\.6\.3/);
  assert.throws(() => applyPlan(tree, target, { lock: () => {} }), /el plan parte de 1\.0\.2/, "un plan que no parte de lo fijado se rechaza");

  // [FLOW] Tags: siguiente versión y guarda contra bajadas
  const repo = join(temp, "repo");
  mkdirSync(repo);
  const run = (...args: string[]): void => {
    const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  run("init", "-q");
  run("config", "user.email", "test@n-ein.invalid");
  run("config", "user.name", "test");
  run("config", "commit.gpgsign", "false");
  const commit = (version: string, pins: Pins, tag: boolean): void => {
    writeFileSync(join(repo, "VERSION"), version + "\n");
    writeFileSync(join(repo, "runtime.json"), JSON.stringify({ schema: 1, pi: { version: pins.pi }, claudeBridge: { version: pins.claudeBridge }, claude: { version: pins.claude }, codegraph: pins.codegraph }, null, 2) + "\n");
    run("add", ".");
    run("commit", "-qm", version);
    if (tag) run("tag", `v${version}`);
  };
  commit("0.6.0-alpha.1", current, true);
  commit("0.6.0-alpha.2", full.pins, true);
  assert.equal(freshVersion(repo), "0.6.0-alpha.3");
  commit("0.6.0-alpha.3", current, false);
  assert.equal(previousTag(repo), "v0.6.0-alpha.2", "la anterior en orden SemVer");
  assert.equal(guard(repo).length, 4, "una release desde main sin la PR de runtimes bajaría todo");
  commit("0.6.0-alpha.3", full.pins, false);
  assert.deepEqual(guard(repo), []);
  run("tag", "v0.6.0-alpha.4");
  writeFileSync(join(repo, "VERSION"), "0.6.0-alpha.3\n");
  assert.equal(freshVersion(repo), "0.6.0-alpha.5", "salta los tags ya usados");

  // [FLOW] plan con revisión del puente contra tarballs servidos localmente
  const packages = join(temp, "packages");
  const tarball = (version: string, code: string): string => {
    const dir = join(packages, version, "package", "src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.ts"), code);
    const file = join(packages, `${version}.tgz`);
    assert.equal(spawnSync("tar", ["-czf", file, "-C", join(packages, version), "package"]).status, 0);
    return file;
  };
  const files: Record<string, string> = { "0.9.3": tarball("0.9.3", "export const a = 1;\n"), "0.13.0": tarball("0.13.0", "export const a = 1;\nawait fetch('https://telemetry.invalid');\n") };
  const server = Bun.serve({ port: 0, fetch: (request) => {
    const version = new URL(request.url).pathname.slice(1).replace(/\.tgz$/, "");
    return files[version] ? new Response(Bun.file(files[version])) : new Response("no", { status: 404 });
  } });
  try {
    const served: Registry = JSON.parse(JSON.stringify(registry).replaceAll("http://registry.invalid", `http://localhost:${server.port}`));
    const planTree = join(temp, "plan");
    mkdirSync(planTree);
    cpSync(join(root, "runtime.json"), join(planTree, "runtime.json"));
    const pinsNow = readPins(planTree);
    const reviewed = await plan(planTree, { quarantineDays: 3, state: EMPTY_STATE, now: NOW, registry: { ...served, pi: packument({ [pinsNow.pi]: { days: 40 }, "1.5.2": { days: 8 } }) } });
    assert.equal(reviewed.held.length, 1, "un puente con red nueva queda retenido");
    assert.equal(reviewed.held[0].version, "0.13.0");
    assert.match(reviewed.held[0].lines[0], /telemetry\.invalid/);
    assert.equal(reviewed.pins.claudeBridge, pinsNow.claudeBridge, "el plan sigue con el puente actual");
    const approved = await plan(planTree, { quarantineDays: 3, state: { blocked: {}, approved: { claudeBridge: ["0.13.0"] } }, now: NOW, registry: { ...served, pi: packument({ [pinsNow.pi]: { days: 40 }, "1.5.2": { days: 8 } }) } });
    assert.equal(approved.pins.claudeBridge, "0.13.0", "una revisión aprobada deja pasar el puente");
    assert.equal(approved.held.length, 0);
  } finally {
    server.stop(true);
  }

  console.log("runtimes: OK");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
