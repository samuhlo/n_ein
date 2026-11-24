// =============================================================================
// [FLOW] VOLVER A LA SESIÓN CON N_EIN
// Al salir, Pi y Claude imprimen su comando para retomar, que abre el runtime sin n_ein (otro
// hogar, sin paquete). Los lanzadores imprimen debajo el de n_ein, con el proyecto incluido para
// copiarlo desde cualquier carpeta. El runtime deja el id de la sesión vigente en un archivo.
// Uso: bun resume.ts <pi|claude> <archivo-del-id> <proyecto> <lanzador> [<hogar-de-claude>]
// =============================================================================

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ResumeRuntime = "pi" | "claude";
/** `nein` (en PATH o por ruta) acepta proyecto y runtime; el lanzador de un checkout, solo su carpeta. */
export type ResumeLauncher = { kind: "nein"; command: string } | { kind: "shell"; path: string };

// Los ids de Pi y Claude son UUID: lo demás no se pega en una orden de shell.
const SESSION_ID = /^[A-Za-z0-9-]+$/;
const PLAIN_WORD = /^[A-Za-z0-9_./:=@%+,-]+$/;
const RUNTIME_NAME: Record<ResumeRuntime, string> = { pi: "Pi", claude: "Claude" };
const INSTALLED = new Set(["preview", "stable"]);

function shellWord(value: string): string {
  return PLAIN_WORD.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

function canonical(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

function installedChannel(packageRoot: string): string {
  try {
    return readFileSync(join(packageRoot, ".n-ein-channel"), "utf8").split("\n")[0] ?? "";
  } catch {
    return "";
  }
}

export function resumeLauncher(packageRoot: string, neinOnPath: string | undefined, launcher: string): ResumeLauncher {
  const own = join(packageRoot, "bin/nein");
  const ownReal = canonical(own);
  if (ownReal && neinOnPath && canonical(neinOnPath) === ownReal) return { kind: "nein", command: "nein" };
  // bin/nein solo arranca una instalación preview o estable: un checkout, o el canal dev, vuelve por
  // el lanzador que usó.
  if (ownReal && INSTALLED.has(installedChannel(packageRoot))) return { kind: "nein", command: own };
  return { kind: "shell", path: launcher };
}

export function resumeCommand(runtime: ResumeRuntime, id: string, project: string, launcher: ResumeLauncher): string {
  const session = runtime === "pi" ? `--session ${id}` : `--resume ${id}`;
  if (launcher.kind === "shell") return `cd ${shellWord(project)} && ${shellWord(launcher.path)} ${session}`;
  return `${shellWord(launcher.command)} --project ${shellWord(project)} --runtime ${runtime} -- ${session}`;
}

/** La sesión que dejó el runtime, solo si está guardada en disco: sin ella no hay nada que retomar. */
export function resumeSession(runtime: ResumeRuntime, record: string, claudeDir: string): { id: string } | undefined {
  const [id = "", file = ""] = record.split("\n");
  if (!SESSION_ID.test(id)) return undefined;
  if (runtime === "pi") return file && existsSync(file) ? { id } : undefined;
  const projects = join(claudeDir, "projects");
  if (!existsSync(projects)) return undefined;
  const saved = readdirSync(projects, { withFileTypes: true })
    .some((entry) => entry.isDirectory() && existsSync(join(projects, entry.name, `${id}.jsonl`)));
  return saved ? { id } : undefined;
}

export function resumeHint(runtime: ResumeRuntime, command: string): string[] {
  return [`Para volver con n_ein (el comando de arriba abre ${RUNTIME_NAME[runtime]} sin n_ein):`, command];
}

if (import.meta.main) {
  const [runtime, recordPath = "", project = "", launcher = "", claudeDir = ""] = process.argv.slice(2);
  if (runtime !== "pi" && runtime !== "claude") process.exit(64);
  const record = existsSync(recordPath) ? readFileSync(recordPath, "utf8") : "";
  const session = resumeSession(runtime, record, claudeDir);
  if (session) {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const how = resumeLauncher(packageRoot, Bun.which("nein") ?? undefined, launcher);
    const [label, command] = resumeHint(runtime, resumeCommand(runtime, session.id, project, how));
    // Como la pista de Pi: la explicación atenuada y la orden sola en su línea, para seleccionarla entera.
    process.stdout.write(`\x1b[2m${label}\x1b[0m\n${command}\n`);
  }
}
