import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectorNote, connectorPolicy } from "../pi-package/connectors.ts";

const area = mkdtempSync(join(tmpdir(), "n-ein-connectors-"));
const home = join(area, "claude");
const project = join(area, "project");
mkdirSync(home);
mkdirSync(project);

try {
  // [CORE] Sin registro de Claude no se conoce ningún conector: la sesión arranca como siempre.
  assert.deepEqual(connectorPolicy(home, project), { denied: [], kept: [] });
  assert.equal(connectorNote({ denied: [], kept: [] }), "", "sin nada apagado, el agente no recibe nota");

  // Lo que el hogar conectó alguna vez y lo que espera login; solo los conectores de claude.ai.
  writeFileSync(join(home, ".claude.json"), JSON.stringify({
    claudeAiMcpEverConnected: ["claude.ai Vercel", "claude.ai Context7", "claude.ai Gmail", "claude.ai Neon", "codegraph", 7],
  }));
  writeFileSync(join(home, "mcp-needs-auth-cache.json"), JSON.stringify({ "claude.ai Notion": { timestamp: 1 } }));
  const base = connectorPolicy(home, project);
  assert.deepEqual(base.kept, ["claude.ai Context7"], "Context7 queda: documentación al día en cualquier proyecto");
  assert.deepEqual(base.denied, ["claude.ai Gmail", "claude.ai Neon", "claude.ai Notion", "claude.ai Vercel"]);

  // [FLOW] Un proyecto enciende los suyos: un nombre por línea, con o sin prefijo, sin distinguir mayúsculas.
  mkdirSync(join(project, ".n_ein"));
  writeFileSync(join(project, ".n_ein", "connectors"), "# Base de datos y despliegue de este proyecto\nNeon\n\nclaude.ai vercel  # previews\n");
  const withProject = connectorPolicy(home, project);
  assert.deepEqual(withProject.kept, ["claude.ai Context7", "claude.ai Neon", "claude.ai Vercel"]);
  assert.deepEqual(withProject.denied, ["claude.ai Gmail", "claude.ai Notion"]);

  // El agente sabe qué está apagado y cómo encenderlo en este proyecto.
  const note = connectorNote(withProject);
  assert.match(note, /claude\.ai Gmail, claude\.ai Notion/);
  assert.match(note, /`\.n_ein\/connectors`/);
  assert.match(note, /next session/);

  // BLINDAJE -> Un registro de Claude a medio escribir no apaga nada por error: se usa lo que sí se lee.
  writeFileSync(join(home, ".claude.json"), "{ roto");
  assert.deepEqual(connectorPolicy(home, project).denied, ["claude.ai Notion"]);
} finally {
  rmSync(area, { recursive: true, force: true });
}

console.log("connectors: Context7 por defecto, el resto apagado y cada proyecto enciende los suyos");
