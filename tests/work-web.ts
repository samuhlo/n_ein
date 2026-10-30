import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serveWork } from "../pi-package/workspace/server.ts";
const cwd=mkdtempSync(join(tmpdir(),"nein-work-web-"));
process.env.N_EIN_HOME=join(cwd,"home");process.env.N_EIN_CHANNEL="dev";
writeFileSync(join(cwd,"WORK.md"),"## Objetivo\n<script>alert(1)</script>\n## Tareas\n- [ ] T1 · Probar\n");
const live=await serveWork(resolve("."),cwd,{publish:false});
try {
  const base=`http://127.0.0.1:${live.state.port}`, headers={authorization:`Bearer ${live.state.token}`};
  assert.equal((await fetch(`${base}/state`)).status,403);
  assert.equal((await fetch(`${base}/state`,{headers:{...headers,origin:"https://evil.test"}})).status,403);
  assert.equal((await fetch(`${base}/state`,{headers:{...headers,host:"evil.test"}})).status,403);
  const state=await (await fetch(`${base}/state`,{headers})).json();
  assert.equal(state.work.tasks[0].done,false);
  const html=await (await fetch(base)).text();assert.ok(!html.includes("alert(1)"));
  const js=await (await fetch(`${base}/app.js`)).text();assert.ok(js.includes("textContent"));assert.ok(!js.includes("innerHTML"));
  assert.equal((await fetch(`${base}/state`,{method:"POST",headers})).status,405);
  console.log("work web: bundle, live API, origin/host/token guards and text-only rendering");
}finally{live.close();}
