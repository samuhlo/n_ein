import { strict as assert } from "node:assert";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import registerCodeGraph from "../pi-package/extensions/codegraph";

const testDir = mkdtempSync(join(tmpdir(), "n-ein-codegraph-"));
const previous = process.env.N_EIN_CODEGRAPH_BIN;
const log = join(testDir, "calls");
const fake = join(testDir, "codegraph");
writeFileSync(
  fake,
  [
    "#!/usr/bin/env bash",
    `printf '%s|%s\\n' "$DO_NOT_TRACK" "$*" >> "${log}"`,
    'case "$1" in',
    "  explore) if [[ \"$2\" == roto ]]; then printf 'índice bloqueado\\n' >&2; exit 3; fi; if [[ \"$2\" == enorme ]]; then head -c 70000 /dev/zero | tr '\\0' x; exit 0; fi; printf 'Exploration: %s\\n' \"$2\" ;;",
    '  sync) if [[ "${N_EIN_TEST_SYNC_FAIL:-0}" == 1 ]]; then printf "index busy\\n" >&2; exit 3; fi ;;',
    "esac",
  ].join("\n") + "\n",
);
chmodSync(fake, 0o755);

try {
  delete process.env.N_EIN_CODEGRAPH_BIN;
  let tool: any;
  registerCodeGraph({
    registerTool(value: unknown) {
      tool = value;
    },
  } as any);
  assert.equal(
    tool,
    undefined,
    "Sin binario resuelto por el lanzador no debe haber herramienta.",
  );

  process.env.N_EIN_CODEGRAPH_BIN = fake;
  registerCodeGraph({
    registerTool(value: unknown) {
      tool = value;
    },
  } as any);
  assert.equal(tool.name, "codegraph_explore");

  const ok = await tool.execute(
    "q1",
    { query: "installPiRuntime" },
    new AbortController().signal,
    undefined,
    { cwd: testDir },
  );
  assert.match(ok.content[0].text, /Exploration: installPiRuntime/);
  const calls = readFileSync(log, "utf8").trim().split("\n");
  assert.deepEqual(
    calls,
    ["1|sync --quiet", "1|explore installPiRuntime --max-files 3"],
    "Debe sincronizar antes de explorar y sin telemetría.",
  );

  await tool.execute(
    "wide",
    { query: "shared consumers", maxFiles: 8 },
    undefined,
    undefined,
    { cwd: testDir },
  );
  assert.match(
    readFileSync(log, "utf8"),
    /explore shared consumers --max-files 8/,
  );

  const big = await tool.execute(
    "q2",
    { query: "enorme" },
    new AbortController().signal,
    undefined,
    { cwd: testDir },
  );
  assert.ok(big.content[0].text.length < 61_000);
  assert.match(big.content[0].text, /recortado a 60000 caracteres/);
  assert.equal(
    readFileSync(big.details.fullOutputPath, "utf8"),
    "x".repeat(70000),
    "Truncation must retain retrievable source",
  );
  rmSync(big.details.fullOutputPath);

  const failed = await tool.execute(
    "q3",
    { query: "roto" },
    new AbortController().signal,
    undefined,
    { cwd: testDir },
  );
  assert.match(
    failed.content[0].text,
    /CODEGRAPH_FAIL :: reason: índice bloqueado/,
  );
  assert.match(failed.content[0].text, /grep\/read como alternativa/);
  process.env.N_EIN_TEST_SYNC_FAIL = "1";
  const stale = await tool.execute(
    "stale",
    { query: "current source" },
    undefined,
    undefined,
    { cwd: testDir },
  );
  assert.match(stale.content[0].text, /INDEX_STALE/);
  assert.match(stale.content[0].text, /Exploration: current source/);
  delete process.env.N_EIN_TEST_SYNC_FAIL;
  process.env.N_EIN_ASSIGNMENT_MODE = "read";
  writeFileSync(log, "");
  const reading = await tool.execute(
    "reader",
    { query: "current source" },
    undefined,
    undefined,
    { cwd: testDir },
  );
  assert.match(reading.content[0].text, /current source/);
  assert.equal(
    readFileSync(log, "utf8").trim(),
    "1|explore current source --max-files 3",
    "Readers do not regenerate a shared index",
  );
} finally {
  delete process.env.N_EIN_ASSIGNMENT_MODE;
  delete process.env.N_EIN_TEST_SYNC_FAIL;
  if (previous === undefined) delete process.env.N_EIN_CODEGRAPH_BIN;
  else process.env.N_EIN_CODEGRAPH_BIN = previous;
  rmSync(testDir, { recursive: true, force: true });
}

console.log(
  "codegraph: sincroniza, explora, recorta y avisa sin romper la sesión",
);
