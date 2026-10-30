import { strict as assert } from "node:assert";
import {
  actionsFor,
  actionDraft,
} from "../pi-package/claude-plugin/hooks/actions.ts";
import { ActionsPanel } from "../pi-package/extensions/actions-panel.ts";
const names = ["nein:models", "nein:revisor", "skill:previewer", "handoff"];
assert.deepEqual(
  actionsFor("pi", names, "modelo").map((a) => a.id),
  ["models", "previewer"],
);
assert.ok(
  !actionsFor("pi", names).some((a) => a.id === "vision"),
  "no unavailable actions",
);
assert.equal(actionsFor("pi", names, "revisión nueva")[0].id, "previewer");
const a = actionsFor("pi", names, "revisión nueva")[0];
assert.ok(actionDraft(a, "pi", "mi borrador").endsWith("mi borrador"));
let selected: unknown;
const panel = new ActionsPanel(
  names,
  {
    matchesKey: (s, k) => s === `<${k}>`,
    truncateToWidth: (s, w) => [...s].slice(0, w).join(""),
    visibleWidth: (s) => [...s].length,
  },
  (v) => {
    selected = v;
  },
  undefined,
  () => 12,
);
panel.handleInput("revisión nueva");
assert.ok(panel.render(25).every((l) => [...l].length <= 25));
panel.handleInput("<enter>");
assert.equal((selected as any).id, "previewer");
panel.handleInput("<escape>");
assert.equal(selected, null);
console.log(
  "actions: local search, availability, draft preservation and narrow rendering",
);
