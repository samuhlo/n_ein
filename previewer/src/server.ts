// =============================================================================
// [FLOW] SERVIDOR LOCAL DEL REVISOR
// Una página por sesión en 127.0.0.1 y una API mínima para valorar y elegir.
// Nunca escribe en el repositorio revisado: solo en el almacén del canal.
// Se apaga solo tras un rato sin peticiones.
// =============================================================================

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadLang } from "../../pi-package/lang.ts";
import { channelDir } from "../../pi-package/models.ts";
import { git } from "./git.ts";
import { ReviewStore, VERDICTS, type Verdict } from "./store.ts";
import { usageSummary } from "./usage.ts";
import { ChainStore } from "./chains.ts";
import type { SessionView } from "../web/view.ts";

const WEB = resolve(import.meta.dir, "../web");
const PATCH_LIMIT = 4 << 20;
const IDLE_MS = 2 * 60 * 60_000;
const BODY_LIMIT = 16_384;

export type ServerState = { pid: number; port: number; token: string };
export const statePath = (packageRoot: string): string => join(channelDir(packageRoot), "previewer", "server.json");

/** La identidad se calcula al arrancar, no al responder: un proceso viejo no puede anunciar los archivos recién instalados. */
export function serverBuildId(packageRoot: string): string {
  const manifest = join(packageRoot, "package-manifest.json");
  const hash = createHash("sha256");
  if (existsSync(manifest)) return hash.update(readFileSync(manifest)).digest("hex");
  for (const path of ["VERSION", "previewer/src/server.ts", "previewer/src/open.ts", "previewer/src/store.ts", "previewer/src/chains.ts",
    "previewer/src/probe-result.ts", "previewer/src/usage.ts", "previewer/web/main.ts", "previewer/web/view.ts", "previewer/web/html.ts", "previewer/web/diff.ts",
    "previewer/web/style.css", "pi-package/lang.ts", "brand.json", "pi-package/themes/ein.json"])
    hash.update(path).update(readFileSync(join(packageRoot, path)));
  return hash.digest("hex");
}

type Palette = Record<string, string>;

/** Variables de color desde brand.json y el tema ein: la hoja de estilo no escribe ningún hex. */
function palette(packageRoot: string): string {
  const brand: { colors: Palette } = JSON.parse(readFileSync(join(packageRoot, "brand.json"), "utf8"));
  const theme: { vars: Palette } = JSON.parse(readFileSync(join(packageRoot, "pi-package/themes/ein.json"), "utf8"));
  const vars: Palette = {
    carbon: brand.colors.carbon ?? "", concrete: brand.colors.concrete ?? "", structure: brand.colors.structure ?? "", yellow: brand.colors.yellow ?? "",
    secondary: theme.vars.secondaryText ?? "", dim: theme.vars.dimGray ?? "", dark: theme.vars.darkGray ?? "",
    selected: theme.vars.selectedBg ?? "", green: theme.vars.green ?? "", red: theme.vars.red ?? "",
  };
  const valid = Object.entries(vars).filter(([, value]) => /^#[0-9A-Fa-f]{6}$/.test(value));
  return `:root{${valid.map(([name, value]) => `--${name}:${value}`).join(";")}}`;
}

export async function bundle(): Promise<string> {
  const built = await Bun.build({ entrypoints: [join(WEB, "main.ts")], target: "browser", minify: true });
  const output = built.outputs[0];
  if (!built.success || !output) throw new Error(`la web no compila: ${built.logs.map(String).join("; ")}`);
  return output.text();
}

const PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>p_reviewer</title><link rel="stylesheet" href="/app.css"></head><body><div id="app"><p>…</p></div><script type="module" src="/app.js"></script></body></html>`;

const SECURITY = {
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

const json = (data: unknown, status = 200): Response => Response.json(data, { status, headers: SECURITY });
const fail = (status: number, error: string): Response => json({ error }, status);

export type HandlerOptions = { packageRoot: string; store: ReviewStore; token: string; port: () => number; touch?: () => void };

export async function createHandler(options: HandlerOptions): Promise<(request: Request) => Promise<Response>> {
  const buildId = serverBuildId(options.packageRoot);
  const script = await bundle();
  const css = `${palette(options.packageRoot)}\n${readFileSync(join(WEB, "style.css"), "utf8")}`;
  const expected = Buffer.from(options.token);
  const tokenOk = (request: Request): boolean => {
    const given = Buffer.from(request.headers.get("x-previewer-token") ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  // El escritor puede terminar otro tramo entre consultas: una vista lee un único estado de SQLite.
  const view = (sessionId: string, inspect?: string | null): SessionView | null => options.store.db.transaction((): SessionView | null => {
    const session = options.store.session(sessionId);
    if (!session) return null;
    const runs = options.store.runs(sessionId);
    const run = inspect ? runs.find(item => item.id === inspect && item.status === "done") ?? null
      : runs.filter((item) => item.status === "done").at(-1) ?? null;
    if (inspect && !run) return null;
    const latest = runs.at(-1) ?? null;
    let patch = "";
    if (run) {
      try {
        patch = git(session.repo, "diff", "--no-color", "--no-ext-diff", "-M", run.baseSha, run.headSha);
        // Un diff enorme se corta en el último archivo entero que cabe.
        if (patch.length > PATCH_LIMIT) {
          const cut = patch.lastIndexOf("\ndiff --git ", PATCH_LIMIT);
          patch = patch.slice(0, cut > 0 ? cut : PATCH_LIMIT);
        }
      } catch {
        // Repositorio movido o SHA perdido: la sesión se ve igual, sin diff.
      }
    }
    return {
      session, run, latest: !inspect && latest && latest.id !== run?.id ? latest : null,
      runs: { count: runs.length, ...usageSummary(runs.map(item => item.usage)) },
      findings: options.store.findings(sessionId, inspect ?? undefined), patch, lang: loadLang(options.packageRoot).chat,
      chain: new ChainStore(options.store).view(sessionId), historical: !!inspect,
      reviewLabel: run ? new ChainStore(options.store).location(run.id) : null,
    };
  })();

  async function body(request: Request): Promise<Record<string, unknown> | null> {
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return null;
    const raw = await request.text();
    if (raw.length > BODY_LIMIT) return null;
    try {
      const value: unknown = JSON.parse(raw);
      return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...value } : null;
    } catch {
      return null;
    }
  }

  return async (request) => {
    options.touch?.();
    const url = new URL(request.url);
    const port = options.port();
    // BLINDAJE -> Solo responde a su propio nombre: una página ajena que apunte su dominio a 127.0.0.1 no entra.
    const host = request.headers.get("host");
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return new Response("forbidden", { status: 403 });
    const origin = request.headers.get("origin");
    if (origin && origin !== `http://${host}`) return new Response("forbidden", { status: 403 });

    if (request.method === "GET" && /^\/s\/[\w-]+$/.test(url.pathname)) return new Response(PAGE, { headers: { ...SECURITY, "content-type": "text/html; charset=utf-8" } });
    if (request.method === "GET" && url.pathname === "/app.js") return new Response(script, { headers: { ...SECURITY, "content-type": "text/javascript; charset=utf-8" } });
    if (request.method === "GET" && url.pathname === "/app.css") return new Response(css, { headers: { ...SECURITY, "content-type": "text/css; charset=utf-8" } });
    if (!url.pathname.startsWith("/api/")) return fail(404, "no existe");
    // BLINDAJE -> La API pide su cabecera propia: un formulario o un fetch simple de otra web no la manda.
    if (!tokenOk(request)) return fail(403, "token ausente o incorrecto");

    if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, pid: process.pid, buildId });
    const sessionMatch = /^\/api\/sessions\/([\w-]+)(\/version)?$/.exec(url.pathname);
    if (request.method === "GET" && sessionMatch) {
      const id = sessionMatch[1] ?? "";
      if (sessionMatch[2]) {
        const runs = options.store.runs(id);
        if (!options.store.session(id)) return fail(404, "sesión desconocida");
        const chain = new ChainStore(options.store).view(id);
        return json({ version: `${runs.map((item) => `${item.id}:${item.status}`).join(",")}|${options.store.decisions(id)}|${chain ? JSON.stringify([chain.revisionId, chain.busy, chain.drift]) : ""}` });
      }
      const data = view(id, url.searchParams.get("run"));
      return data ? json(data) : fail(404, "sesión desconocida");
    }
    const action = /^\/api\/findings\/([\w-]+)\/(rate|select)$/.exec(url.pathname);
    if (request.method === "POST" && action) {
      const input = await body(request);
      if (!input) return fail(415, "se espera un objeto JSON");
      const id = action[1] ?? "";
      if (!options.store.finding(id)) return fail(404, "hallazgo desconocido");
      try {
        if (action[2] === "rate") {
          const verdict = VERDICTS.find((item): item is Verdict => item === input.verdict);
          if (!verdict) return fail(400, "valoración desconocida");
          return json(options.store.rate(id, verdict, typeof input.reason === "string" ? input.reason.slice(0, 500) : null));
        }
        if (typeof input.selected !== "boolean") return fail(400, "selected debe ser true o false");
        return json(options.store.select(id, input.selected));
      } catch (error) {
        return fail(409, error instanceof Error ? error.message : String(error));
      }
    }
    return fail(404, "no existe");
  };
}

export type RunningServer = { port: number; token: string; stop: () => void };

export async function startServer(options: { packageRoot: string; store: ReviewStore; port?: number; idleMs?: number; onIdle?: () => void }): Promise<RunningServer> {
  const token = randomBytes(24).toString("hex");
  let last = Date.now();
  let port = 0;
  const handler = await createHandler({ packageRoot: options.packageRoot, store: options.store, token, port: () => port, touch: () => (last = Date.now()) });
  const server = Bun.serve({ hostname: "127.0.0.1", port: options.port ?? 0, fetch: handler });
  port = server.port ?? 0;
  const idle = setInterval(() => {
    if (Date.now() - last < (options.idleMs ?? IDLE_MS)) return;
    clearInterval(idle);
    void server.stop();
    options.onIdle?.();
  }, Math.min(60_000, options.idleMs ?? IDLE_MS));
  return { port, token, stop: () => { clearInterval(idle); void server.stop(true); } };
}

// Proceso del servidor: lo lanza `n-ein-previewer open` en segundo plano.
if (import.meta.main) {
  const packageRoot = resolve(import.meta.dir, "../..");
  const store = ReviewStore.forPackage(packageRoot);
  const path = statePath(packageRoot);
  const release = (): void => {
    try {
      const state: ServerState = JSON.parse(readFileSync(path, "utf8"));
      if (state.pid === process.pid) rmSync(path, { force: true });
    } catch {
      // Ya no está.
    }
  };
  const running = await startServer({
    packageRoot, store,
    onIdle: () => {
      process.stderr.write(`[WEB] :: SERVE_IDLE :: pid: ${process.pid}\n`);
      release();
      process.exit(0);
    },
  });
  const state: ServerState = { pid: process.pid, port: running.port, token: running.token };
  writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
  process.stderr.write(`[WEB] >> SERVE_START :: port: ${running.port} | pid: ${process.pid}\n`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      running.stop();
      release();
      process.exit(0);
    });
}
