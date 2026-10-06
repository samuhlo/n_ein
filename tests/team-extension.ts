import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import registerTeam from "../pi-package/extensions/team.ts";
const cwd = mkdtempSync(join(tmpdir(), "nein-team-ui-"));
execFileSync("git", ["init", "-q"], { cwd });
const hooks: Record<string, any> = {},
  commands: Record<string, any> = {};
let tool: any, shortcut: any;
registerTeam({
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
const ctx: any = {
  cwd,
  mode: "tui",
  hasUI: true,
  sessionManager: { getSessionId: () => "test", getBranch: () => [] },
  ui: {
    setWidget() {},
    notify() {},
    async select() {
      menus++;
      return undefined;
    },
    async editor() {},
  },
};
await hooks.session_start({}, ctx);
await commands["nein:equipo"].handler("", ctx);
assert.equal(menus, 1, "command opens the local menu");
await shortcut.handler(ctx);
assert.equal(menus, 2);
await tool.execute("view", { action: "view" }, undefined, undefined, ctx);
assert.equal(menus, 3);
await hooks.session_shutdown();
console.log("team command, shortcut and conversational view: OK");
