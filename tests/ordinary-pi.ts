import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import registerRouter from "../pi-package/extensions/router.ts";
const source = resolve("."),
  root = process.env.N_EIN_PRODUCT_ROOT || source;
const area = mkdtempSync(join(tmpdir(), "nein-ordinary-pi-")),
  project = join(area, "project");
mkdirSync(project);
execFileSync("git", ["init", "-q"], { cwd: project });
const models = join(area, "models.json"),
  index = join(area, "codegraph"),
  wrapper = join(area, "pi");
const real =
  process.env.N_EIN_PI_BIN ||
  join(homedir(), ".n_ein/runtimes/pi/1.0.2/bin/pi");
const quote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
writeFileSync(
  wrapper,
  `#!/bin/sh\nexec ${quote(real)} "$@" -e ${quote(join(source, "tests/fixtures/ordinary-provider.ts"))}\n`,
  { mode: 0o755 },
);
writeFileSync(index, '#!/bin/sh\nprintf "{}\\n"\n', { mode: 0o755 });
const physical = (id: string) => ({
  model: `nein-test/${id}`,
  thinking: "off",
});
writeFileSync(
  models,
  JSON.stringify({
    schema: 1,
    agents: {
      principal: { model: "nein/auto", thinking: "medium" },
      mecanico: physical("cheap"),
      ordinario: physical("capable"),
      riesgo: physical("risk"),
      abierto: physical("risk"),
    },
  }),
);
function run(prompt: string, team?: string) {
  const sessionDir = mkdtempSync(join(area, "sessions-"));
  const env = {
    ...process.env,
    N_EIN_AGENT_DIR: join(area, "home"),
    N_EIN_PI_BIN: wrapper,
    N_EIN_MODELS_FILE: models,
    N_EIN_CODEGRAPH_BIN: index,
    PI_SKIP_VERSION_CHECK: "1",
  };
  delete env.N_EIN_TEAM;
  if (team !== undefined) env.N_EIN_TEAM = team;
  const output = execFileSync(
    join(root, "bin/n-ein-dev"),
    ["--mode", "json", "--print", "--session-dir", sessionDir, prompt],
    {
      cwd: project,
      env,
      encoding: "utf8",
      timeout: 20000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const events = output.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const messages = events
    .filter((e) => e.type === "message_end" && e.message?.role === "assistant")
    .map((e) => e.message);
  const final = JSON.parse(
    messages.at(-1).content.find((c: any) => c.type === "text").text,
  );
  const sessionFile = readdirSync(sessionDir).find((f) =>
    f.endsWith(".jsonl"),
  )!;
  const nativeBranch = readFileSync(join(sessionDir, sessionFile), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  return { models: messages.map((m) => m.model), nativeBranch, ...final };
}
const automatic = run("Corrige una errata del README");
assert.deepEqual(
  automatic.models,
  ["cheap", "risk"],
  "discovered risk raises automatic capability before further work",
);
assert.ok(
  !automatic.tools.includes("nein_team"),
  "ordinary Pi has no delegation tool",
);
const selected = run("[sol] Corrige una errata del README");
assert.deepEqual(
  selected.models,
  ["capable", "capable"],
  "manual job class survives an attempted automatic escalation",
);
const experimental = run("[sol] Solo informa de la selección", "1");
assert.ok(
  experimental.tools.includes("nein_team"),
  "experimental tooling requires opt-in",
);
console.log(
  "native ordinary session: default tools, automatic escalation and explicit class: OK",
);

// Las peticiones directas no traen state: restaurar desde las entradas de Pi,
// con una instancia nueva de la extensión, no desde un estado fabricado.
let restored: any;
registerRouter({
  on() {},
  registerTool() {},
  registerCommand() {},
  registerVirtualModel(value: any) {
    restored = value;
  },
} as any);
const summarized = await restored.route(
  { reason: "direct", messages: [] },
  {
    sessionManager: { getBranch: () => selected.nativeBranch },
    modelRegistry: {
      find: (provider: string, id: string) => ({ provider, id }),
    },
  },
);
assert.equal(summarized.model.id, "capable");
console.log(
  "native persisted model choice survives auxiliary routing after reload: OK",
);
