// =============================================================================
// [FLOW] BANNER DE ARRANQUE
// Sustituye la cabecera de Pi por la marca de n_ein y el estado del proyecto.
// Se anima una vez (STYLE: un reveal y a estático) y luego deja de pintar.
// =============================================================================

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { painter } from "./brand.ts";
import { bannerSeconds, renderBanner, type BannerData } from "./banner-view.ts";
import { readWorkDoc, resolveWorkDoc } from "./work-doc.ts";
import { loadModels } from "../models.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const run = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, timeout: 3000 });
  return stdout.trim();
}

function readText(path: string): string {
  try { return readFileSync(path, "utf8").trim(); } catch { return ""; }
}

function shortModel(model: string, thinking: string): string {
  return `${model.replace(/^openai-codex\//, "")} · ${thinking}`;
}

function initialData(cwd: string): BannerData {
  const channel = readText(join(packageRoot, ".n-ein-channel")) || "dev";
  let version = "desarrollo";
  try { version = JSON.parse(readFileSync(join(packageRoot, "install.json"), "utf8")).version ?? version; } catch { /* checkout de desarrollo */ }
  let models = { principal: "desconocido", worker: "desconocido", claude: "modelo de Claude Code" };
  try {
    const effective = loadModels(packageRoot);
    models = {
      principal: shortModel(effective.principal.model, effective.principal.thinking),
      worker: shortModel(effective.worker.model, effective.worker.thinking),
      claude: `modelo de Claude Code · ${effective.claudeEffort ?? "esfuerzo por defecto"}`,
    };
  } catch (error) {
    models.principal = error instanceof Error ? error.message : String(error);
  }
  let todo: BannerData["todo"];
  const workDoc = resolveWorkDoc(cwd);
  if (workDoc) {
    try {
      const { tasks } = readWorkDoc(workDoc);
      if (tasks.length) todo = { current: tasks.find((task) => !task.done)?.text, done: tasks.filter((task) => task.done).length, total: tasks.length };
    } catch { /* el widget de TODO ya avisa de un WORK.md ilegible */ }
  }
  const home = homedir();
  return {
    channel, version, piVersion: VERSION,
    cwd: cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd,
    index: "comprobando…", todo, models,
  };
}

export default function (pi: ExtensionAPI) {
  if (process.env.N_EIN_WORKER_CHILD === "1") return;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI || ctx.mode !== "tui") return;
    const data = initialData(ctx.cwd);
    const p = painter();
    const start = Date.now();
    let timer: ReturnType<typeof setInterval> | undefined;
    let requestRender = () => {};
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };

    // Git contesta después del primer fotograma; la fila muestra la espera mientras tanto.
    void Promise.all([
      git(ctx.cwd, "branch", "--show-current"),
      git(ctx.cwd, "status", "--short"),
      git(ctx.cwd, "rev-parse", "--show-toplevel"),
    ]).then(([branch, status, top]) => {
      const count = status ? status.split("\n").length : 0;
      data.git = { branch: branch || "detached", changes: count ? `${count} sin confirmar` : "limpio" };
      data.index = existsSync(join(top, ".codegraph")) ? "codegraph · al día" : "codegraph · sin índice";
    }).catch(() => {
      data.git = { branch: "sin Git", changes: "—" };
      data.index = "codegraph · sin repositorio git";
    }).finally(() => requestRender());

    ctx.ui.setHeader((tui) => {
      requestRender = () => { try { tui.requestRender(); } catch { stop(); } };
      stop();
      timer = setInterval(() => {
        if ((Date.now() - start) / 1000 > bannerSeconds(data, p)) stop();
        requestRender();
      }, 40);
      return {
        render(width: number): string[] {
          return renderBanner(p, data, (Date.now() - start) / 1000, width, process.stdout.rows ?? 0).map((line) => truncateToWidth(line, Math.max(1, width), ""));
        },
        invalidate() {},
        dispose: stop,
      };
    });
  });
}
