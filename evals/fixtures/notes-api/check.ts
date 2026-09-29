import { strict as assert } from "node:assert";
import { createApp } from "./app";

const app = createApp();
const health = await app.fetch(new Request("http://local/health"));
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true });

const created = await app.fetch(new Request("http://local/notes", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ text: "  Comprar pan  " }),
}));
assert.equal(created.status, 201);
const note = await created.json() as { id: string; text: string };
assert.equal(note.text, "Comprar pan");
assert.ok(note.id);

const found = await app.fetch(new Request(`http://local/notes/${note.id}`));
assert.equal(found.status, 200);
assert.deepEqual(await found.json(), note);

const missing = await app.fetch(new Request("http://local/notes/no-existe"));
assert.equal(missing.status, 404);

const invalidJson = await app.fetch(new Request("http://local/notes", {
  method: "POST",
  body: "{",
}));
assert.equal(invalidJson.status, 400);

const emptyText = await app.fetch(new Request("http://local/notes", {
  method: "POST",
  body: JSON.stringify({ text: "  " }),
}));
assert.equal(emptyText.status, 422);
