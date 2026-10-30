import { strict as assert } from "node:assert";
import { summarizeEvents } from "../previewer/src/runner.ts";
import { usageSummary, usageLabel } from "../previewer/src/usage.ts";

const event = (usage?: object) => JSON.stringify({ type: "message_end", message: { role: "assistant", content: [], usage } });
const missing = summarizeEvents([event()]).usage;
const zero = summarizeEvents([event({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } })]).usage;
assert.equal(usageSummary([missing]).coverage, "unknown");
assert.equal(usageSummary([zero]).coverage, "complete");
assert.notEqual(usageLabel(usageSummary([missing]), "es"), usageLabel(usageSummary([zero]), "es"));
const partial = summarizeEvents([event({ input: 10, output: 2, cacheRead: 4, cacheWrite: 6, cost: { total: .1 } }), event()]).usage;
assert.equal(partial.cacheWrite, 6);
assert.equal(usageSummary([partial]).coverage, "partial");
assert.match(usageLabel(usageSummary([partial]), "es"), /parcial/);
assert.equal(usageSummary([{ input: 0, output: 0, cacheRead: 0, usd: .2 }]).coverage, "partial", "historical totals are retained without claiming coverage");
assert.equal(usageSummary([null]).coverage, "unknown");
assert.equal(usageSummary([zero, null]).coverage, "partial");
assert.equal(usageSummary([summarizeEvents([event({ cost: { total: -1 } })]).usage]).coverage, "unknown");
console.log("previewer usage: unknown, zero, partial and historical estimates stay distinct");
