import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Finding } from "../previewer/src/finding.ts";
import { ensureServer, reviewerLink } from "../previewer/src/open.ts";
import { createHandler } from "../previewer/src/server.ts";
import { ReviewStore } from "../previewer/src/store.ts";
import { runInNewContext } from "node:vm";
import { marksFor, rowMarks, splitDiff } from "../previewer/web/diff.ts";
import { html, text } from "../previewer/web/html.ts";
import { renderPage } from "../previewer/web/view.ts";

const root = resolve(import.meta.dir, "..");

// El JS real debe conservar el tramo histórico al limpiar el token y al actualizar por polling.
{
  const built = await Bun.build({ entrypoints: [join(root, "previewer/web/main.ts")], target: "browser" });
  assert.equal(built.success, true);
  const location = new URL("http://127.0.0.1:4321/s/demo?run=old#t=private-token");
  const app = { innerHTML: "", textContent: "", querySelectorAll: () => [], querySelector: () => null };
  const requests: string[] = [];
  let poll: (() => void) | undefined, version = 0;
  const view = { session: { id: "demo", repo: "/repo", branch: "change", prUrl: null }, run: null, latest: null,
    findings: [], patch: "", lang: "es", runs: { count: 0, usd: 0 }, historical: true };
  runInNewContext(await built.outputs[0]!.text(), {
    URL, URLSearchParams, location, HTMLElement: class {},
    sessionStorage: { setItem() {}, getItem() { return null; } },
    history: { replaceState(_state: unknown, _title: string, path: string) { location.href = new URL(path, location.origin).href; } },
    document: { getElementById: () => app, querySelectorAll: () => [], addEventListener() {}, activeElement: null, documentElement: {}, hidden: false },
    window: { addEventListener() {}, scrollY: 0, scrollTo() {} },
    setInterval(callback: () => void) { poll = callback; return 1; },
    fetch: async (path: string) => { requests.push(path); return { ok: true, json: async () => path.endsWith("/version") ? { version: String(++version) } : view }; },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(location.hash, "");
  assert.equal(location.search, "?run=old", "quitar el token no borra el tramo seleccionado");
  poll!(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(requests.filter(path => !path.endsWith("/version")), ["/api/sessions/demo?run=old", "/api/sessions/demo?run=old"],
    "una actualización no transforma una vista histórica en el balance actual");
}
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "nein-previewer-web-")));
process.env.N_EIN_HOME = join(scratch, "home");
process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_PREVIEWER_DB = join(scratch, "previewer.db");

// --- Escape -----------------------------------------------------------------------
assert.equal(text(html`<p>${"<img src=x onerror=alert(1)>"}</p>`), "<p>&lt;img src=x onerror=alert(1)&gt;</p>");
assert.equal(text(html`<a title="${'" onmouseover="x'}">${html`<b>ok</b>`}</a>`), '<a title="&quot; onmouseover=&quot;x"><b>ok</b></a>', "un fragmento propio no se escapa dos veces");

// --- Repositorio con un cambio ------------------------------------------------------------
const repo = join(scratch, "project");
mkdirSync(repo);
const git = (...args: string[]): string => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("init", "-q", "-b", "main");
git("config", "user.email", "test@local");
git("config", "user.name", "Test");
writeFileSync(join(repo, "text.ts"), "export function clip(text: string): string {\n  return text;\n}\n");
writeFileSync(join(repo, "old.ts"), "export const gone = true;\n");
git("add", ".");
git("commit", "-qm", "base");
const baseSha = git("rev-parse", "HEAD");
git("switch", "-qc", "feat/clip");
writeFileSync(join(repo, "text.ts"), "export function clip(text: string): string {\n  return text.slice(0, 3);\n}\n");
git("rm", "-q", "old.ts");
git("commit", "-qam", "feat: clip");
const headSha = git("rev-parse", "HEAD");
const patch = git("diff", "--no-color", "-M", baseSha, headSha);

// --- Diff y marcas ---------------------------------------------------------------------
const files = splitDiff(patch);
assert.deepEqual(files.map((file) => file.path), ["old.ts", "text.ts"]);
const clipRows = files[1]?.rows ?? [];
const added = clipRows.find((row) => row.kind === "added");
const removed = clipRows.find((row) => row.kind === "removed");
assert.deepEqual(added && "after" in added ? [added.text, added.after] : null, ["  return text.slice(0, 3);", 2]);
assert.deepEqual(removed && "before" in removed ? [removed.text, removed.before] : null, ["  return text;", 2]);
const marks = marksFor(
  [{ id: "h", citations: [{ path: "text.ts", sha: headSha, start: 2, end: 2 }] }, { id: "b", citations: [{ path: "text.ts", sha: baseSha, start: 2, end: 2 }] }, { id: "old", citations: [{ path: "text.ts", sha: "0123", start: 2, end: 2 }] }],
  { baseSha, headSha },
);
assert.deepEqual(added ? rowMarks(added, marks).map((mark) => mark.finding) : [], ["h"], "la cita al head marca la línea nueva");
assert.deepEqual(removed ? rowMarks(removed, marks).map((mark) => mark.finding) : [], ["b"], "la cita a la base, la retirada");
assert.equal(marks.some((mark) => mark.finding === "old"), false, "una cita a otro head no cae en este diff");

// --- Sesión sembrada ------------------------------------------------------------------------
const store = new ReviewStore(process.env.N_EIN_PREVIEWER_DB);
const session = store.openSession({ repo, branch: "feat/clip", prUrl: "https://example.test/pr/1" });
const run = store.startRun({ sessionId: session.id, baseSha, headSha, model: "m/x", thinking: "high" });
const sample = (title: string, kind: Finding["kind"] = "bug"): Finding => ({
  kind, severity: "high", title, plain: `Explicación llana de ${title}`, condition: "si el texto es largo", consequence: "se corta",
  citations: [{ ref: `text.ts@${headSha.slice(0, 7)}:L2`, path: "text.ts", sha: headSha, start: 2, end: 2, text: "  return text.slice(0, 3);" }],
  probe: { command: "bash p.sh", file: "p.sh", source: "exit 1", exitCode: 1, output: "falló", reproduced: true }, verification: "",
});
const [evil, plain] = store.finishRun(run.id, {
  status: "done", summary: "Recorta el texto.",
  tour: [{ title: "El recorte", plain: "Ahora corta a tres.", why: "Los nombres se ven cortados.", files: ["text.ts", "old.ts"] }],
  findings: [sample('<script>alert("x")</script>'), sample("Sin elegir", "smell")], gaps: ["no hay tests"],
});
assert.ok(evil && plain);
store.rate(plain.id, "descartar");

// --- Vista ------------------------------------------------------------------------------------
{
  const views = { session, run: store.run(run.id), latest: null, runs: { count: 1, usd: 0.2 }, findings: store.findings(session.id), patch, lang: "es" as const };
  const page = text(renderPage(views));
  assert.doesNotMatch(page, /<script>alert/, "el texto del modelo no se ejecuta");
  assert.match(page, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(page, /<span class="slashes">\/\/<\/span> <span class="num">001<\/span>  QUÉ CAMBIA/);
  assert.match(page, /Los nombres se ven cortados\./);
  const card = page.slice(page.indexOf(`id="f-${evil.id}"`), page.indexOf("</article>", page.indexOf(`id="f-${evil.id}"`)));
  assert.match(card, /resultado inconcluso/, "una sonda histórica no adquiere garantías al actualizar la interfaz");
  assert.doesNotMatch(card, /demostrado/);
  const explicit = text(renderPage({ ...views, findings: views.findings.map(f => ({ ...f, probe: f.probe ? { ...f.probe,
    outcome: "not_applicable" as const, reason: "El backup ahora contiene el archivo.",
    baseline: { sha: baseSha, outcome: "passed" as const, reason: "La base conserva los datos.", exitCode: 0, output: "ok" },
  } : null })) }));
  assert.match(explicit, /el escenario ya no aplica/);
  assert.match(explicit, /El backup ahora contiene el archivo/);
  assert.match(explicit, /comprobación en la base/);
  assert.ok(card.indexOf("Explicación llana") < card.indexOf("<details>"), "la explicación llana se ve sin desplegar");
  assert.ok(card.indexOf("si el texto es largo") > card.indexOf("<details>"), "la condición técnica va plegada");
  assert.match(card, new RegExp(`href="#l-0-a-2">text\\.ts@${headSha.slice(0, 7)}:L2`), "la cita enlaza su línea del diff");
  assert.match(page, new RegExp(`<div class="row added cited" id="l-0-a-2">.*<a class="mark" href="#f-${evil.id}"`), "y el diff marca el hallazgo en esa línea");
  const dismissed = page.slice(page.indexOf(`id="f-${plain.id}"`));
  assert.match(dismissed.slice(0, dismissed.indexOf("</article>")), /data-action="select" disabled/, "lo descartado no se puede enviar");
  assert.ok(page.indexOf('<summary class="path">text.ts') < page.indexOf('<summary class="path">old.ts'), "los archivos siguen el orden del recorrido, no el del diff");
  assert.match(page, /<summary class="path">text\.ts <span class="count">\+1 −1 · 1 ▸<\/span>/, "cada archivo dice cuánto cambia y cuántas marcas lleva");
  assert.match(page, /· 0,20 \$/, "el coste en el formato del idioma");
  assert.match(page, /marca «enviar a n_ein»/);
  assert.match(text(renderPage({ ...views, lang: "en" })), /WHAT CHANGES/);
}

// --- Servidor --------------------------------------------------------------------------------
{
  const token = "t".repeat(48);
  const port = 4321;
  const handle = await createHandler({ packageRoot: root, store, token, port: () => port });
  const request = (path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Response> =>
    handle(new Request(`http://127.0.0.1:${port}${path}`, { method: init.method, body: init.body, headers: { host: `127.0.0.1:${port}`, ...init.headers } }));
  const api = { "x-previewer-token": token };
  const post = { ...api, "content-type": "application/json", origin: `http://127.0.0.1:${port}` };

  assert.equal((await request(`/s/${session.id}`)).status, 200);
  assert.match(await (await request(`/s/${session.id}`)).text(), /<script type="module" src="\/app\.js">/);
  assert.equal((await request(`/s/${session.id}`, { headers: { host: `evil.test:${port}` } })).status, 403, "un nombre ajeno apuntando a 127.0.0.1 no entra");
  assert.match((await request(`/s/${session.id}`)).headers.get("content-security-policy") ?? "", /script-src 'self'/);
  assert.equal((await request(`/api/sessions/${session.id}`)).status, 403, "la API pide el token");
  assert.equal((await request(`/api/sessions/${session.id}`, { headers: { "x-previewer-token": "x".repeat(48) } })).status, 403);
  const data = await (await request(`/api/sessions/${session.id}`, { headers: api })).json();
  assert.equal(data.session.branch, "feat/clip");
  assert.equal(data.findings.length, 2);
  assert.equal(data.findings[0].probe.reproduced, false, "la API no anuncia como demostrada una sonda histórica");
  assert.equal(data.findings[0].probe.outcome, "inconclusive");
  assert.match(data.patch, /text\.slice\(0, 3\)/);
  assert.equal((await request("/api/sessions/nope", { headers: api })).status, 404);
  const version = (await (await request(`/api/sessions/${session.id}/version`, { headers: api })).json()).version;
  assert.match(version, new RegExp(`${run.id}:done`));

  const rate = await request(`/api/findings/${evil.id}/rate`, { method: "POST", headers: post, body: JSON.stringify({ verdict: "vale", reason: "lo veo" }) });
  assert.equal(rate.status, 200);
  assert.equal(store.finding(evil.id)?.rating?.reason, "lo veo");
  const versionOf = async (): Promise<string> => (await (await request(`/api/sessions/${session.id}/version`, { headers: api })).json()).version;
  const rated = await versionOf();
  assert.notEqual(rated, version, "una valoración cambia la versión: otra pestaña repinta");
  assert.equal((await request(`/api/findings/${evil.id}/select`, { method: "POST", headers: post, body: JSON.stringify({ selected: true }) })).status, 200);
  assert.equal(store.selection(session.id).length, 1);
  const picked = await versionOf();
  assert.notEqual(picked, rated, "y una selección también");
  store.select(evil.id, false);
  assert.notEqual(await versionOf(), picked, "y quitarla");
  store.select(evil.id, true);
  assert.equal((await request(`/api/findings/${plain.id}/select`, { method: "POST", headers: post, body: JSON.stringify({ selected: true }) })).status, 409, "lo descartado no se selecciona");
  assert.equal((await request(`/api/findings/${evil.id}/rate`, { method: "POST", headers: { ...post, "content-type": "text/plain" }, body: "{}" })).status, 415, "un formulario simple no escribe");
  assert.equal((await request(`/api/findings/${evil.id}/rate`, { method: "POST", headers: { ...post, origin: "https://evil.test" }, body: JSON.stringify({ verdict: "descartar" }) })).status, 403, "otra web no escribe");
  assert.equal((await request(`/api/findings/${evil.id}/rate`, { method: "POST", headers: post, body: JSON.stringify({ verdict: "quizá" }) })).status, 400);
  assert.equal(store.finding(evil.id)?.rating?.verdict, "vale");

  const css = await (await request("/app.css")).text();
  for (const name of ["carbon", "concrete", "yellow", "secondary", "dark", "green", "red"]) assert.match(css, new RegExp(`--${name}:#[0-9A-Fa-f]{6}`), `falta --${name}`);
  assert.doesNotMatch(readFileSync(join(root, "previewer/web/style.css"), "utf8"), /#[0-9A-Fa-f]{3,8}\b/, "la hoja de estilo no escribe colores: llegan de brand.json y el tema");
  assert.match(await (await request("/app.js")).text(), /previewer-token/, "la web compila al arrancar");
}
store.close();

// --- Servidor en segundo plano: arranca una vez y se reutiliza --------------------------
{
  const first = await ensureServer(root);
  const again = await ensureServer(root);
  assert.equal(again.pid, first.pid, "una segunda apertura reutiliza el servidor vivo");
  const link = reviewerLink(first, session.id);
  assert.match(link, new RegExp(`^http://127\\.0\\.0\\.1:${first.port}/s/${session.id}#t=[0-9a-f]{48}$`));
  const page = await fetch(link.split("#")[0] ?? "");
  assert.equal(page.status, 200);
  const live = await fetch(`http://127.0.0.1:${first.port}/api/sessions/${session.id}`, { headers: { "x-previewer-token": first.token } });
  assert.equal((await live.json()).findings.length, 2);
  process.kill(first.pid, "SIGTERM");
  await Bun.sleep(300);
  assert.throws(() => process.kill(first.pid, 0), "se para con SIGTERM");
}

console.log("previewer web: OK");
