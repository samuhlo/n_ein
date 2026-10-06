import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mock } from "bun:test";
mock.module("@earendil-works/pi-tui", () => ({
  truncateToWidth: (text: string, width: number) => {
    const chars = [...text];
    while (Bun.stringWidth(chars.join("")) > width) chars.pop();
    return chars.join("");
  },
}));
const { default: registerTeam } = await import(
  "../pi-package/extensions/team.ts"
);
const cwd = mkdtempSync(join(tmpdir(), "nein-team-ui-"));
execFileSync("git", ["init", "-q"], { cwd });
const hooks: Record<string, any> = {},
  commands: Record<string, any> = {};
let tool: any, shortcut: any;
registerTeam({
  events: {
    on() {
      return () => {};
    },
    emit() {},
  },
  registerMessageRenderer() {},
  on(name: string, fn: any) {
    hooks[name] = fn;
  },
  registerCommand(name: string, value: any) {
    commands[name] = value;
  },
  registerTool(value: any) {
    tool = value;
  },
  registerShortcut(_key: string, value: any) {
    shortcut = value;
  },
  sendMessage() {
    throw new Error("UI must not start a model turn");
  },
} as any);
let menus = 0;
let notices = 0;
const ctx: any = {
  cwd,
  mode: "tui",
  hasUI: true,
  sessionManager: { getSessionId: () => "test", getBranch: () => [] },
  ui: {
    setWidget() {},
    notify() {
      notices++;
    },
    async select() {
      menus++;
      return undefined;
    },
    async editor() {},
  },
};
await hooks.session_start({}, ctx);
await commands["nein:equipo"].handler("", ctx);
assert.equal(notices, 1, "command reports an empty team locally");
await shortcut.handler(ctx);
assert.equal(notices, 2);
await tool.execute("view", { action: "view" }, undefined, undefined, ctx);
assert.equal(notices, 3);
assert.equal(menus, 0, "empty teams do not open a menu of irrelevant actions");
await hooks.session_shutdown();
console.log("team command, shortcut and conversational view: OK");
