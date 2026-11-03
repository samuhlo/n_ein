import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Pi real sin interfaz: la guarda detiene lo destructivo y deja pasar lo regenerable.
const root = resolve("."),
  area = mkdtempSync(join(tmpdir(), "nein-guard-pi-"));
function run(name: string, command: string): string {
  const cwd = join(area, name);
  mkdirSync(join(cwd, "victima"), { recursive: true });
  mkdirSync(join(cwd, "node_modules"), { recursive: true });
  const result = spawnSync(
    process.env.N_EIN_PI_BIN || join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi"),
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
      env: { ...process.env, PI_CODING_AGENT_DIR: join(cwd, "agent"), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1", N_EIN_TEST_COMMAND: command },
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
console.log("guard Pi: sin interfaz se detiene rm -rf del proyecto y pasa node_modules");
