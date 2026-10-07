// =============================================================================
// [DATA] ASIGNACIONES RECUPERABLES
// WORK.md conserva la aceptación. Este registro guarda identidad y resultados
// de ejecución, fuera del paquete y de los árboles que cambian los trabajadores.
// =============================================================================
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { resolveWorkDoc } from "../extensions/work-doc.ts";

export type TaskStatus =
  | "queued"
  | "running"
  | "ready"
  | "blocked"
  | "failed"
  | "stopped"
  | "interrupted"
  | "complete"
  | "integrated";
export type Assignment = {
  mode?: "read" | "write";
  taskId: string;
  label: string;
  prompt: string;
  model: string;
  thinking: string;
  owner: string;
  dependsOn?: string[];
};
// Los lectores bloquean su propia ejecución, nunca el árbol del escritor.
export function taskLease(task: TaskRecord): string {
  return task.mode === "read" ? join(task.workspaceRoot!, task.id) : task.cwd;
}
export function taskFinished(task: TaskRecord): boolean {
  return task.status === "integrated" || task.status === "complete";
}
export function taskPending(task: TaskRecord): boolean {
  return !taskFinished(task) || (task.status === "complete" && !task.delivered);
}
export type TaskRecord = Assignment & {
  schema: 1;
  id: string;
  origin: string;
  cwd: string;
  workDoc?: string;
  workspaceRoot?: string;
  recordPath?: string;
  branch: string;
  base: string;
  created: string;
  status: TaskStatus;
  attempt: number;
  session?: string;
  result?: string;
  error?: string;
  head?: string;
  dirty?: string;
  tokens: number;
  cost: number;
  usageKnown: boolean;
  delivered?: boolean;
  updated: string;
  activity?: string;
  started?: string;
  ended?: string;
};
export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function observedHead(cwd: string, reading: boolean): string {
  try {
    return git(cwd, "rev-parse", "--verify", "--quiet", "HEAD");
  } catch (error) {
    // Leer no obliga a confirmar cambios. Otros errores de Git se conservan.
    if (reading && (error as { status?: number }).status === 1) return "";
    throw error;
  }
}
function writeAtomic(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  renameSync(temp, path);
}

export class TeamStore {
  readonly origin: string;
  readonly common: string;
  readonly dir: string;
  constructor(cwd: string) {
    this.origin = realpathSync(git(cwd, "rev-parse", "--show-toplevel"));
    this.common = realpathSync(
      git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    );
    this.dir = join(this.common, "n_ein", "team");
  }
  private file(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("invalid task identity");
    return join(this.dir, `${id}.json`);
  }
  get(id: string): TaskRecord {
    const record = JSON.parse(readFileSync(this.file(id), "utf8"));
    if (
      record.schema !== 1 ||
      record.id !== id ||
      record.origin !== this.origin ||
      ![undefined, "read", "write"].includes(record.mode) ||
      (record.workspaceRoot !== undefined &&
        (typeof record.workspaceRoot !== "string" ||
          !isAbsolute(record.workspaceRoot))) ||
      (record.mode === "read"
        ? record.cwd !== this.origin ||
          record.branch !== "" ||
          !record.workspaceRoot
        : record.cwd !==
            join(
              record.workspaceRoot ?? join(this.common, "n_ein", "worktrees"),
              id,
            ) ||
          record.cwd === this.origin ||
          record.branch !== `nein/task-${id}`) ||
      (record.status === "complete" && record.mode !== "read") ||
      typeof record.taskId !== "string" ||
      typeof record.base !== "string" ||
      (!(record.mode === "read" && record.base === "") &&
        !/^[a-f0-9]{40,64}$/.test(record.base)) ||
      ![
        "queued",
        "running",
        "ready",
        "blocked",
        "failed",
        "stopped",
        "interrupted",
        "integrated",
        "complete",
      ].includes(record.status)
    )
      throw new Error(`invalid team record: ${id}; preserve it for recovery`);
    return { ...record, recordPath: this.file(id) };
  }
  list(): TaskRecord[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((x) => x.endsWith(".json"))
      .flatMap((file) => {
        const raw = JSON.parse(readFileSync(join(this.dir, file), "utf8"));
        return raw.origin === this.origin ? [this.get(file.slice(0, -5))] : [];
      })
      .sort((a, b) => a.created.localeCompare(b.created));
  }
  update(
    id: string,
    change: Partial<
      Pick<
        TaskRecord,
        | "model"
        | "thinking"
        | "status"
        | "owner"
        | "attempt"
        | "session"
        | "result"
        | "error"
        | "head"
        | "dirty"
        | "tokens"
        | "cost"
        | "usageKnown"
        | "delivered"
        | "activity"
        | "started"
        | "ended"
      >
    >,
  ) {
    const record = {
      ...this.get(id),
      ...change,
      updated: new Date().toISOString(),
    };
    writeAtomic(this.file(id), record);
    return record;
  }
  create(input: Assignment): TaskRecord {
    const reading = input.mode === "read";
    if (!reading && git(this.origin, "status", "--porcelain"))
      throw new Error(
        "Coordinator tree must be clean before assigning work; preserve existing changes and work directly until a committed base is available.",
      );
    const workDoc = resolveWorkDoc(this.origin) ?? undefined;
    if (!reading && !workDoc)
      throw new Error(
        "Record the authorized tasks in WORK.md before delegating.",
      );
    const records = this.list();
    if (records.some((t) => t.taskId === input.taskId && taskPending(t)))
      throw new Error(`task already assigned: ${input.taskId}`);
    for (const dep of input.dependsOn ?? [])
      if (!records.some((t) => t.id === dep && taskFinished(t)))
        throw new Error(
          `dependency assignment not integrated: ${dep}; use the returned assignment id`,
        );
    // Vite niega servir archivos bajo .git. Solo el registro vive allí.
    const repositoryKey = createHash("sha256")
      .update(this.common)
      .digest("hex")
      .slice(0, 16);
    const storage = resolve(
      process.env.N_EIN_WORKTREE_ROOT ||
        join(
          process.env.N_EIN_HOME || join(homedir(), ".n_ein"),
          "worktrees",
          repositoryKey,
        ),
    );
    mkdirSync(storage, { recursive: true, mode: 0o700 });
    const workspaceRoot = realpathSync(storage);
    if (workspaceRoot.split(/[\\/]/).includes(".git"))
      throw new Error(
        "Worker storage must be outside .git for build-tool compatibility.",
      );
    const id = randomUUID(),
      base = observedHead(this.origin, reading),
      cwd = reading ? this.origin : join(workspaceRoot, id),
      branch = reading ? "" : `nein/task-${id}`;
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const created = new Date().toISOString();
    const record: TaskRecord = {
      ...input,
      schema: 1,
      id,
      origin: this.origin,
      cwd,
      workspaceRoot,
      workDoc,
      recordPath: this.file(id),
      branch,
      base,
      created,
      updated: created,
      status: "queued",
      attempt: 0,
      tokens: 0,
      cost: 0,
      usageKnown: false,
    };
    // El registro precede a Git: incluso un fallo al crear el worktree es recuperable.
    writeAtomic(this.file(id), record);
    try {
      if (reading)
        mkdirSync(taskLease(record), { recursive: true, mode: 0o700 });
      else git(this.origin, "worktree", "add", "-b", branch, cwd, base);
    } catch (e) {
      this.update(id, { status: "failed", error: String(e) });
      throw e;
    }
    return record;
  }
  validateTree(task: TaskRecord) {
    if (
      realpathSync(
        git(
          task.cwd,
          "rev-parse",
          "--path-format=absolute",
          "--git-common-dir",
        ),
      ) !== this.common ||
      (task.mode !== "read" &&
        git(task.cwd, "branch", "--show-current") !== task.branch)
    )
      throw new Error(
        "Worker worktree identity changed; inspect it before continuing.",
      );
  }
  snapshot(id: string) {
    const t = this.get(id);
    this.validateTree(t);
    return this.update(id, {
      head: observedHead(t.cwd, t.mode === "read"),
      dirty: git(t.cwd, "status", "--porcelain"),
    });
  }
  integrate(id: string) {
    const t = this.get(id);
    if (t.mode === "read")
      throw new Error(
        "A read-only result has no branch to integrate; use its evidence or resume with a follow-up.",
      );
    if (t.status !== "ready")
      throw new Error("Only a ready result can be integrated.");
    this.validateTree(t);
    if (
      git(this.origin, "status", "--porcelain") ||
      git(t.cwd, "status", "--porcelain")
    )
      throw new Error(
        "Both trees must be clean; preserve and finish uncommitted changes first.",
      );
    const branch = git(this.origin, "branch", "--show-current");
    if (!branch || ["main", "master"].includes(branch))
      throw new Error(
        "Integrate on the authorized work branch, not the default branch.",
      );
    const head = git(t.cwd, "rev-parse", "HEAD");
    if (t.head && t.head !== head)
      throw new Error("Worker HEAD changed since the recorded result.");
    git(t.cwd, "merge-base", "--is-ancestor", t.base, head);
    try {
      git(this.origin, "merge-base", "--is-ancestor", t.base, "HEAD");
    } catch {
      throw new Error(
        "Coordinator left the assigned base; reconcile the preserved branch before integration.",
      );
    }
    // Solo el coordinador fusiona. Un conflicto queda visible, nunca se resetea.
    git(this.origin, "merge", "--no-edit", head);
    return this.update(id, { status: "integrated", head });
  }
}
