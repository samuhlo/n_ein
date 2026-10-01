import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import registerCodeGraph from "../pi-package/extensions/codegraph";

const testDir = mkdtempSync(join(tmpdir(), "n-ein-codegraph-"));
const previous = process.env.N_EIN_CODEGRAPH_BIN;
const log = join(testDir, "calls");
const fake = join(testDir, "codegraph");
writeFileSync(fake, [
  "#!/usr/bin/env bash",
  `printf '%s|%s\\n' "$DO_NOT_TRACK" "$*" >> "${log}"`,
  "case \"$1\" in",
  "  explore) if [[ \"$2\" == roto ]]; then printf 'índice bloqueado\\n' >&2; exit 3; fi; if [[ \"$2\" == enorme ]]; then head -c 70000 /dev/zero | tr '\\0' x; exit 0; fi; printf 'Exploration: %s\\n' \"$2\" ;;",
  "esac",
].join("\n") + "\n");
chmodSync(fake, 0o755);

try {
  delete process.env.N_EIN_CODEGRAPH_BIN;
  let tool: any;
  registerCodeGraph({ registerTool(value: unknown) { tool = value; } } as any);
  assert.equal(tool, undefined, "Sin binario resuelto por el lanzador no debe haber herramienta.");

  process.env.N_EIN_CODEGRAPH_BIN = fake;
  registerCodeGraph({ registerTool(value: unknown) { tool = value; } } as any);
  assert.equal(tool.name, "codegraph_explore");

  const ok = await tool.execute("q1", { query: "installPiRuntime" }, new AbortController().signal, undefined, { cwd: testDir });
  assert.match(ok.content[0].text, /Exploration: installPiRuntime/);
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.deepEqual(calls, ["1|sync --quiet", "1|explore installPiRuntime"], "Debe sincronizar antes de explorar y sin telemetría.");

  const big = await tool.execute("q2", { query: "enorme" }, new AbortController().signal, undefined, { cwd: testDir });
  assert.ok(big.content[0].text.length < 61_000);
  assert.match(big.content[0].text, /recortado a 60000 caracteres/);

  const failed = await tool.execute("q3", { query: "roto" }, new AbortController().signal, undefined, { cwd: testDir });
  assert.match(failed.content[0].text, /CODEGRAPH_FAIL :: reason: índice bloqueado/);
  assert.match(failed.content[0].text, /grep\/read como alternativa/);
} finally {
  if (previous === undefined) delete process.env.N_EIN_CODEGRAPH_BIN;
  else process.env.N_EIN_CODEGRAPH_BIN = previous;
  rmSync(testDir, { recursive: true, force: true });
}

console.log("codegraph: sincroniza, explora, recorta y avisa sin romper la sesión");
