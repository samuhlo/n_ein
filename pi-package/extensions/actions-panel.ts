// [UI] BUSCADOR DE ACCIONES
// Componente puro: el borrador y la ejecución pertenecen al host.
import { actionsFor, type Action } from "../claude-plugin/hooks/actions.ts";
import type { PanelKit } from "./models-panel.ts";
export class ActionsPanel {
  private query = "";
  private cursor = 0;
  constructor(private names: string[], private kit: PanelKit, private done: (value: Action | null) => void,
    private redraw = () => {}, private rows = () => 24) {}
  handleInput(data: string): void {
    const key = (k: string) => this.kit.matchesKey(data, k);
    if (key("escape")) { this.done(null); return; }
    if (key("enter")) { const item = this.items()[this.cursor]; if (item) this.done(item); return; }
    if (key("up")) this.cursor = Math.max(0, this.cursor - 1);
    else if (key("down")) this.cursor = Math.min(Math.max(0, this.items().length - 1), this.cursor + 1);
    else if (key("backspace")) { this.query = [...this.query].slice(0, -1).join(""); this.cursor = 0; }
    else if (data && !/[\x00-\x1f\x7f-\x9f]/.test(data)) { this.query = (this.query + data).slice(0, 160); this.cursor = 0; }
    this.redraw();
  }
  private items() { return actionsFor("pi", this.names, this.query); }
  render(width: number): string[] {
    const items = this.items(), count = Math.max(1, Math.floor((this.rows() - 8) / 3));
    const start = Math.max(0, this.cursor - count + 1);
    return ["// 004 COMANDOS", `Buscar: ${this.query}`, "", ...items.slice(start, start + count).flatMap((a, n) => [
      `${start + n === this.cursor ? "▸" : " "} ${a.label}`, `  ${a.description}`, "",
    ]), ...(items.length ? [] : ["Sin coincidencias"]), `${items.length ? `${this.cursor + 1}/${items.length} · ` : ""}↑↓ elegir · Enter abrir/preparar · Esc cerrar`]
      .map(line => this.kit.truncateToWidth(line, Math.max(1, width), "…"));
  }
  invalidate() {}
}
