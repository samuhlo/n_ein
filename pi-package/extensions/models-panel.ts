// =============================================================================
// [UI] PANEL DE MODELOS — /nein:models
// Tabla de roles con modelo y esfuerzo, como el panel de Ein: `e` cicla el
// esfuerzo en la fila, enter abre el buscador de modelos y nada se escribe
// hasta guardar. Claude solo tiene esfuerzo: su modelo es el de Claude Code.
// Módulo puro: recibe las utilidades de pi-tui para poder probarse sin Pi.
// =============================================================================

import { COLORS, heading, type Painter } from "./brand.ts";

export type PanelKit = {
  matchesKey(data: string, key: string): boolean;
  truncateToWidth(text: string, width: number, ellipsis?: string): string;
  visibleWidth(text: string): number;
};

export type ModelRole = "principal" | "scout" | "worker" | "reviewer";
export type Role = ModelRole | "claude";
export type ModelChoice = { model: string; thinking: string };
/** null en un rol = valor del paquete (o de Claude Code); lo que se guarda al final. */
export type Draft = Record<ModelRole, ModelChoice | null> & { claude: string | null };
export type PanelResult =
  | { kind: "save"; draft: Draft }
  | { kind: "cancel" }
  | { kind: "custom"; role: ModelRole; draft: Draft };

export const THINKING = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
export const CLAUDE_EFFORT = ["low", "medium", "high", "xhigh", "max"];
export const CUSTOM_MODEL = "id de modelo personalizado…";

const ROLES: Role[] = ["principal", "scout", "worker", "reviewer", "claude"];
const LABEL: Record<Role, string> = { principal: "principal", scout: "nein-scout", worker: "nein-worker", reviewer: "nein-reviewer", claude: "claude" };
const SAVE = ROLES.length;
const CANCEL = ROLES.length + 1;
const VISIBLE_MODELS = 10;

export class ModelsPanel {
  private cursor = 0;
  private picking: ModelRole | null = null;
  private query = "";
  private pickCursor = 0;

  constructor(
    private draft: Draft,
    private readonly defaults: Record<ModelRole, ModelChoice>,
    private readonly saved: Draft,
    private readonly models: string[],
    private readonly kit: PanelKit,
    private readonly p: Painter,
    private readonly done: (result: PanelResult) => void,
    private readonly requestRender: () => void = () => {},
  ) {}

  private effective(role: ModelRole): ModelChoice {
    return this.draft[role] ?? this.defaults[role];
  }

  private options(): string[] {
    const query = this.query.trim().toLowerCase();
    const all = [...this.models, CUSTOM_MODEL];
    return query ? all.filter((option) => option.toLowerCase().includes(query)) : all;
  }

  private cycleEffort(role: Role): void {
    if (role === "claude") {
      // null = por defecto de Claude Code, el primer paso del ciclo.
      const cycle = [null, ...CLAUDE_EFFORT];
      this.draft = { ...this.draft, claude: cycle[(cycle.indexOf(this.draft.claude) + 1) % cycle.length] };
      return;
    }
    const current = this.effective(role);
    const next = THINKING[(THINKING.indexOf(current.thinking) + 1) % THINKING.length];
    this.draft = { ...this.draft, [role]: { model: current.model, thinking: next } };
  }

  handleInput(data: string): void {
    const key = (name: string) => this.kit.matchesKey(data, name);
    if (this.picking) {
      const options = this.options();
      if (key("escape")) { this.picking = null; this.query = ""; }
      else if (key("up")) this.pickCursor = Math.max(0, this.pickCursor - 1);
      else if (key("down")) this.pickCursor = Math.min(options.length - 1, this.pickCursor + 1);
      else if (key("enter")) {
        const chosen = options[this.pickCursor];
        const role = this.picking;
        if (chosen === CUSTOM_MODEL) { this.done({ kind: "custom", role, draft: this.draft }); return; }
        if (chosen) this.draft = { ...this.draft, [role]: { model: chosen, thinking: this.effective(role).thinking } };
        this.picking = null; this.query = "";
      } else if (key("backspace")) { this.query = [...this.query].slice(0, -1).join(""); this.pickCursor = 0; }
      else if ([...data].length === 1 && data >= " " && data !== "\x7f") { this.query += data; this.pickCursor = 0; }
      this.requestRender();
      return;
    }
    const role = ROLES[this.cursor];
    if (key("escape") || data === "q") { this.done({ kind: "cancel" }); return; }
    if (key("ctrl+s")) { this.done({ kind: "save", draft: this.draft }); return; }
    if (key("up") || data === "k") this.cursor = Math.max(0, this.cursor - 1);
    else if (key("down") || data === "j") this.cursor = Math.min(CANCEL, this.cursor + 1);
    else if (data === "e" && role) this.cycleEffort(role);
    else if (data === "r" && role) this.draft = { ...this.draft, [role]: null };
    else if (key("enter")) {
      if (this.cursor === SAVE) { this.done({ kind: "save", draft: this.draft }); return; }
      if (this.cursor === CANCEL) { this.done({ kind: "cancel" }); return; }
      if (role === "claude") this.cycleEffort(role);
      else if (role) {
        this.picking = role;
        this.query = "";
        this.pickCursor = Math.max(0, this.options().indexOf(this.effective(role).model));
      }
    }
    this.requestRender();
  }

  private bar(level: string | null, scale: string[]): string {
    const filled = level === null ? 0 : scale.indexOf(level) + 1;
    // Todas las barras ocupan lo mismo: la de Claude tiene menos niveles, pero la columna no se mueve.
    const pad = " ".repeat(THINKING.length - scale.length);
    return this.p.fg(COLORS.concrete, "▰".repeat(filled)) + this.p.fg(COLORS.structure, "▱".repeat(scale.length - filled)) + pad;
  }

  private changed(role: Role): boolean {
    return JSON.stringify(this.draft[role]) !== JSON.stringify(this.saved[role]);
  }

  private tableLines(width: number): string[] {
    const p = this.p;
    const modelWidth = Math.max(14, Math.min(34, width - 47));
    const lines = [
      p.fg(COLORS.muted, `   ${"ROL".padEnd(15)}${"MODELO".padEnd(modelWidth + 2)}ESFUERZO`),
      p.fg(COLORS.structure, `   ${"─".repeat(Math.max(10, width - 6))}`),
    ];
    ROLES.forEach((role, index) => {
      const focus = index === this.cursor;
      const pointer = focus ? p.fg(COLORS.yellow, "▸") : " ";
      const label = (focus ? p.bold(p.fg(COLORS.concrete, LABEL[role].padEnd(15))) : p.fg(COLORS.muted, LABEL[role].padEnd(15)));
      let model: string, effort: string, origin: string;
      if (role === "claude") {
        model = p.fg(COLORS.faint, "el de Claude Code".padEnd(modelWidth + 2));
        effort = `${this.bar(this.draft.claude, CLAUDE_EFFORT)} ${p.fg(COLORS.concrete, (this.draft.claude ?? "por defecto").padEnd(13))}`;
        origin = this.draft.claude === null ? "claude code" : "ajuste";
      } else {
        const choice = this.effective(role);
        model = p.fg(COLORS.concrete, this.kit.truncateToWidth(choice.model, modelWidth, "…").padEnd(modelWidth + 2));
        effort = `${this.bar(choice.thinking, THINKING)} ${p.fg(COLORS.concrete, choice.thinking.padEnd(13))}`;
        origin = this.draft[role] === null ? "paquete" : "ajuste";
      }
      const pending = this.changed(role) ? p.fg(COLORS.yellow, " •") : "";
      lines.push(` ${pointer} ${label}${model}${effort}${p.fg(COLORS.faint, origin)}${pending}`);
    });
    const button = (index: number, text: string) =>
      `${index === this.cursor ? p.fg(COLORS.yellow, "▸") : " "} ${index === this.cursor ? p.bold(p.fg(COLORS.concrete, text)) : p.fg(COLORS.muted, text)}`;
    lines.push("", ` ${button(SAVE, "✓ guardar")}      ${button(CANCEL, "✗ cancelar")}`, "");
    lines.push(p.fg(COLORS.faint, " ↑↓ mover · enter modelo · e esfuerzo · r paquete · ctrl+s guardar · esc salir"));
    const dirty = ROLES.some((role) => this.changed(role));
    if (dirty) lines.push(p.fg(COLORS.faint, " • sin guardar: principal al reiniciar Pi, cada rol en su próxima delegación, claude al abrirlo"));
    return lines;
  }

  private pickerLines(width: number): string[] {
    const p = this.p;
    const options = this.options();
    const lines = [
      `   ${p.fg(COLORS.muted, "buscar")}  ${this.query ? p.fg(COLORS.concrete, this.query) : p.fg(COLORS.faint, "escribe para filtrar")}`,
      p.fg(COLORS.structure, `   ${"─".repeat(Math.max(10, width - 6))}`),
    ];
    if (options.length === 0) lines.push(p.fg(COLORS.faint, "   sin modelos coincidentes"));
    const start = Math.max(0, Math.min(this.pickCursor - Math.floor(VISIBLE_MODELS / 2), options.length - VISIBLE_MODELS));
    options.slice(start, start + VISIBLE_MODELS).forEach((option, offset) => {
      const focus = start + offset === this.pickCursor;
      const slash = option.lastIndexOf("/");
      const text = slash > 0 && option !== CUSTOM_MODEL
        ? p.fg(COLORS.faint, option.slice(0, slash + 1)) + (focus ? p.bold(p.fg(COLORS.concrete, option.slice(slash + 1))) : p.fg(COLORS.concrete, option.slice(slash + 1)))
        : p.fg(focus ? COLORS.concrete : COLORS.muted, option);
      lines.push(` ${focus ? p.fg(COLORS.yellow, "▸") : " "} ${text}`);
    });
    if (start + VISIBLE_MODELS < options.length) lines.push(p.fg(COLORS.faint, `   ··· ${options.length - start - VISIBLE_MODELS} más`));
    lines.push("", p.fg(COLORS.faint, " ↑↓ mover · enter elegir · escribe para buscar · esc volver"));
    return lines;
  }

  render(width: number): string[] {
    const p = this.p;
    const title = this.picking
      ? `${heading(p, 1, "MODELO")}  ${p.fg(COLORS.muted, "para")} ${p.fg(COLORS.concrete, LABEL[this.picking])}`
      : heading(p, 0, "MODELOS");
    const rule = p.fg(COLORS.structure, "─".repeat(Math.max(0, width)));
    const body = this.picking ? this.pickerLines(width) : this.tableLines(width);
    // Las reglas de arriba y abajo separan el panel de la conversación sin cerrarlo en una caja.
    return [rule, "", ` ${title}`, "", ...body, "", rule].map((line) => {
      const fitted = this.kit.truncateToWidth(line, width, "…");
      return fitted + " ".repeat(Math.max(0, width - this.kit.visibleWidth(fitted)));
    });
  }

  invalidate(): void {}
}
