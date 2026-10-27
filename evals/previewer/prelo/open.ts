// [UI] Abre las sesiones del banco sin mezclarlas con las revisiones personales.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ensureServer, reviewerLink } from "../../../previewer/src/open.ts";

const root = resolve(import.meta.dir, "../../..");
const variant = process.argv[2] ?? "candidate";
if (!/^[a-z][a-z0-9-]*$/.test(variant)) throw new Error("variante inválida");
const bank = join(root, ".n_ein/prelo-bench-20261027");
const folder = join(bank, variant);
if (!existsSync(join(folder, "previewer.db"))) throw new Error("no hay revisiones de esa variante");
process.env.N_EIN_HOME = join(folder, "ui-home");
process.env.N_EIN_CHANNEL = "dev";
process.env.N_EIN_PREVIEWER_DB = join(folder, "previewer.db");
const links = readdirSync(folder).filter(n => /^pr-\d+\.json$/.test(n)).map(name => {
  const result = JSON.parse(readFileSync(join(folder, name), "utf8"));
  return { pr: result.pr as number, session: result.session.id as string };
}).sort((a, b) => a.pr - b.pr);
if (!links.length) throw new Error("no hay revisiones exportadas para abrir");
const state = await ensureServer(root);
for (const row of links) {
  const response = await fetch(`http://127.0.0.1:${state.port}/api/sessions/${row.session}`, {
    headers: { "x-previewer-token": state.token }, signal: AbortSignal.timeout(5_000),
  });
  const view = await response.json() as { session?: { id: string }; run?: { status: string } };
  if (!response.ok || view.session?.id !== row.session || view.run?.status !== "done")
    throw new Error(`la web no devuelve la revisión completa de PR ${row.pr}`);
}
const text = ["# Revisiones de Prelo · " + variant, "", "Copias de evaluación con SHA reconstruidos. Las valoraciones no se aplican automáticamente al repositorio original. Enlaces privados, válidos mientras el servidor local esté activo.", "",
  ...links.map(row => `- [PR #${row.pr}](${reviewerLink(state, row.session)})`), ""].join("\n");
const target = join(bank, `${variant}-links.md`);
writeFileSync(target, text, { mode: 0o600 });
console.log(target);
console.log(reviewerLink(state, links[0]!.session));
