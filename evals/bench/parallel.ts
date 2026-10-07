// =============================================================================
// [BENCH] EQUIPO FRENTE A EJECUCIÓN DIRECTA
// Copias y productos congelados. Variantes en serie; incluye todos los hijos.
// uso: bun evals/bench/parallel.ts s6|s2|s3 serial|team identificador
// =============================================================================
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { acceptanceStatus } from "./acceptance.ts";
const repo = resolve(import.meta.dir, "../..");
const [scenario, arm, id, mode] = process.argv.slice(2);
const directed = mode === "directed";
if (
  !["s6", "s2", "s3", "context"].includes(scenario) ||
  !["serial", "team"].includes(arm) ||
  !id ||
  !/^[a-zA-Z0-9_-]+$/.test(id)
)
  throw new Error("scenario arm unique-id required");
const bench = process.env.N_EIN_BENCH || resolve(repo, "../n_ein-bench");
const project = join(bench, "copies", id),
  log = join(bench, "logs", id),
  product = join(bench, "products", id);
if (existsSync(project) || existsSync(log) || existsSync(product))
  throw new Error("Run already exists; preserve it.");
mkdirSync(log, { recursive: true });
mkdirSync(product, { recursive: true });
execFileSync("cp", ["-c", "-R", join(bench, "bases/4d66007"), project]);
const revision =
  process.env.N_EIN_EVAL_SOURCE ||
  (arm === "serial"
    ? "b619eaa"
    : execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repo,
        encoding: "utf8",
      }).trim());
const archive = join(log, "product.tar");
execFileSync(
  "git",
  ["archive", "--format=tar", `--output=${archive}`, revision],
  { cwd: repo },
);
execFileSync("tar", ["-xf", archive, "-C", product]);
mkdirSync(join(product, "dist"));
execFileSync(
  process.env.N_EIN_GO_BIN ||
    join(homedir(), ".n_ein/dev/toolchain/go1.27.1/go/bin/go"),
  ["build", "-o", join(product, "dist/n-ein"), "./cmd/n-ein"],
  { cwd: join(product, "go"), env: { ...process.env, GOTOOLCHAIN: "local" } },
);
const base = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: project,
  encoding: "utf8",
}).trim();
const contextPrompts = [
  "Solo lectura. Necesito entender el alta de centros antes de cambiarla: investiga el recorrido de POST /api/academia, las reglas de cuenta y permisos, errores y consumidores en las pantallas, las pruebas existentes y las discrepancias relevantes con la documentación. Devuelve un mapa conciso con rutas y evidencia; distingue comportamiento actual de requisitos pendientes. No implementes ni crees documentos.",
  "Con ese mapa: ¿se rechaza hoy a una cuenta que tiene un curso propio sin academia o un módulo asignado? Distingue ese caso de una cuenta que ya gestiona un centro. Señala dónde habría que comprobar cada regla y qué consumidores del código de error pueden pasar desapercibidos. Seguimos solo leyendo.",
  "Ahora investiga la página de Anexo IV y su prueba tests/pages/anexo-iv-codigo.test.ts: snapshot, curso activo, aviso de descarga, guardado y cambio entre IV–VI. Explica qué garantiza el código y qué observa realmente la prueba. Usa referencias y señala huecos; no cambies nada.",
  "Si esa prueba está verde, ¿demuestra que el aviso desaparece al recuperar un curso y que un snapshot no vigente redirige antes de cargar el workspace? Describe las comprobaciones de comportamiento que faltan y los dobles que necesitarían, conservando las garantías actuales. No escribas tests todavía.",
  "Investiga también el recorrido de generar Anexo III con curso guardado: quién envía la planificación, de dónde la toma el servidor, cómo valida acceso al curso y qué pasaría si el cuerpo discrepa de la planificación persistida. Incluye la ruta cliente, servidor y pruebas con evidencia, sin modificar archivos.",
  "Resume lo establecido para decidir el trabajo siguiente: comportamiento actual y pendiente en alta, Anexo IV y origen de la planificación del III; unidades que pueden avanzar independientemente, contratos compartidos y una comprobación integrada. Reutiliza los hallazgos, marca las incertidumbres y no afirmes pruebas ejecutadas. Devuélvelo aquí, sin crear WORK.md ni implementar.",
];
const prompt = {
  context: contextPrompts[0],
  s6: "En el panel del centro, que el título «Los cursos del centro» muestre cuántos cursos hay, por ejemplo «Los cursos del centro (3)». Si no hay ninguno, el título se queda como está.",
  s2: "Haz que el Anexo III lea la planificación guardada del curso en el servidor en vez del cuerpo que manda el cliente, y que el cliente deje de mandarla cuando hay curso.",
  s3: "Cierra las deudas de docs/alpha-v1/estado-actual.md: que al dar de alta un centro se rechace a quien ya tiene cursos propios o módulos asignados; que tests/pages/anexo-iv-codigo.test.ts monte el componente en vez de leerlo como texto; y corrige el documento, que todavía da en gris el botón «Crear un curso» del centro.",
}[scenario]!;
if (scenario === "context")
  writeFileSync(
    join(project, "notes-local.txt"),
    "Preserve this pre-existing local note.\n",
  );
const beforeStatus = execFileSync("git", ["status", "--porcelain"], {
  cwd: project,
  encoding: "utf8",
});
const beforeDiff = execFileSync("git", ["diff", "HEAD"], {
  cwd: project,
  encoding: "utf8",
});
const model = { model: "openai/gpt-6-sol", thinking: "medium" };
writeFileSync(
  join(log, "models.json"),
  JSON.stringify({
    schema: 1,
    agents: {
      principal: model,
      mecanico: model,
      ordinario: model,
      riesgo: model,
      abierto: model,
    },
  }),
);
writeFileSync(
  join(log, "lang.json"),
  JSON.stringify({ chat: "es", artifacts: "proyecto" }),
);
writeFileSync(
  join(log, "meta.json"),
  JSON.stringify({
    run: id,
    scenario,
    arm,
    sourceCommit: revision,
    directed,
    base_rev: base,
    model,
    prompts: scenario === "context" ? contextPrompts : [prompt],
  }),
);
if (process.env.N_EIN_EVAL_PREPARE_ONLY === "1") {
  console.log(JSON.stringify({ id, revision, project, product }));
  process.exit(0);
}
const env = {
  ...process.env,
  N_EIN_AGENT_DIR: join(homedir(), ".n_ein/preview/pi-agent"),
  N_EIN_MODELS_FILE: join(log, "models.json"),
  N_EIN_LANG_FILE: join(log, "lang.json"),
  N_EIN_TEAM_SESSION_DIR: join(log, "workers"),
  N_EIN_WORKTREE_ROOT: join(bench, "worktrees", id),
  N_EIN_TEAM: arm === "team" ? "1" : "0",
  PI_OFFLINE: "1",
  DO_NOT_TRACK: "1",
};
const out = Bun.file(join(log, "events.jsonl")).writer(),
  err = Bun.file(join(log, "stderr")).writer();
const started = Date.now();
const sessionId = randomUUID();
let meteredParentUsd = 0,
  budgetStopped = false;
const maxUsd = Number(process.env.N_EIN_EVAL_MAX_USD || "2.5");
if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error("invalid budget");
const turns: { prompt: string; seconds: number; exit: number | null }[] = [];
let exit: number | null = null;
for (const currentPrompt of scenario === "context"
  ? contextPrompts
  : [prompt]) {
  const turnStarted = Date.now();
  const child = spawn(
    join(product, "dist/n-ein"),
    [
      "--root",
      product,
      "--project",
      project,
      "--runtime",
      "pi",
      "--",
      "--mode",
      "json",
      "--print",
      "--session-dir",
      join(log, "sessions"),
      "--session-id",
      sessionId,
      currentPrompt +
        (directed && arm === "team"
          ? " En este ensayo usa dos trabajadores en paralelo para T1 (alta de centro y sus consumidores) y T2 (test montado), tras fijar el contrato y dejar la base limpia; tú conserva WORK.md, la documentación, la integración y la comprobación del conjunto. No publiques."
          : ""),
    ],
    { cwd: project, env, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  let meterBuffer = "";
  child.stdout.on("data", (x) => {
    out.write(x);
    meterBuffer += x.toString();
    let end: number;
    while ((end = meterBuffer.indexOf("\n")) >= 0) {
      const line = meterBuffer.slice(0, end);
      meterBuffer = meterBuffer.slice(end + 1);
      try {
        const e = JSON.parse(line);
        if (e.type === "message_end" && e.message?.role === "assistant")
          meteredParentUsd += e.message.usage?.cost?.total || 0;
      } catch {}
    }
  });
  const spending = setInterval(() => {
    const records = join(project, ".git/n_ein/team");
    let childrenUsd = 0;
    if (existsSync(records))
      for (const file of readdirSync(records).filter((f) =>
        f.endsWith(".json"),
      )) {
        try {
          childrenUsd +=
            JSON.parse(readFileSync(join(records, file), "utf8")).cost || 0;
        } catch {}
      }
    if (meteredParentUsd + childrenUsd < maxUsd) return;
    budgetStopped = true;
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {}
  }, 2000);
  child.stderr.on("data", (x) => err.write(x));
  const timeout = setTimeout(() => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {}
  }, 1_200_000);
  exit = await new Promise<number | null>((r, j) => {
    child.once("close", r);
    child.once("error", j);
  });
  clearTimeout(timeout);
  clearInterval(spending);
  turns.push({
    prompt: currentPrompt,
    seconds: (Date.now() - turnStarted) / 1000,
    exit,
  });
  if (exit !== 0 || budgetStopped) break;
}
await out.end();
await err.end();
const modelSeconds = (Date.now() - started) / 1000;
const events = readFileSync(join(log, "events.jsonl"), "utf8")
  .split("\n")
  .flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
const messages = events
  .filter((e) => e.type === "message_end" && e.message?.role === "assistant")
  .map((e) => e.message);
const dir = join(project, ".git/n_ein/team");
const tasks = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
  : [];
const usageOf = (items: any[]) =>
  Object.fromEntries(
    ["input", "output", "cacheRead", "cacheWrite"].map((key) => [
      key,
      items.reduce((n, m) => n + (m.usage?.[key] ?? 0), 0),
    ]),
  );
const childMessages = tasks.flatMap((t) =>
  t.session && existsSync(t.session)
    ? readFileSync(t.session, "utf8")
        .split("\n")
        .flatMap((line) => {
          try {
            const e = JSON.parse(line);
            return e.type === "message" && e.message?.role === "assistant"
              ? [e.message]
              : [];
          } catch {
            return [];
          }
        })
    : [],
);
writeFileSync(
  join(log, "answers.json"),
  JSON.stringify(
    messages.flatMap((m) =>
      (m.content ?? [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => ({ timestamp: m.timestamp, text: c.text })),
    ),
    null,
    2,
  ),
);
const summary = {
  id,
  directed,
  scenario,
  arm,
  revision,
  exit,
  maxUsd,
  budgetStopped,
  modelSeconds,
  turns,
  parentUsage: usageOf(messages),
  childUsage: usageOf(childMessages),
  usage: usageOf([...messages, ...childMessages]),
  childCount: tasks.length,
  tokens:
    messages.reduce(
      (s, m) =>
        s +
        (m.usage?.input ?? 0) +
        (m.usage?.output ?? 0) +
        (m.usage?.cacheRead ?? 0) +
        (m.usage?.cacheWrite ?? 0),
      0,
    ) + tasks.reduce((s, t) => s + t.tokens, 0),
  catalogUsd:
    messages.reduce((s, m) => s + (m.usage?.cost?.total ?? 0), 0) +
    tasks.reduce((s, t) => s + t.cost, 0),
  tasks: tasks.map((t) => ({
    id: t.id,
    mode: t.mode || "write",
    status: t.status,
    tokens: t.tokens,
    cost: t.cost,
    started: t.started,
    ended: t.ended,
    error: t.error,
  })),
  lastText: messages
    .at(-1)
    ?.content?.filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n"),
};
writeFileSync(join(log, "parallel.json"), JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify({
    ...summary,
    lastText: undefined,
    turns: turns.map((t) => ({ seconds: t.seconds, exit: t.exit })),
  }),
);
if (scenario === "context") {
  const unchanged =
    beforeStatus ===
      execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      }) &&
    beforeDiff ===
      execFileSync("git", ["diff", "HEAD"], {
        cwd: project,
        encoding: "utf8",
      }) &&
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: project,
      encoding: "utf8",
    }).trim() === base &&
    readFileSync(join(project, "notes-local.txt"), "utf8") ===
      "Preserve this pre-existing local note.\n";
  writeFileSync(
    join(log, "parallel.json"),
    JSON.stringify(
      {
        ...summary,
        unchanged,
        answerReview: "pending manual review against source",
        acceptance: {
          complete: false,
          reasons: [
            "answer review pending",
            ...(!unchanged ? ["project changed"] : []),
          ],
        },
      },
      null,
      2,
    ),
  );
  process.exit(exit === 0 && unchanged ? 0 : 1);
}
const graded = spawn(join(repo, "evals/bench/grade.sh"), [id], {
  cwd: repo,
  env: { ...process.env, N_EIN_BENCH: bench, N_EIN_REPO: repo },
  stdio: ["ignore", "pipe", "pipe"],
});
let gradeOut = "";
graded.stdout.on("data", (x) => (gradeOut += x));
graded.stderr.on("data", () => {});
await new Promise<void>((r) => graded.once("close", () => r()));
const grade = JSON.parse(readFileSync(join(log, "grade.json"), "utf8"));
const acceptance = acceptanceStatus(scenario, grade);
writeFileSync(
  join(log, "parallel.json"),
  JSON.stringify(
    {
      ...summary,
      secondsToAcceptedResult: (Date.now() - started) / 1000,
      grade,
      acceptance,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ id, acceptance, grade }));
