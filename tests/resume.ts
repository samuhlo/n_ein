import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resumeCommand, resumeHint, resumeLauncher, resumeSession } from "../pi-package/resume.ts";

const area = mkdtempSync(join(tmpdir(), "nein-resume-"));
try {
  // [FLOW] Con qué se vuelve: `nein` si el del PATH es este paquete, su propio nein si está instalado
  // y, en un checkout de desarrollo, el lanzador que se usó.
  const installed = join(area, "installations/preview");
  mkdirSync(join(installed, "bin"), { recursive: true });
  writeFileSync(join(installed, ".n-ein-channel"), "preview\n");
  writeFileSync(join(installed, "bin/nein"), "#!/bin/sh\n");
  const links = join(area, "links");
  mkdirSync(links);
  symlinkSync(join(installed, "bin/nein"), join(links, "nein"));
  const stable = join(area, "installations/stable");
  mkdirSync(join(stable, "bin"), { recursive: true });
  writeFileSync(join(stable, ".n-ein-channel"), "stable\n");
  writeFileSync(join(stable, "bin/nein"), "#!/bin/sh\n");
  const checkout = join(area, "checkout");
  mkdirSync(join(checkout, "bin"), { recursive: true });
  // bin/nein solo arranca preview y estable: una instalación del canal dev vuelve por su lanzador.
  const dev = join(area, "installations/dev");
  mkdirSync(join(dev, "bin"), { recursive: true });
  writeFileSync(join(dev, ".n-ein-channel"), "dev\n");
  writeFileSync(join(dev, "bin/nein"), "#!/bin/sh\n");
  assert.deepEqual(resumeLauncher(dev, join(links, "nein"), join(dev, "bin/n-ein-dev")), { kind: "shell", path: join(dev, "bin/n-ein-dev") });

  assert.deepEqual(resumeLauncher(installed, join(links, "nein"), join(installed, "bin/n-ein-dev")), { kind: "nein", command: "nein" });
  assert.deepEqual(resumeLauncher(stable, join(links, "nein"), join(stable, "bin/n-ein-dev")), { kind: "nein", command: join(stable, "bin/nein") });
  assert.deepEqual(resumeLauncher(checkout, join(links, "nein"), join(checkout, "bin/n-ein-dev")), { kind: "shell", path: join(checkout, "bin/n-ein-dev") });
  assert.deepEqual(resumeLauncher(checkout, undefined, join(checkout, "bin/n-ein-claude-dev")), { kind: "shell", path: join(checkout, "bin/n-ein-claude-dev") });

  // Lleva el proyecto, para copiarlo desde cualquier carpeta; las rutas raras van entre comillas.
  const nein = { kind: "nein", command: "nein" } as const;
  assert.equal(resumeCommand("pi", "019a-b2", "/p/proyecto", nein), "nein --project /p/proyecto --runtime pi -- --session 019a-b2");
  assert.equal(resumeCommand("claude", "4f1c", "/p/mi proyecto", nein), "nein --project '/p/mi proyecto' --runtime claude -- --resume 4f1c");
  assert.equal(
    resumeCommand("pi", "019a", "/p/o'brien", { kind: "nein", command: "/n ein/bin/nein" }),
    "'/n ein/bin/nein' --project '/p/o'\\''brien' --runtime pi -- --session 019a",
  );
  assert.equal(
    resumeCommand("claude", "4f1c", "/p/proyecto", { kind: "shell", path: "/r/bin/n-ein-claude-dev" }),
    "cd /p/proyecto && /r/bin/n-ein-claude-dev --resume 4f1c",
  );

  // [FLOW] Qué sesión: Pi deja id y archivo; Claude solo el id, con su transcripción bajo projects/.
  // Sin sesión guardada en disco no hay nada que retomar.
  const piFile = join(area, "sessions/2026_019a.jsonl");
  mkdirSync(join(area, "sessions"));
  writeFileSync(piFile, "{}\n");
  assert.deepEqual(resumeSession("pi", `019a\n${piFile}\n`, ""), { id: "019a" });
  assert.equal(resumeSession("pi", `019a\n${join(area, "sessions/vacía.jsonl")}\n`, ""), undefined);
  assert.equal(resumeSession("pi", "", ""), undefined);
  const claudeDir = join(area, "claude");
  mkdirSync(join(claudeDir, "projects/-p-proyecto"), { recursive: true });
  writeFileSync(join(claudeDir, "projects/-p-proyecto/4f1c.jsonl"), "{}\n");
  assert.deepEqual(resumeSession("claude", "4f1c\n", claudeDir), { id: "4f1c" });
  assert.equal(resumeSession("claude", "9e9e\n", claudeDir), undefined);
  // El id acaba en una orden de shell: uno con otros caracteres no se imprime.
  writeFileSync(join(claudeDir, "projects/-p-proyecto/$(x).jsonl"), "{}\n");
  assert.equal(resumeSession("claude", "$(x)\n", claudeDir), undefined);

  // La pista dice por qué el comando del runtime no sirve, y el nuestro va en su propia línea.
  assert.deepEqual(resumeHint("pi", "nein --project /p --runtime pi -- --session 019a"), [
    "Para volver con n_ein (el comando de arriba abre Pi sin n_ein):",
    "nein --project /p --runtime pi -- --session 019a",
  ]);
  assert.equal(resumeHint("claude", "x")[0], "Para volver con n_ein (el comando de arriba abre Claude sin n_ein):");
  console.log("resume: comando, lanzador, sesión y pista");
} finally {
  rmSync(area, { recursive: true, force: true });
}
