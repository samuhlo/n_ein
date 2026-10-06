import { strict as assert } from "node:assert";
import { teamLines } from "../pi-package/agents/view.ts";
const tasks: any[] = [
  {
    label: "Calendario",
    status: "running",
    model: "openai/sol",
    thinking: "medium",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:02Z",
    usageKnown: true,
    tokens: 42,
    cost: 0.01,
  },
  {
    label: "API\u001b[31m\n",
    status: "ready",
    model: "openai/sol",
    thinking: "medium",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:01Z",
    usageKnown: false,
  },
];
const lines = teamLines(tasks, 50, Date.parse("2026-01-01T00:00:02Z"));
assert.ok(lines.some((l) => l.includes("integrar")));
assert.ok(lines.every((l) => l.length <= 50));
assert.ok(lines.every((l) => !/[\x00-\x1f]/.test(l)));
assert.ok(lines.some((l) => l.includes("42")));
assert.deepEqual(teamLines([], 50), []);
console.log("team view: OK");
