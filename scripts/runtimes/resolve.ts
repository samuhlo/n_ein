// =============================================================================
// [DATA] SELECCIÓN DE RUNTIMES
// Decide qué versiones de Pi, el puente de Claude, Claude Code y CodeGraph puede
// probar n_ein. Funciones puras: la red y los archivos viven en cli.ts.
// =============================================================================

export type Name = "pi" | "claudeBridge" | "claude" | "codegraph";
export type Group = "pi" | "claude" | "codegraph";
export const NAMES: readonly Name[] = ["pi", "claudeBridge", "claude", "codegraph"];
// Pi y el puente van juntos: el peer del puente decide qué Pi admite.
export const GROUP: Record<Name, Group> = { pi: "pi", claudeBridge: "pi", claude: "claude", codegraph: "codegraph" };
export const LABEL: Record<Name, string> = { pi: "Pi", claudeBridge: "puente de Claude", claude: "Claude Code", codegraph: "CodeGraph" };

export type CodeGraphPin = { version: string; sha256: Record<string, string> };
export type Pins = { pi: string; claudeBridge: string; claude: string; codegraph: CodeGraphPin };

export type Packument = {
  "dist-tags": Record<string, string>;
  versions: Record<string, { peerDependencies?: Record<string, string>; deprecated?: string; dist?: { tarball?: string } }>;
  time: Record<string, string>;
};
export type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: { name: string; digest?: string | null }[];
};
export type Registry = { pi: Packument; claudeBridge: Packument; claude: Packument; codegraph: GithubRelease[] };

// blocked: versiones que rompieron n_ein o esperan revisión. approved: revisadas a mano.
export type State = { blocked: Partial<Record<Name, string[]>>; approved: Partial<Record<Name, string[]>> };
export const EMPTY_STATE: State = { blocked: {}, approved: {} };
export type Options = { now: Date; quarantineDays: number; state: State; hold?: readonly Name[] };
export type Change = { name: Name; group: Group; from: string; to: string };
export type Plan = { pins: Pins; changes: Change[] };

const STABLE = /^\d+\.\d+\.\d+$/;
const DAY = 24 * 60 * 60 * 1000;
const PI_PEERS = ["@earendil-works/pi-coding-agent", "@earendil-works/pi-ai", "@earendil-works/pi-tui"];
// Nombres de los assets de CodeGraph por plataforma de n_ein (go/cmd/n-ein-install/codegraph.go).
export const CODEGRAPH_ASSETS: Record<string, string> = {
  "darwin-arm64": "codegraph-darwin-arm64.tar.gz",
  "linux-amd64": "codegraph-linux-x64.tar.gz",
};

export const newer = (a: string, b: string): boolean => Bun.semver.order(a, b) > 0;
const descending = (a: string, b: string): number => Bun.semver.order(b, a);

/** Versiones que se pueden probar, de la más nueva a la actual; la actual siempre está. */
export function eligible(pack: Packument, current: string, name: Name, options: Options): string[] {
  const latest = pack["dist-tags"].latest ?? current;
  const blocked = new Set(options.state.blocked[name] ?? []);
  const limit = options.now.getTime() - options.quarantineDays * DAY;
  const found = Object.entries(pack.versions)
    .filter(([version, meta]) => STABLE.test(version) && newer(version, current) && !newer(version, latest)
      && !meta.deprecated && !blocked.has(version)
      && pack.time[version] !== undefined && Date.parse(pack.time[version]) <= limit)
    .map(([version]) => version)
    .sort(descending);
  return [...found, current];
}

export function admitsPi(pack: Packument, bridge: string, pi: string): boolean {
  const peers = pack.versions[bridge]?.peerDependencies ?? {};
  return PI_PEERS.every((peer) => peers[peer] === undefined || Bun.semver.satisfies(pi, peers[peer]));
}

function pickPi(current: Pins, registry: Registry, options: Options): { pi: string; claudeBridge: string } {
  const held = new Set(options.hold ?? []);
  const pis = held.has("pi") ? [current.pi] : eligible(registry.pi, current.pi, "pi", options);
  const bridges = held.has("claudeBridge") ? [current.claudeBridge] : eligible(registry.claudeBridge, current.claudeBridge, "claudeBridge", options);
  // El primer Pi, de más nuevo a más viejo, que admita algún puente; el actual con el suyo siempre vale.
  for (const pi of pis) {
    const bridge = bridges.find((candidate) => admitsPi(registry.claudeBridge, candidate, pi));
    if (bridge) return { pi, claudeBridge: bridge };
  }
  return { pi: current.pi, claudeBridge: current.claudeBridge };
}

// Claude Code publica casi a diario; su etiqueta stable ya va con retraso y hace de cuarentena.
function pickClaude(current: string, pack: Packument, options: Options): string {
  const stable = pack["dist-tags"].stable;
  if (!stable || !STABLE.test(stable) || !newer(stable, current) || (options.hold ?? []).includes("claude")) return current;
  return (options.state.blocked.claude ?? []).includes(stable) ? current : stable;
}

function pickCodeGraph(current: CodeGraphPin, releases: GithubRelease[], options: Options): CodeGraphPin {
  if ((options.hold ?? []).includes("codegraph")) return current;
  const blocked = new Set(options.state.blocked.codegraph ?? []);
  const limit = options.now.getTime() - options.quarantineDays * DAY;
  let best = current;
  for (const release of releases) {
    const version = release.tag_name.replace(/^v/, "");
    if (release.draft || release.prerelease || !STABLE.test(version) || !newer(version, best.version) || blocked.has(version)) continue;
    if (!release.published_at || Date.parse(release.published_at) > limit) continue;
    const sha256: Record<string, string> = {};
    for (const [platform, asset] of Object.entries(CODEGRAPH_ASSETS)) {
      const digest = release.assets.find((item) => item.name === asset)?.digest ?? "";
      if (/^sha256:[0-9a-f]{64}$/.test(digest)) sha256[platform] = digest.slice("sha256:".length);
    }
    // Sin el SHA de cada plataforma no hay forma de fijarla.
    if (Object.keys(sha256).length === Object.keys(CODEGRAPH_ASSETS).length) best = { version, sha256 };
  }
  return best;
}

export function resolve(current: Pins, registry: Registry, options: Options): Plan {
  const pins: Pins = {
    ...pickPi(current, registry, options),
    claude: pickClaude(current.claude, registry.claude, options),
    codegraph: pickCodeGraph(current.codegraph, registry.codegraph, options),
  };
  const changes: Change[] = [];
  for (const name of NAMES) {
    const from = name === "codegraph" ? current.codegraph.version : current[name];
    const to = name === "codegraph" ? pins.codegraph.version : pins[name];
    if (from !== to) changes.push({ name, group: GROUP[name], from, to });
  }
  return { pins, changes };
}

/** Pins con solo los grupos elegidos: el resto conserva la versión actual. */
export function restrict(current: Pins, plan: Plan, groups: readonly Group[]): Plan {
  const keep = (name: Name): boolean => groups.includes(GROUP[name]);
  return {
    pins: {
      pi: keep("pi") ? plan.pins.pi : current.pi,
      claudeBridge: keep("claudeBridge") ? plan.pins.claudeBridge : current.claudeBridge,
      claude: keep("claude") ? plan.pins.claude : current.claude,
      codegraph: keep("codegraph") ? plan.pins.codegraph : current.codegraph,
    },
    changes: plan.changes.filter((change) => keep(change.name)),
  };
}

/** Siguiente versión de mantenimiento: el último número de la prerelease, o el patch en estable. */
export function nextVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version);
  if (!match) throw new Error(`versión inválida: ${version}`);
  const [, major, minor, patch, pre] = match;
  if (!pre) return `${major}.${minor}.${Number(patch) + 1}`;
  const parts = pre.split(".");
  const last = parts.length - 1;
  if (!/^\d+$/.test(parts[last])) throw new Error(`prerelease sin número final: ${version}`);
  parts[last] = String(Number(parts[last]) + 1);
  return `${major}.${minor}.${patch}-${parts.join(".")}`;
}

/** Runtimes que bajarían de versión respecto a la release anterior. */
export function downgrades(previous: Pins, current: Pins): string[] {
  return NAMES.flatMap((name) => {
    const before = name === "codegraph" ? previous.codegraph.version : previous[name];
    const after = name === "codegraph" ? current.codegraph.version : current[name];
    return before && after && newer(before, after) ? [`${LABEL[name]} ${before} → ${after}`] : [];
  });
}

// =============================================================================
// [DATA] MEMORIA EN ISSUES
// El vigía anota en el cuerpo de cada issue un marcador con las versiones. Un
// bloqueo dura mientras el issue esté abierto; una revisión cerrada como
// completada aprueba la versión, y cerrada como no planificada la descarta.
// =============================================================================

export type Issue = { state: string; stateReason?: string | null; body: string };
export type Marker = { kind: "blocked" | "review"; versions: Partial<Record<Name, string>> };
const MARKER = /<!-- n_ein-runtimes (\{.*?\}) -->/;

export const markerText = (marker: Marker): string => `<!-- n_ein-runtimes ${JSON.stringify(marker)} -->`;

export function readMarker(body: string): Marker | null {
  const match = MARKER.exec(body);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]) as Marker;
    return (value.kind === "blocked" || value.kind === "review") && value.versions && typeof value.versions === "object" ? value : null;
  } catch {
    return null;
  }
}

export function stateFromIssues(issues: Issue[]): State {
  const state: State = { blocked: {}, approved: {} };
  const add = (into: State["blocked"], versions: Marker["versions"]): void => {
    for (const name of NAMES) {
      const version = versions[name];
      if (version) into[name] = [...(into[name] ?? []), version];
    }
  };
  for (const issue of issues) {
    const marker = readMarker(issue.body);
    if (!marker) continue;
    const open = issue.state.toUpperCase() === "OPEN";
    const completed = (issue.stateReason ?? "").toUpperCase() === "COMPLETED";
    if (marker.kind === "blocked" && open) add(state.blocked, marker.versions);
    if (marker.kind === "review") add(open || !completed ? state.blocked : state.approved, marker.versions);
  }
  return state;
}

// =============================================================================
// [AUTH] REVISIÓN DEL PUENTE
// El puente es de un único autor externo: la revisión de 0.9.3 (sin red propia)
// no se hereda. Una versión con llamadas de red nuevas espera a Samu.
// =============================================================================

const NETWORK = [
  /\bfetch\s*\(/,
  /https?:\/\//,
  /\bnode:(?:http|https|net|tls|dgram)\b/,
  /["'](?:http|https|net|tls|dgram|undici|ws|axios|got|node-fetch)["']/,
  /\b(?:WebSocket|XMLHttpRequest|EventSource)\b/,
];
const CODE = /\.(?:[cm]?[jt]s|tsx|jsx)$/;

/** Líneas de código con red que no estaban en la versión anterior. */
export function newNetwork(before: Record<string, string>, after: Record<string, string>): string[] {
  const lines = (files: Record<string, string>): Map<string, string> => {
    const found = new Map<string, string>();
    for (const [path, text] of Object.entries(files)) {
      if (!CODE.test(path)) continue;
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (line && NETWORK.some((pattern) => pattern.test(line)) && !found.has(line)) found.set(line, `${path}: ${line.slice(0, 160)}`);
      }
    }
    return found;
  };
  const old = lines(before);
  return [...lines(after)].filter(([line]) => !old.has(line)).map(([, shown]) => shown);
}

// =============================================================================
// [DATA] NOTAS DE VERSIÓN
// =============================================================================

/** Sección «Breaking Changes» de cada versión de Pi posterior a `from`, hasta `to`. */
export function breakingChanges(changelog: string, from: string, to: string): string[] {
  const notes: string[] = [];
  const sections = changelog.split(/^## /m).slice(1);
  for (const section of sections) {
    const version = /^\[?(\d+\.\d+\.\d+)\]?/.exec(section)?.[1];
    if (!version || !newer(version, from) || newer(version, to)) continue;
    const block = /^### Breaking Changes\s*\n([\s\S]*?)(?=^### |(?![\s\S]))/m.exec(section)?.[1] ?? "";
    for (const bullet of block.split(/^- /m).slice(1)) {
      const text = bullet.replace(/\s+/g, " ").trim();
      const sentence = /^(.{1,240}?\.)(?:\s|$)/.exec(text)?.[1] ?? text.slice(0, 240);
      if (sentence) notes.push(`${version}: ${sentence}`);
    }
  }
  return notes;
}

export function releaseNotes(version: string, changes: Change[], piBreaking: string[]): string {
  const channel = version.includes("-") ? "preview" : "stable";
  const lines = [
    `# n_ein ${version}`,
    "",
    `Versión de mantenimiento del canal **${channel}**: actualiza los programas base sin cambiar el código de n_ein. La comprobó la matriz completa en macOS y Linux (suite sin modelos, plugin de Claude, instalación limpia, actualización y vuelta atrás) antes de publicarse.`,
    "",
    "## Programas base",
    "",
    ...changes.map((change) => `- ${LABEL[change.name]}: ${change.from} → ${change.to}`),
  ];
  if (piBreaking.length > 0) {
    lines.push("", "## Cambios incompatibles de Pi", "", "Pi los declara para extensiones e integraciones; la suite de n_ein pasó con ellos.", "", ...piBreaking.map((note) => `- ${note}`));
  }
  lines.push(
    "",
    "## Actualizar",
    "",
    "Pulsa `u` en la portada del launcher. Si algo no va bien, Sistema → «volver a la versión anterior» restaura la instalación previa; las sesiones creadas con un Pi más nuevo pueden no abrirse con el anterior.",
    "",
  );
  return lines.join("\n");
}

export function commitSubject(changes: Change[]): string {
  return `build(runtimes): ${changes.map((change) => `${LABEL[change.name]} ${change.to}`).join(", ")}`;
}
