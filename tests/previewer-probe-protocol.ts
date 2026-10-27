// [CHECK] El código de salida no sustituye a la comprobación que se quería medir.
import { strict as assert } from "node:assert";
import { assessProbe, PROBE_PROTOCOL, probeState } from "../previewer/src/probe-result.ts";

const spec = { protocol: PROBE_PROTOCOL, check: "backup-keeps-upload" };
const record = (outcome: string, check = spec.check) => `NEIN_PROBE_RESULT ${JSON.stringify({ check, outcome, reason: "observed bytes" })}`;
const assess = (exitCode: number | null, records: string[], output = "") => assessProbe(spec, { exitCode, records, output });
assert.equal(assess(1, [record("reproduced")]).outcome, "reproduced");
assert.equal(assess(0, [record("passed")]).outcome, "passed");
assert.equal(assess(0, [record("not_applicable")]).outcome, "not_applicable");
assert.equal(assess(2, [record("error")]).outcome, "error");
assert.equal(assess(1, []).outcome, "inconclusive", "una excepción distinta no es el fallo esperado");
assert.equal(assess(0, []).outcome, "inconclusive", "un wrapper que traga errores no confirma el arreglo");
assert.equal(assess(1, [record("reproduced", "different-check")]).outcome, "inconclusive");
assert.equal(assess(0, [record("reproduced")]).outcome, "inconclusive", "resultado y salida contradictorios");
assert.equal(assess(1, [record("passed")]).outcome, "inconclusive");
assert.equal(assess(1, [record("reproduced"), record("passed")]).outcome, "inconclusive");
assert.equal(assess(1, ["NEIN_PROBE_RESULT broken"]).outcome, "inconclusive");
assert.equal(assess(null, [record("reproduced")]).outcome, "error", "una sonda interrumpida no cuenta");
assert.equal(assess(127, [record("reproduced")]).outcome, "error");
assert.equal(assessProbe({}, { exitCode: 1, records: [], output: "AssertionError" }).outcome, "inconclusive");
assert.equal(probeState({ reproduced: true, exitCode: 1 } as any), "inconclusive", "el almacén antiguo no gana garantías por actualizar");
console.log("previewer explicit probe protocol: OK");
