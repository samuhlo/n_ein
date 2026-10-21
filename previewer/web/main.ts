// =============================================================================
// [UI] REVISOR EN EL NAVEGADOR
// Pide la sesión al servidor local, la pinta y guarda las decisiones del
// usuario: valoración, motivo y selección. El token llega en el fragmento del
// enlace, se guarda en la pestaña y se borra de la barra de direcciones.
// =============================================================================

import { text } from "./html.ts";
import { renderPage, type SessionView } from "./view.ts";

const POLL_MS = 10_000;
const app = document.getElementById("app");
const sessionId = decodeURIComponent(location.pathname.split("/")[2] ?? "");

function readToken(): string {
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("t");
  try {
    if (fromHash) sessionStorage.setItem("previewer-token", fromHash);
    return fromHash ?? sessionStorage.getItem("previewer-token") ?? "";
  } catch {
    return fromHash ?? "";
  }
}
const token = readToken();
// BLINDAJE -> El token no se queda en la barra ni en el historial: quien vea la URL no puede escribir.
if (location.hash.includes("t=")) history.replaceState(null, "", location.pathname);

let view: SessionView | null = null;
let version = "";
/** Motivos escritos antes de elegir valoración: sobreviven a un repintado. */
const drafts = new Map<string, string>();

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-previewer-token": token, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data ? String(data.error) : response.statusText;
    throw new Error(message);
  }
  return data as T;
}

function say(message: string): void {
  const bar = document.querySelector(".bar");
  if (bar) {
    bar.textContent = message;
    bar.classList.add("error");
  }
}

/** Repinta conservando lo que el usuario tenía abierto, el scroll y el foco. */
function paint(): void {
  if (!app || !view) return;
  const open = new Map([...app.querySelectorAll("details")].map((details) => [key(details), details.open]));
  const focused = document.activeElement instanceof HTMLElement ? focusKey(document.activeElement) : null;
  const scroll = window.scrollY;
  // Un motivo a medio escribir no se pierde si llega una revisión nueva.
  for (const input of app.querySelectorAll<HTMLInputElement>('[data-action="reason"]')) {
    const id = input.closest("[data-id]")?.getAttribute("data-id");
    const saved = view.findings.find((item) => item.id === id)?.rating?.reason ?? "";
    if (id && input.value !== saved) drafts.set(id, input.value);
  }
  app.innerHTML = text(renderPage(view));
  for (const details of app.querySelectorAll("details")) {
    const was = open.get(key(details));
    if (was !== undefined) details.open = was;
  }
  for (const [id, reason] of drafts) {
    const input = app.querySelector<HTMLInputElement>(`[data-id="${CSS.escape(id)}"] [data-action="reason"]`);
    if (input) input.value = reason;
  }
  if (focused) app.querySelector<HTMLElement>(focused)?.focus({ preventScroll: true });
  window.scrollTo(0, scroll);
}

function key(details: Element): string {
  const owner = details.closest("[data-id]")?.getAttribute("data-id");
  return owner ? `f:${owner}` : `g:${details.querySelector("summary")?.textContent ?? ""}`;
}

function focusKey(element: HTMLElement): string | null {
  const id = element.closest("[data-id]")?.getAttribute("data-id");
  const action = element.getAttribute("data-action");
  if (!id || !action) return null;
  const verdict = element.getAttribute("data-verdict");
  return `[data-id="${CSS.escape(id)}"] [data-action="${action}"]${verdict ? `[data-verdict="${verdict}"]` : ""}`;
}

function replace(updated: SessionView["findings"][number]): void {
  if (!view) return;
  view = { ...view, findings: view.findings.map((item) => (item.thread === updated.thread ? updated : item)) };
  paint();
}

async function load(): Promise<void> {
  if (!app) return;
  if (!token) {
    app.textContent = "falta el token del enlace: vuelve a abrir el revisor desde n_ein";
    return;
  }
  try {
    view = await api<SessionView>(`/api/sessions/${encodeURIComponent(sessionId)}`);
    document.documentElement.lang = view.lang;
    version = await api<{ version: string }>(`/api/sessions/${encodeURIComponent(sessionId)}/version`).then((data) => data.version);
    paint();
    focusHash();
  } catch (error) {
    app.textContent = error instanceof Error ? error.message : String(error);
  }
}

function focusHash(): void {
  const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  for (const element of document.querySelectorAll(".focused")) element.classList.remove("focused");
  if (!target) return;
  // Lo que se enlaza puede estar plegado: un resuelto, un archivo largo.
  for (let node = target.parentElement; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true;
  const own = target.querySelector(":scope > details");
  if (own instanceof HTMLDetailsElement) own.open = true;
  target.classList.add("focused");
  if (target.matches("article")) target.focus({ preventScroll: true });
  target.scrollIntoView({ block: target.matches(".row") ? "center" : "start" });
}

document.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-action="rate"]') : null;
  const card = button?.closest<HTMLElement>("[data-id]");
  if (!button || !card?.dataset.id) return;
  const id = card.dataset.id;
  const reason = card.querySelector<HTMLInputElement>('[data-action="reason"]')?.value ?? "";
  api<SessionView["findings"][number]>(`/api/findings/${encodeURIComponent(id)}/rate`, { verdict: button.dataset.verdict, reason })
    .then((updated) => {
      drafts.delete(id);
      replace(updated);
    })
    .catch((error: unknown) => say(error instanceof Error ? error.message : String(error)));
});

document.addEventListener("change", (event) => {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const card = input?.closest<HTMLElement>("[data-id]");
  if (!input || !card?.dataset.id || !view) return;
  const id = card.dataset.id;
  if (input.dataset.action === "select")
    api<SessionView["findings"][number]>(`/api/findings/${encodeURIComponent(id)}/select`, { selected: input.checked })
      .then(replace)
      .catch((error: unknown) => {
        input.checked = !input.checked;
        say(error instanceof Error ? error.message : String(error));
      });
  if (input.dataset.action === "reason") {
    const rating = view.findings.find((item) => item.id === id)?.rating;
    // Sin valoración todavía, el motivo espera a que se elija una.
    if (!rating) drafts.set(id, input.value);
    else api<SessionView["findings"][number]>(`/api/findings/${encodeURIComponent(id)}/rate`, { verdict: rating.verdict, reason: input.value })
      .then(replace)
      .catch((error: unknown) => say(error instanceof Error ? error.message : String(error)));
  }
});

window.addEventListener("hashchange", focusHash);

// Una revisión nueva (o una que termina) repinta la página sin perder lo abierto.
setInterval(() => {
  if (!view || document.hidden) return;
  api<{ version: string }>(`/api/sessions/${encodeURIComponent(sessionId)}/version`)
    .then(async (data) => {
      if (data.version === version) return;
      version = data.version;
      view = await api<SessionView>(`/api/sessions/${encodeURIComponent(sessionId)}`);
      paint();
    })
    .catch(() => {});
}, POLL_MS);

void load();
