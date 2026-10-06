import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import registerHandoff from "../pi-package/extensions/handoff";

const dir = mkdtempSync(join(tmpdir(), "n-ein-handoff-"));
const home = join(dir, "pi-home");
const signal = join(dir, "signal");
const previousHome = process.env.PI_CODING_AGENT_DIR;
const previousSignal = process.env.N_EIN_HANDOFF_SIGNAL;
process.env.PI_CODING_AGENT_DIR = home;
process.env.N_EIN_HANDOFF_SIGNAL = signal;
mkdirSync(home);
writeFileSync(signal, "");

let command: any;
registerHandoff({ registerCommand(_name: string, value: any) { command = value; } } as any);

const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
git("init", "-b", "main");
git("config", "user.name", "n_ein test");
git("config", "user.email", "test@n-ein.invalid");
writeFileSync(join(dir, "code.ts"), "export const value = 1\n");
writeFileSync(join(dir, "WORK.md"), "# Encargo\n\n## Objetivo\nCorregir código.\n\n## Decisiones\nConservar la interfaz actual.\n\n## Tareas\n- [x] Editar\n- [ ] Comprobar\n\n## Evidencia\n`bun test` pasó antes de la última edición.\n");
git("add", "code.ts", "WORK.md");
git("commit", "-m", "test: base");
writeFileSync(join(dir, "code.ts"), "export const value = 2\n");
writeFileSync(join(dir, "new.ts"), "export const added = true\n");

let idle = false;
let stopped = false;
const notices: string[] = [];
const ctx = {
  cwd: dir,
  waitForIdle: async () => { idle = true; },
  sessionManager: { getBranch: () => [
    { type: "message", message: { role: "user", content: [{ type: "text", text: "Corrige el valor" }] } },
    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "Falta comprobar el cambio" }] } },
  ] },
  ui: { notify: (message: string) => notices.push(message) },
  shutdown: () => { assert.ok(idle); assert.ok(existsSync(signal)); stopped = true; },
};

try {
  await command.handler("claude", ctx);
  assert.ok(stopped, "Pi no cerró tras preparar el relevo.");
  const [target, file] = readFileSync(signal, "utf8").trim().split("\n");
  assert.equal(target, "claude");
  const summary = readFileSync(file, "utf8");
  assert.match(summary, /Corrige el valor/);
  assert.match(summary, /Falta comprobar el cambio/);
  assert.match(summary, /WORK\.md/);
  assert.match(summary, /Corregir código/);
  assert.match(summary, /Conservar la interfaz actual/);
  assert.match(summary, /- Editar/);
  assert.match(summary, /- Comprobar/);
  assert.match(summary, /code\.ts/);
  assert.match(summary, /new\.ts/);
  assert.match(summary, /Vigencia: desconocida/);
  assert.ok(notices.some((message) => message.includes("Relevo listo")));

  writeFileSync(join(dir, "WORK.md"), "# Acuerdo\n\n## Acuerdo confirmado\nCopiar apuntes por fecha.\n\n## Criterios observables\nNo mover originales.\n\n## Pendiente\nEsperar autorización de código.\n");
  await command.handler("claude", ctx);
  const [, fallbackFile] = readFileSync(signal, "utf8").trim().split("\n");
  const fallback = readFileSync(fallbackFile, "utf8");
  assert.match(fallback, /Copiar apuntes por fecha/);
  assert.match(fallback, /No mover originales/);
  assert.match(fallback, /Esperar autorización de código/);

  writeFileSync(join(dir, "WORK.md"), `# Job\n\n## Goal\nKeep the full request.\n\n## Decisions\nPreserve the public interface.\n\n## Limits\nDo not publish.\n\n## Criteria\n${"Independent acceptance rule. ".repeat(100)}\nFINAL_CRITERION\n\n## Tasks\n- [x] Server\n- [ ] Client\n\n## Evidence\nTests passed before the last edit.\n\n## Next step\nCheck the client.\n`);
  await command.handler("claude", ctx);
  const [, englishFile] = readFileSync(signal, "utf8").trim().split("\n");
  const english = readFileSync(englishFile, "utf8");
  for (const text of ["Keep the full request.", "Preserve the public interface.", "Do not publish.", "FINAL_CRITERION", "Tests passed before the last edit.", "Check the client.", "- Client"]) {
    assert.ok(english.includes(text), `el relevo conserva ${text}`);
  }
  console.log("handoff: resumen, diff y cierre ordenado preparados");
} finally {
  if (previousHome === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousHome;
  if (previousSignal === undefined) delete process.env.N_EIN_HANDOFF_SIGNAL;
  else process.env.N_EIN_HANDOFF_SIGNAL = previousSignal;
  rmSync(dir, { recursive: true, force: true });
}
