import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import register, { contextLevel, continuationNote } from "../pi-package/extensions/context-panel.ts";
assert.equal(contextLevel(null,100),null);assert.equal(contextLevel(70,100)?.high,true);assert.equal(contextLevel(20,100)?.high,false);
const cwd=mkdtempSync(join(tmpdir(),"nein-context-panel-"));assert.throws(()=>continuationNote(cwd));
writeFileSync(join(cwd,"WORK.md"),"## Objetivo\nConservar datos\n## Autorización\nImplementar; sin push\n## Siguiente paso\nVerificar recuperación\n");
assert.match(continuationNote(cwd),/sin push/);
const commands=new Map<string,any>();let setup:any,restored:any,sent="",draft="borrador",selected=false;
register({on(){},registerCommand(n:any,o:any){commands.set(n,o)},getThinkingLevel:()=>"high",setModel:async()=>{selected=true;return true},setThinkingLevel(){}} as any);
const state={type:"custom",customType:"pi.virtual-model-state",data:{provider:"nein",modelId:"auto",state:{clase:"riesgo",fuente:"usuario"}}};
await commands.get("nein:continuar").handler("",{cwd,waitForIdle:async()=>{},hasPendingMessages:()=>false,model:{provider:"nein",id:"auto"},ui:{getEditorText:()=>draft},sessionManager:{getBranch:()=>[state],getSessionId:()=>"test",getSessionFile:()=>"old.jsonl"},newSession:async(options:any)=>{
  setup=options.parentSession;await options.setup({appendCustomEntry:(_n:any,d:any)=>{restored=d}});await options.withSession({ui:{setEditorText:(t:string)=>{draft=t}},sendUserMessage:async(t:string)=>{sent=t}});return {cancelled:false};}});
assert.equal(setup,"old.jsonl");assert.deepEqual(restored,state.data);assert.equal(draft,"borrador");assert.ok(selected);assert.match(sent,/Verificar recuperación/);
console.log("context panel: measured unknowns, explicit continuation, preserved routing, authorization and draft");
