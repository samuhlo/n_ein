import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import { strict as assert } from "node:assert";
import { acceptanceStatus } from "../evals/bench/acceptance.ts";

const green = { hiddenPass: 3, hiddenTotal: 3, suiteFailed: 0, suiteBadFiles: 0, typecheck: true, extra: { mount: { readsText: false, mounts: true, mutantsKilled: 1 }, docFixed: true } };
assert.equal(acceptanceStatus("s3", green).complete, false, "una suite verde con un mutante superviviente no acredita la calidad pedida");
assert.match(acceptanceStatus("s3", green).reasons.join(" "), /mutant/);
assert.equal(acceptanceStatus("s3", { ...green, extra: { ...green.extra, mount: { ...green.extra.mount, mutantsKilled: 2 } } }).complete, true);
assert.equal(acceptanceStatus("s2", { ...green, hiddenPass: 9, hiddenTotal: 14 }).complete, false, "una entrega parcial no cuenta como aceptada");
assert.equal(acceptanceStatus("s2", { ...green, suiteFailed: 1 }).complete, false);
assert.equal(acceptanceStatus("s2", { ...green, typecheck: false }).complete, false);
assert.equal(acceptanceStatus("s2", {}).complete, false, "la ausencia de evidencia no es éxito");
assert.equal(acceptanceStatus("s2", { ...green, hiddenPass: 0, hiddenTotal: 0 }).complete, false);
assert.equal(acceptanceStatus("s5", { ...green, extra: { codeFilesTouched: 1 } }).complete, false);
assert.equal(acceptanceStatus("s5", { ...green, extra: { codeFilesTouched: 0 } }).complete, true);
assert.equal(acceptanceStatus("unknown", green).complete, false);
console.log("bench: aceptación completa distingue omisiones, mutantes, suite, tipos y evidencia ausente");

const invalid = spawnSync("bash", [resolve("evals/bench/grade.sh"), "../outside"], {encoding:"utf8"});
assert.equal(invalid.status,64);
assert.match(invalid.stderr,/RUN_INVALID/);
