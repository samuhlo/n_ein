// =============================================================================
// [CORE] EQUIPO DE UN ENCARGO
// Las tareas pertenecen al proyecto; los procesos pertenecen a una sesión.
// Reanudar exige reconciliar ambos, no reconstruir un proceso desde un PID viejo.
// =============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { memoryDirective } from "../memory.ts";
import { langDirective, loadLang } from "../lang.ts";
import { loadModels } from "../models.ts";
import { startWorker } from "./rpc.ts";
import {
  TeamStore,
  git,
  taskLease,
  taskFinished,
  type Assignment,
  type TaskRecord,
} from "./store.ts";

export type TeamOptions = {
  root: string;
  cwd: string;
  owner: string;
  onChange?(): void;
  onResult?(task: TaskRecord): void;
  host?: string;
  env?: NodeJS.ProcessEnv;
};
export class TeamManager {
  readonly store: TeamStore;
  readonly host: string;
  private live = new Map<string, ReturnType<typeof startWorker>>();
  private closing = false;
  private quarantined = new Set<string>();
  private owned = new Set<string>();
  private limit = 2;
  private activity = new Map<string, string>();
  constructor(readonly options: TeamOptions) {
    this.store = new TeamStore(options.cwd);
    this.host =
      options.host ??
      (existsSync(join(options.root, "bin/n-ein"))
        ? join(options.root, "bin/n-ein")
        : join(options.root, "dist/n-ein"));
  }
  get isClosing() {
    return this.closing;
  }
  private changed() {
    try {
      this.options.onChange?.();
    } catch {
      /* Un fallo visual no cancela trabajo. */
    }
  }
  list() {
    return this.store.list().map((t) => ({
      ...t,
      activity: this.activity.get(t.id) || t.activity,
      activeHere: this.live.has(t.id),
    }));
  }
  free(cwd: string, project = cwd) {
    try {
      execFileSync(
        this.host,
        ["--worker-probe", "--project", cwd, "--worker-cwd", project],
        {
          stdio: "pipe",
          timeout: 3000,
          env: { ...process.env, N_EIN_LEASE_FD: "" },
        },
      );
      return true;
    } catch {
      return false;
    }
  }
  recover() {
    for (const t of this.store.list()) {
      if (this.live.has(t.id) || this.owned.has(t.id)) continue;
      if (existsSync(t.cwd) && !this.free(taskLease(t), t.cwd)) {
        if (!taskFinished(t)) this.quarantined.add(t.id);
        continue;
      }
      this.quarantined.delete(t.id);
      if (["running", "queued"].includes(t.status)) {
        try {
          this.store.snapshot(t.id);
        } catch {
          /* Conservar también un árbol ausente. */
        }
        this.store.update(t.id, {
          status: "interrupted",
          error:
            "Previous execution stopped; inspect preserved work and resume explicitly.",
        });
      } else if (t.mode !== "read" && !taskFinished(t) && existsSync(t.cwd)) {
        // Claude puede haber integrado el frente en el relevo. Git acredita
        // la integración; la aceptación sigue perteneciendo a WORK.md.
        try {
          this.store.validateTree(t);
          const head = git(t.cwd, "rev-parse", "HEAD");
          if (head !== t.base && !git(t.cwd, "status", "--porcelain")) {
            git(this.store.origin, "merge-base", "--is-ancestor", head, "HEAD");
            this.store.update(t.id, { status: "integrated", head });
          }
        } catch {
          /* Una rama no integrada permanece pendiente. */
        }
      }
    }
    this.changed();
  }
  start(tasks: Omit<Assignment, "owner">[]) {
    if (this.closing || this.limit === 0)
      throw new Error(
        "Team is stopped; continue directly or explicitly enable workers.",
      );
    if (!existsSync(this.host))
      throw new Error(
        "Worker host missing; build or repair the n_ein package.",
      );
    if (tasks.length < 1 || tasks.length > 8)
      throw new Error(
        "Assign between one and eight tasks; at most two run together.",
      );
    const created: TaskRecord[] = [];
    try {
      for (const task of tasks) {
        const record = this.store.create({
          ...task,
          owner: this.options.owner,
        });
        created.push(record);
        this.owned.add(record.id);
      }
    } finally {
      this.pump();
      this.changed();
    }
    return created;
  }
  resume(
    id: string,
    instruction: string,
    model?: { model: string; thinking: string },
  ) {
    if (this.closing || this.limit === 0)
      throw new Error("Workers are disabled.");
    const t = this.store.get(id);
    this.store.validateTree(t);
    if (this.live.has(id) || !this.free(taskLease(t), t.cwd))
      throw new Error("Task still has a writer; do not replace it.");
    if (t.status === "integrated")
      throw new Error("Task already integrated; assign new work separately.");
    this.owned.add(id);
    this.activity.set(id, instruction);
    this.store.update(id, {
      status: "queued",
      ...(model ?? {}),
      owner: this.options.owner,
      error: undefined,
      delivered: false,
    });
    this.pump();
  }
  private pump() {
    if (this.closing) return;
    for (const t of this.store
      .list()
      .filter((t) => t.status === "queued" && this.owned.has(t.id))) {
      if (this.live.size + this.quarantined.size >= this.limit) break;
      try {
        this.launch(t);
      } catch (e) {
        this.store.update(t.id, { status: "failed", error: String(e) });
        this.changed();
      }
    }
  }
  private launch(t: TaskRecord) {
    this.store.validateTree(t);
    if (!this.free(taskLease(t), t.cwd))
      throw new Error("Worktree is already owned.");
    const { root } = this.options;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...this.options.env,
      N_EIN_WORKER_HOST: this.host,
      N_EIN_CHILD: "1",
      N_EIN_ASSIGNMENT_MODE: t.mode || "write",
    };
    delete env.N_EIN_HANDOFF_SIGNAL;
    delete env.N_EIN_WORK_DOC;
    delete env.N_EIN_LEASE_FD;
    const document = t.workDoc || join(t.origin, "WORK.md");
    const documentRelative = relative(t.origin, document);
    env.N_EIN_WORKER_DOCUMENT =
      documentRelative === ".." || documentRelative.startsWith("../")
        ? ""
        : join(t.cwd, documentRelative);
    const models = loadModels(root);
    const agentHome =
      env.PI_CODING_AGENT_DIR ||
      env.N_EIN_AGENT_DIR ||
      join(
        env.N_EIN_HOME || join(homedir(), ".n_ein"),
        env.N_EIN_CHANNEL || "dev",
        "pi-agent",
      );
    env.PI_CODING_AGENT_DIR = agentHome;
    env.PI_SKIP_VERSION_CHECK = "1";
    env.DO_NOT_TRACK = "1";
    const sessions =
      env.N_EIN_TEAM_SESSION_DIR || join(agentHome, "team-sessions");
    mkdirSync(sessions, { recursive: true, mode: 0o700 });
    const session = t.session || join(sessions, `${t.id}.jsonl`);
    const binary =
      env.N_EIN_PI_BIN ||
      join(
        env.N_EIN_HOME || join(homedir(), ".n_ein"),
        "runtimes/pi",
        models.version,
        "bin/pi",
      );
    if (!t.model.includes("/") || t.model.startsWith("nein/"))
      throw new Error("A worker requires a physical provider/model.");
    const instruction = this.activity.get(t.id) || "";
    const args = [
      "--mode",
      "rpc",
      "--tools",
      (t.mode === "read"
        ? "read,grep,find,ls"
        : "read,write,edit,bash,grep,find,ls") +
        (env.N_EIN_CODEGRAPH_BIN ? ",codegraph_explore" : ""),
      "--no-extensions",
      "--no-skills",
      "--no-themes",
      "--no-prompt-templates",
      "-e",
      join(root, "pi-package/agents/child.ts"),
      "-e",
      join(root, "pi-package/extensions/codegraph.ts"),
      "--skill",
      join(root, "pi-package/skills"),
      "--model",
      t.model,
      "--thinking",
      t.thinking,
      "--session",
      session,
      "--append-system-prompt",
      join(root, "pi-package/persona.md"),
      "--append-system-prompt",
      join(
        root,
        t.mode === "read"
          ? "pi-package/agents/reader.md"
          : "pi-package/agents/worker.md",
      ),
      "--append-system-prompt",
      langDirective(loadLang(root)),
      "--append-system-prompt",
      memoryDirective(),
    ];
    const prompt = [
      `Authorized assignment ${t.taskId}: ${t.label}`,
      t.prompt,
      t.mode === "read"
        ? `Read the current files in ${t.origin}. Starting HEAD: ${t.base}; local edits may exist or change during your investigation. Identify the paths and evidence you actually read.`
        : `Your branch: ${t.branch}. Base: ${t.base}.`,
      t.workDoc
        ? `The coordinator owns the active work document at ${document}; read only the relevant requirements, decisions and task. Do not edit either copy.`
        : "",
      existsSync(join(t.origin, "AGENTS.md"))
        ? `Also read project instructions at ${join(t.origin, "AGENTS.md")}; preserve those conventions in your worktree.`
        : "",
      t.mode === "read"
        ? "Investigate only the assigned question. Return concise findings, path:line evidence, uncertainties and the next useful action. Do not implement, install, run checks or create a plan. If blocked by a product decision, return BLOCKED: with the question."
        : "Implement only this assignment, check its behaviour and commit your own changes on this branch. Report changes, checks, remaining issues and the commit. Do not merge or publish. If blocked by a product decision, return BLOCKED: with the question; do not guess.",
      instruction ? `Continuation: ${instruction}` : "",
    ].join("\n\n");
    this.store.update(t.id, {
      status: "running",
      attempt: t.attempt + 1,
      session,
      error: undefined,
      delivered: false,
      started: new Date().toISOString(),
      ended: undefined,
    });
    let liveTokens = t.tokens,
      liveCost = t.cost;
    const run = startWorker({
      host: this.host,
      cwd: t.cwd,
      leaseCwd: taskLease(t),
      binary,
      args,
      prompt,
      env,
      onEvent: (event) => {
        if (event.type === "tool_execution_start") {
          this.activity.set(t.id, event.toolName);
          this.store.update(t.id, { activity: event.toolName });
        }
        if (event.type === "tool_execution_end")
          this.activity.set(t.id, "working");
        if (
          event.type === "message_end" &&
          event.message?.role === "assistant" &&
          event.message.usage
        ) {
          const u = event.message.usage;
          liveTokens +=
            (u.input ?? 0) +
            (u.output ?? 0) +
            (u.cacheRead ?? 0) +
            (u.cacheWrite ?? 0);
          liveCost += u.cost?.total ?? 0;
          this.store.update(t.id, {
            tokens: liveTokens,
            cost: liveCost,
            usageKnown: true,
          });
        }
        this.changed();
      },
    });
    this.live.set(t.id, run);
    void run.done
      .then((result) => {
        this.live.delete(t.id);
        if (result.error?.includes("exit unconfirmed"))
          this.quarantined.add(t.id);
        this.activity.delete(t.id);
        try {
          this.store.snapshot(t.id);
          const saved = this.store.update(t.id, {
            status:
              result.status === "ready" && /^BLOCKED:/im.test(result.text)
                ? "blocked"
                : result.status === "ready" && t.mode === "read"
                  ? "complete"
                  : result.status,
            ended: new Date().toISOString(),
            result: result.text,
            error: result.error,
            tokens: t.tokens + result.tokens,
            cost: t.cost + result.cost,
            usageKnown: t.usageKnown || result.usageKnown,
          });
          this.changed();
          if (!this.closing) this.options.onResult?.(saved);
        } catch (e) {
          console.error(`[ERR] :: TEAM_SAVE :: reason: ${String(e)}`);
        }
        this.pump();
      })
      .catch((error) =>
        console.error(`[ERR] :: TEAM_STATE :: reason: ${String(error)}`),
      );
    this.changed();
  }
  async wait() {
    while (this.live.size)
      await Promise.all([...this.live.values()].map((t) => t.done));
    return this.list();
  }
  async waitForResult() {
    if (this.live.size)
      await Promise.race([...this.live.values()].map((task) => task.done));
  }
  async steer(id: string, message: string) {
    const run = this.live.get(id);
    if (!run)
      throw new Error("Task is not running; use resume with the instruction.");
    await run.steer(message);
  }
  async stop(id?: string) {
    // El registro puede fallar; la propiedad de procesos vive en memoria y
    // siempre permite detener los hijos que este coordinador abrió.
    const active = id ? [id] : [...this.live.keys()];
    try {
      for (const task of this.store.list())
        if (
          (!id || task.id === id) &&
          task.owner === this.options.owner &&
          task.status === "queued"
        )
          this.store.update(task.id, { status: "stopped" });
    } catch {
      console.error(
        "[WARN] :: TEAM_STATE :: record unavailable; stopping owned processes",
      );
    }
    await Promise.all(active.map((key) => this.live.get(key)?.stop()));
    this.changed();
  }
  async setLimit(limit: number) {
    this.limit = limit;
    const ids = [...this.live.keys()].slice(limit);
    for (const id of ids) await this.stop(id);
    if (limit === 0) await this.stop();
    else this.pump();
  }
  async shutdown() {
    this.closing = true;
    await this.stop();
  }
  integrate(id: string) {
    const t = this.store.get(id);
    if (!this.free(taskLease(t), t.cwd))
      throw new Error("Worker tree still owned.");
    const value = this.store.integrate(id);
    this.changed();
    return value;
  }
}
