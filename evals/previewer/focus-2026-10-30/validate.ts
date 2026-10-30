// [BENCH] REFERENCIAS FUERA DEL ALCANCE DEL REVISOR
import { strict as assert } from "node:assert";
async function race(side: string): Promise<boolean> {
  const { Registry } = await import(`./reserved-race/${side}/registry.ts`);
  const registry = new Registry();
  let finish!: () => void, finishNext!: () => void;
  const old = new Promise<void>(r => { finish = r; }), next = new Promise<void>(r => { finishNext = r; });
  const first = registry.run("key", () => old), second = registry.run("key", () => next);
  const pending = registry.active.get("key");
  finish(); await first;
  const preserved = registry.active.get("key") === pending;
  finishNext(); await second;
  return preserved;
}
assert.equal(await race("base"), true);
assert.equal(await race("head"), false);
const old = await import("./reserved-unicode/base/label.ts"), current = await import("./reserved-unicode/head/label.ts");
assert.notEqual(old.truncate("😀a",1),"😀");assert.equal(current.truncate("😀a",1),"😀");
assert.equal(current.truncate("a\u0301",1),"a", "the contract counts code points, not graphemes");
console.log("fresh references: race regression and correct Unicode fix validated");
