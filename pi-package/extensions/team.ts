// =============================================================================
// [FLOW] TRABAJO PARALELO POR CONVERSACIÓN
// El modelo decide el reparto; esta extensión ejecuta y conserva los hechos.
// =============================================================================
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TeamManager } from "../agents/manager.ts";
import { type TaskRecord } from "../agents/store.ts";
import { loadModels } from "../models.ts";
import { newJobText } from "../router.ts";
import { teams } from "../agents/runtime.ts";
import { teamLines, taskDetail } from "../agents/view.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export function teamReport(tasks: TaskRecord[], detailed = true) {
  return tasks.map((t) => ({
    id: t.id,
    task: t.taskId,
    label: t.label,
    status: t.status,
    worktree: t.cwd,
    branch: t.branch,
    head: t.head,
    dirty: t.dirty,
    model: t.model,
    thinking: t.thinking,
    attempt: t.attempt,
    tokens: t.usageKnown ? t.tokens : null,
    cost: t.usageKnown ? t.cost : null,
    record:
      t.recordPath || join(dirname(dirname(t.cwd)), "team", `${t.id}.json`),
    result: t.result?.slice(0, detailed ? 12000 : 160),
    resultTruncated: (t.result?.length ?? 0) > (detailed ? 12000 : 160),
    error: t.error,
  }));
}

export default function (pi: ExtensionAPI) {
  if (process.env.N_EIN_CHILD === "1") return;
  let team: TeamManager | undefined,
    ctx: ExtensionContext | undefined,
    suspended = false,
    background = false;
  let recoveryNotice = false;
  let paintTimer: ReturnType<typeof setTimeout> | undefined;
  let clock: ReturnType<typeof setInterval> | undefined;
  const repaint = () => {
    if (paintTimer || !ctx?.hasUI || ctx.mode !== "tui") return;
    paintTimer = setTimeout(() => {
      paintTimer = undefined;
      try {
        ctx?.ui.setWidget(
          "n-ein-team",
          team?.list().length
            ? () => ({
                render: (width: number) => teamLines(team?.list() ?? [], width),
                invalidate() {},
              })
            : undefined,
          { placement: "aboveEditor" },
        );
      } catch {}
    }, 150);
  };
  const initialize = async (next: ExtensionContext) => {
    suspended = true;
    if (team) await team.shutdown();
    if (team) teams.delete(team.store.origin);
    ctx = next;
    recoveryNotice = false;
    team = undefined;
    background = false;
    try {
      const owner = next.sessionManager.getSessionId();
      team = new TeamManager({
        root,
        cwd: next.cwd,
        owner,
        onChange: repaint,
        onResult: (task) => {
          if (
            suspended ||
            !background ||
            !ctx ||
            ctx.sessionManager.getSessionId() !== owner
          )
            return;
          const key = `${task.id}:${task.attempt}`;
          const seen = ctx.sessionManager
            .getBranch()
            .some(
              (e: any) =>
                e.type === "custom_message" &&
                e.customType === "nein.team.result" &&
                e.details?.key === key,
            );
          if (!seen)
            pi.sendMessage(
              {
                customType: "nein.team.result",
                content: JSON.stringify(teamReport([task])),
                display: true,
                details: { key },
              },
              { deliverAs: "steer", triggerTurn: true },
            );
          team!.store.update(task.id, { delivered: true });
        },
      });
      team.recover();
      teams.set(team.store.origin, team);
      suspended = false;
    } catch (error) {
      if (team)
        next.ui.notify(
          `Equipo no disponible: ${String(error)}. Conserva el trabajo y continúa directamente.`,
          "warning",
        );
      team = undefined;
    }
  };
  pi.on("session_start", async (_event, next) => {
    await initialize(next);
    if (clock) clearInterval(clock);
    clock = setInterval(() => {
      if (team?.list().some((t) => t.status === "running")) repaint();
    }, 1000);
    clock.unref();
  });
  pi.on("session_shutdown", async () => {
    if (paintTimer) clearTimeout(paintTimer);
    paintTimer = undefined;
    if (clock) clearInterval(clock);
    suspended = true;
    await team?.shutdown();
    if (team) teams.delete(team.store.origin);
  });
  pi.on("session_before_switch", async () => {
    suspended = true;
    await team?.shutdown();
  });
  pi.on("session_before_fork", async () => {
    suspended = true;
    await team?.shutdown();
  });
  pi.on("input", async (event) => {
    if (newJobText(event.text) !== undefined) {
      suspended = true;
      await team?.shutdown();
    }
  });

  const showTeam = async (next: ExtensionContext) => {
    if (!team || !next.hasUI) return;
    const tasks = team.list();
    const choices = tasks.map((t) => `${t.label} · ${t.status}`);
    const chosen = await next.ui.select(
      "Equipo · selecciona para ver o detener",
      [...choices, "Detener todos", "Trabajar sin ayudantes"],
    );
    if (chosen === "Detener todos") await team.stop();
    else if (chosen === "Trabajar sin ayudantes") await team.setLimit(0);
    else {
      const t = tasks[choices.indexOf(chosen ?? "")];
      if (t) {
        const action = await next.ui.select(t.label, [
          "Ver detalle",
          ...(t.status === "running" || t.status === "queued"
            ? ["Detener"]
            : []),
        ]);
        if (action === "Detener") await team.stop(t.id);
        if (action === "Ver detalle")
          await next.ui.editor(t.label, taskDetail(t));
      }
    }
    repaint();
  };
  pi.registerCommand("nein:equipo", {
    description: "Ver el equipo y detener trabajadores",
    handler: async (_args, next) => showTeam(next),
  });
  pi.registerShortcut("ctrl+shift+g", {
    description: "Ver equipo",
    handler: showTeam,
  });
  pi.on("before_agent_start", () => {
    if (recoveryNotice) return;
    const pending = team?.list().filter((t) => t.status !== "integrated") ?? [];
    if (!pending.length) return;
    recoveryNotice = true;
    return {
      message: {
        customType: "nein.team.recovery",
        content:
          "Existing team assignments (not new authorization): " +
          JSON.stringify(
            pending.map((t) => ({
              id: t.id,
              task: t.taskId,
              status: t.status,
              worktree: t.cwd,
              branch: t.branch,
            })),
          ),
        display: false,
      },
    };
  });

  if (process.env.N_EIN_TEAM === "0") return;
  pi.registerTool({
    name: "nein_team",
    label: "Equipo",
    description:
      "Manage general-purpose Pi workers for an AUTHORIZED implementation. Delegate only substantial independent tasks with a committed common base and WORK.md. At most two workers run, each in a separate worktree. Prefer direct work for small/dependent tasks. Start takes taskId, label, full bounded assignment with acceptance and relevant context, and class. Results are ready for coordinator review and integration, NOT overall acceptance. status recovers results; resume preserves partial work and its model; supply class only for a deliberate capability change; integrate merges only an owned clean ready branch into the work branch. stop preserves changes. limit=0 means work alone. No recursive workers, remote delivery or new authorization. In interactive sessions results arrive automatically; do not poll.",
    parameters: Type.Object({
      action: Type.Union(
        [
          "start",
          "status",
          "stop",
          "resume",
          "steer",
          "integrate",
          "limit",
          "view",
        ].map((x) => Type.Literal(x)),
      ),
      tasks: Type.Optional(
        Type.Array(
          Type.Object({
            taskId: Type.String({ minLength: 1, maxLength: 120 }),
            label: Type.String({ minLength: 1, maxLength: 120 }),
            prompt: Type.String({ minLength: 1 }),
            class: Type.Union(
              (["mecanico", "ordinario", "riesgo", "abierto"] as const).map(
                (x) => Type.Literal(x),
              ),
            ),
            dependsOn: Type.Optional(Type.Array(Type.String())),
          }),
        ),
      ),
      class: Type.Optional(
        Type.Union(
          (["mecanico", "ordinario", "riesgo", "abierto"] as const).map((x) =>
            Type.Literal(x),
          ),
        ),
      ),
      id: Type.Optional(Type.String()),
      message: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
    }),
    async execute(_id, params, signal, _update, next) {
      try {
        if (!team || suspended) {
          await initialize(next);
        }
        ctx = next;
        if (!team)
          throw new Error(
            "Team unavailable: inspect Git/work records and continue directly.",
          );
        background = next.mode === "tui" || next.mode === "rpc";
        let selected: string[] | undefined = params.id
          ? [params.id]
          : undefined;
        const waitForWorkers = async () => {
          if (background) return;
          const current = team!;
          const stop = () => {
            void current.stop();
          };
          signal?.addEventListener("abort", stop, { once: true });
          if (signal?.aborted) stop();
          try {
            await current.wait();
          } finally {
            signal?.removeEventListener("abort", stop);
          }
        };
        const chooseModel = (
          clase: "mecanico" | "ordinario" | "riesgo" | "abierto",
        ) =>
          next.model && next.model.provider !== "nein"
            ? {
                model: `${next.model.provider}/${next.model.id}`,
                thinking: next.thinkingLevel ?? "medium",
              }
            : loadModels(root).routing[clase];
        if (params.action === "start") {
          const tasks = (params.tasks ?? []).map((t) => {
            const chosen = chooseModel(t.class);
            return {
              taskId: t.taskId,
              label: t.label,
              prompt: t.prompt,
              dependsOn: t.dependsOn,
              ...chosen,
            };
          });
          selected = team.start(tasks).map((t) => t.id);
          await waitForWorkers();
        } else if (params.action === "view") await showTeam(next);
        else if (params.action === "stop") await team.stop(params.id);
        else if (params.action === "limit")
          await team.setLimit(params.limit ?? 0);
        else if (params.action === "status") team.recover();
        else {
          if (!params.id) throw new Error("Task identity required.");
          if (params.action === "integrate") team.integrate(params.id);
          else if (params.action === "steer")
            await team.steer(
              params.id,
              params.message || "Report current blocker.",
            );
          else if (params.action === "resume") {
            team.resume(
              params.id,
              params.message || "Continue the preserved assignment.",
              params.class ? chooseModel(params.class) : undefined,
            );
            await waitForWorkers();
          }
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                teamReport(
                  selected
                    ? team.list().filter((t) => selected!.includes(t.id))
                    : team.list().filter((t) => t.status !== "integrated"),
                  Boolean(selected),
                ),
              ),
            },
          ],
          details: undefined,
        };
      } catch (e) {
        let assignments: ReturnType<typeof teamReport> = [];
        try {
          assignments = teamReport(
            team?.list().filter((t) => t.status !== "integrated") ?? [],
            false,
          );
        } catch {}
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: String(e), assignments }),
            },
          ],
          details: undefined,
        };
      }
    },
  });
}
