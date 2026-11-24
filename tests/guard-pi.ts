import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { piBinary } from "./pi-runtime.ts";

// Pi real sin interfaz: la guarda detiene lo destructivo y deja pasar lo regenerable.
const root = resolve("."),
  area = mkdtempSync(join(tmpdir(), "nein-guard-pi-"));
function run(name: string, command: string, extra: Record<string, string> = {}): string {
  const cwd = join(area, name);
  mkdirSync(join(cwd, "victima"), { recursive: true });
  mkdirSync(join(cwd, "node_modules"), { recursive: true });
  const result = spawnSync(
    piBinary,
    [
      "--mode", "json", "-p", "--no-session", "--no-extensions", "--no-skills", "--no-themes",
      "--no-prompt-templates", "--no-context-files",
      "-e", join(root, "pi-package/extensions/guard.ts"),
      "-e", join(root, "tests/fixtures/guard-provider.ts"),
      "--model", "guard-test/model", "--thinking", "off", "run it",
    ],
    {
      cwd,
      encoding: "utf8",
      timeout: 20_000,
      env: { ...process.env, PI_CODING_AGENT_DIR: join(cwd, "agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1", N_EIN_TEST_COMMAND: command, ...extra },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("GUARD_DONE"), result.stderr + result.stdout.slice(-2000));
  return cwd;
}

const stopped = run("destructivo", "rm -rf victima");
assert.ok(existsSync(join(stopped, "victima")), "la guarda debía impedir el borrado");
const allowed = run("regenerable", "rm -rf node_modules");
assert.ok(!existsSync(join(allowed, "node_modules")), "node_modules se regenera: debía borrarse");
// [FLOW] Con la carpeta temporal de la sesión como TMPDIR, el resto del temporal del sistema sigue
// siendo temporal (N_EIN_SYSTEM_TMPDIR) y el proyecto sigue protegido.
const system = join(area, "sistema");
mkdirSync(join(system, "n-ein-pi.sesion"), { recursive: true });
mkdirSync(join(system, "otra-prueba"));
const session = { TMPDIR: join(system, "n-ein-pi.sesion"), N_EIN_SYSTEM_TMPDIR: system };
run("temporal", `rm -rf ${join(system, "otra-prueba")}`, session);
assert.ok(!existsSync(join(system, "otra-prueba")), "el temporal del sistema debía poder borrarse");
const project = run("proyecto-sesion", "rm -rf victima", session);
assert.ok(existsSync(join(project, "victima")), "la guarda debía seguir protegiendo el proyecto");
console.log("guard Pi: sin interfaz se detiene rm -rf del proyecto y pasa node_modules y el temporal del sistema");
