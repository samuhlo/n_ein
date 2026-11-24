import { strict as assert } from "node:assert";
import { ASK_TOOL } from "../pi-package/extensions/ask.ts";
import { OTHER, answerFor, askProblem, choicesFor, formatAnswers, type AskQuestion } from "../pi-package/extensions/ask-core.ts";

// [DATA] La declaración viaja en cada turno: nombre, descripción y parámetros caben en 1.200 bytes.
const declared = JSON.stringify({ name: ASK_TOOL.name, description: ASK_TOOL.description, parameters: ASK_TOOL.parameters });
assert.ok(Buffer.byteLength(declared) <= 1200, `nein_ask ocupa ${Buffer.byteLength(declared)} bytes`);
assert.equal(ASK_TOOL.name, "nein_ask");

// [FLOW] Cada pregunta es una lista: la recomendada se marca y «Otra respuesta» va siempre al final.
const database: AskQuestion = {
  question: "¿Qué base de datos usamos?",
  options: [{ label: "Postgres", description: "relacional, ya en producción" }, { label: "SQLite" }],
  recommended: 0,
};
assert.deepEqual(choicesFor(database), ["Postgres (recomendada) — relacional, ya en producción", "SQLite", OTHER]);
assert.deepEqual(answerFor(database, "SQLite"), { kind: "option", label: "SQLite" });
assert.deepEqual(answerFor(database, "Postgres (recomendada) — relacional, ya en producción"), { kind: "option", label: "Postgres" });
assert.deepEqual(answerFor(database, OTHER), { kind: "other" });
assert.deepEqual(answerFor(database, undefined), { kind: "none" });

// Lo que no se puede mostrar como una decisión cerrada vuelve al modelo como error, sin preguntar.
assert.equal(askProblem([database]), undefined);
assert.match(askProblem([])!, /1-4 questions/);
assert.match(askProblem([database, database, database, database, database])!, /1-4 questions/);
assert.match(askProblem([{ question: "¿Sí?", options: [{ label: "Sí" }] }])!, /2-4 options/);
assert.match(askProblem([{ question: "¿Cuál?", options: [{ label: "A" }, { label: "a" }] }])!, /distinct/);
assert.match(askProblem([{ question: "¿Cuál?", options: [{ label: "A" }, { label: OTHER }] }])!, /reserved/);
assert.match(askProblem([{ question: "¿Cuál?", options: [{ label: "A" }, { label: "A (recomendada)" }], recommended: 0 }])!, /distinct/);
assert.match(askProblem([{ question: "¿Cuál?", options: [{ label: "A" }, { label: "B" }], recommended: 2 }])!, /recommended/);
assert.match(askProblem([{ question: " ", options: [{ label: "A" }, { label: "B" }] }])!, /empty/);

// Las respuestas vuelven al modelo en inglés, una por pregunta y con el texto libre citado.
const deploy: AskQuestion = { question: "¿Dónde desplegamos?", options: [{ label: "Vercel" }, { label: "Fly" }] };
assert.equal(
  formatAnswers([database, deploy], [{ kind: "option", label: "SQLite" }, { kind: "other", text: "En mi servidor" }]),
  '1. ¿Qué base de datos usamos? → SQLite\n2. ¿Dónde desplegamos? → other answer: "En mi servidor"',
);
assert.equal(
  formatAnswers([database, deploy], [{ kind: "option", label: "SQLite" }, { kind: "none" }]),
  "1. ¿Qué base de datos usamos? → SQLite\n2. ¿Dónde desplegamos? → no answer: the user dismissed it. Do not assume one.",
);
console.log("ask: declaración, opciones, validación y respuestas");
