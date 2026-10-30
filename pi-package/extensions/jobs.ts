// [UI] PROCESOS EN PI
// El resultado se entrega una vez; la salida completa permanece en el log.
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { channelDir } from "../models.ts";
import { jobExecutor } from "./jobs-tools.ts";
import { Jobs, ownJobs, stopSessionJobs, type Notice } from "./jobs-core.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export default function (pi: ExtensionAPI) {
  let jobs: Jobs | undefined,
    owner: string | undefined,
    context: ExtensionContext | undefined;
  const refresh = () => {
    if (!context?.hasUI) return;
    const running = jobs?.list().filter((j) => j.status === "running") ?? [];
    context.ui.setStatus(
      "nein-jobs",
      running.length
        ? `${running.length} procesos · /nein:procesos`
        : undefined,
    );
  };
  const notify = ({ job, kind, lines }: Notice) => {
    const content = `${kind === "lines" ? "Monitor" : "Proceso"}: ${job.label}\nEstado: ${job.status}; exit: ${job.exit ?? "desconocido"}${job.reason ? `; ${job.reason}` : ""}\nLog: ${job.log}\n${lines.join("\n")}`;
    pi.sendMessage(
      {
        customType: "nein-job",
        content,
        display: true,
        details: { job: job.id, kind },
      },
      { triggerTurn: true, deliverAs: "followUp" },
    );
    if (kind === "result" && context?.hasUI)
      context.ui.notify(
        `${job.label}: ${job.status}`,
        job.status === "failed" ? "warning" : "info",
      );
  };
  const get = async (ctx: ExtensionContext) => {
    const id = ctx.sessionManager.getSessionId();
    if (!id) throw new Error("Sesión sin identidad; usa bash normal.");
    if (owner !== id || jobs?.closed) {
      if (owner) await stopSessionJobs(owner);
      jobs = new Jobs(
        join(channelDir(root), "jobs", encodeURIComponent(id)),
        async () => {
          throw new Error(
            "El proceso necesita el contexto nativo de su llamada.",
          );
        },
        notify,
        refresh,
      );
      owner = id;
      ownJobs(id, jobs);
    }
    context = ctx;
    return jobs!;
  };
  pi.registerTool({
    name: "nein_job",
    label: "Procesos",
    description:
      "Run an authorized long command or bounded monitor without polling. start returns immediately; completion delivers one message and the full log path. Use normal bash for quick checks. list/stop only access this session. Monitors emit bounded batches; filter noisy output. Closing or handing off the session stops its jobs. No automatic retries.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("start"),
        Type.Literal("list"),
        Type.Literal("stop"),
      ]),
      command: Type.Optional(Type.String()),
      label: Type.Optional(Type.String()),
      id: Type.Optional(Type.String()),
      timeout_seconds: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 1800 }),
      ),
      monitor: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      if (params.action === "start" && ctx.mode !== "tui" && ctx.mode !== "rpc")
        throw new Error(
          "En print/JSON usa bash síncrono; cerrar la sesión detiene sus procesos.",
        );
      const manager = await get(ctx);
      if (params.action === "stop") await manager.stop(params.id ?? "", true);
      const result =
        params.action === "start"
          ? manager.start(
              params.command ?? "",
              ctx.cwd,
              params.label ?? "",
              params.timeout_seconds ?? 0,
              params.monitor,
              jobExecutor(ctx),
            )
          : manager.list();
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: undefined,
      };
    },
  });
  pi.registerCommand("nein:procesos", {
    description: "Ver procesos de esta sesión, logs y detenerlos",
    handler: async (_args, ctx) => {
      const manager = await get(ctx),
        all = manager.list();
      if (!all.length) {
        ctx.ui.notify("No hay procesos de n_ein en esta sesión.", "info");
        return;
      }
      const labels = all.map(
        (j) => `${j.id.slice(0, 8)} · ${j.status} · ${j.label}`,
      );
      const picked = await ctx.ui.select("// 004 PROCESOS", labels);
      const item = all[labels.indexOf(picked ?? "")];
      if (!item) return;
      const action = await ctx.ui.select(
        item.label,
        item.status === "running"
          ? ["Ver resultado y log", "Detener proceso"]
          : ["Ver resultado y log"],
      );
      if (action === "Detener proceso") await manager.stop(item.id);
      if (action)
        ctx.ui.notify(
          `${item.command}\nLog: ${item.log}\n${
            manager
              .list()
              .find((j) => j.id === item.id)
              ?.tail.join("\n") ?? ""
          }`,
          "info",
        );
    },
  });
  pi.on("session_start", async (_event, ctx) => {
    if (owner) await stopSessionJobs(owner);
    owner = undefined;
    jobs = undefined;
    context = ctx;
  });
  pi.on("session_shutdown", async () => {
    if (owner) await stopSessionJobs(owner);
  });
}
