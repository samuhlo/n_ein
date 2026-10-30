// =============================================================================
// [DATA] DISEÑOS Y DECISIONES VISUALES
// HTML del proyecto, comentarios dirigidos y evidencia de aceptación separados.
// La dirección elegida no equivale a implementación ni a comprobación visual.
// =============================================================================
import { fingerprint } from "./evidence.ts";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { projectRoot, smallJSON, atomicJSON } from "./state.ts";
export type Artboard={file:string;title:string;tradeoff:string};
export type Design={schema:1;slug:string;title:string;brief:string;artboards:Artboard[];chosen?:string;implementation?:{file:string;status:"in_progress"|"implemented";preview?:string;note:string};acceptance?:{file:string;note:string;screenshot?:string;recordedAt:string;code?:string|null;artboard?:string};acceptanceCurrent?:boolean};
export type Comment={id:string;file:string;selector:string;excerpt:string;text:string;status:"open"|"resolved";recordedAt:string;screenshot?:string};
const segment=(s:string)=>/^[a-zA-Z0-9_.-]+$/.test(s)&&s!=="."&&s!=="..";
const slugOK=(s:string)=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
export function designPath(cwd:string,slug:string,file="design.json"):string {
  if(!slugOK(slug)||!file.split("/").every(segment))throw new Error("Ruta de diseño inválida");
  let path=projectRoot(cwd);
  for(const part of ["docs","design",slug,...file.split("/")]){path=join(path,part);if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw new Error("Un diseño no puede atravesar enlaces simbólicos");}
  return path;
}
function text(v:unknown,max=2000):string {if(typeof v!=="string"||v.length>max||/[\x00-\x08\x0b-\x1f\x7f]/.test(v))throw new Error("Texto de diseño inválido");return v;}
export function readDesign(cwd:string,slug:string):Design {
  const d=smallJSON(designPath(cwd,slug)) as Design;
  if(!d||d.schema!==1||!Array.isArray(d.artboards)||!d.artboards.length||d.artboards.length>12)throw new Error("Manifest de diseño inválido");
  text(d.title,200);text(d.brief);const seen=new Set<string>();
  for(const a of d.artboards){if(!a.file?.endsWith(".html")||seen.has(a.file))throw new Error("Variante inválida o repetida");designPath(cwd,slug,a.file);seen.add(a.file);text(a.title,200);text(a.tradeoff,500);}
  if(d.chosen&&!seen.has(d.chosen))throw new Error("Dirección elegida inexistente");
  if(d.implementation){board(d,d.implementation.file);text(d.implementation.note);if(d.implementation.preview)previewURL(d.implementation.preview);}
  const acceptanceCurrent=Boolean(d.acceptance && d.acceptance.code && d.acceptance.code===fingerprint(cwd,true) && d.acceptance.artboard===createHash("sha256").update(readFileSync(designPath(cwd,slug,d.acceptance.file))).digest("hex"));
  return {...d,slug,acceptanceCurrent};
}
export function listDesigns(cwd:string):{designs:Design[];invalid:string[]} {
  const directory=join(projectRoot(cwd),"docs/design");const designs:Design[]=[],invalid:string[]=[];
  if(!existsSync(directory))return {designs,invalid};
  if(lstatSync(directory).isSymbolicLink())throw new Error("Directorio de diseño enlazado");
  for(const slug of readdirSync(directory).filter(slugOK)){try{if(existsSync(designPath(cwd,slug)))designs.push(readDesign(cwd,slug));}catch{invalid.push(slug);}}
  return {designs,invalid};
}
export function readComments(cwd:string,slug:string):Comment[] {
  const path=designPath(cwd,slug,"comments.json");if(!existsSync(path))return [];
  const comments=smallJSON(path) as Comment[];
  if(!Array.isArray(comments)||comments.length>200||comments.some(c=>!c.id||!["open","resolved"].includes(c.status)||typeof c.text!=="string"))throw new Error("Comentarios ilegibles; se conservan");
  return comments;
}
function board(d:Design,file:unknown):string {if(typeof file!=="string"||!d.artboards.some(a=>a.file===file))throw new Error("Variante no registrada");return file;}
export function previewURL(value:unknown):string {
  const u=new URL(String(value));if(!["http:","https:"].includes(u.protocol)||!["localhost","127.0.0.1","[::1]"].includes(u.hostname)||u.username||u.password||String(value).length>2048)throw new Error("La comparación necesita una URL local sin credenciales");return u.href;
}
function saveImage(cwd:string,slug:string,input:unknown):string|undefined {
  if(input===undefined)return;
  const v=input as {type:string;data:string};if(!v||typeof v.data!=="string"||v.data.length>3_000_000)throw new Error("Captura demasiado grande");
  const b=Buffer.from(v.data,"base64");
  const png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=b[0]===255&&b[1]===216&&b[2]===255;
  if(!(v.type==="image/png"&&png||v.type==="image/jpeg"&&jpg))throw new Error("Captura PNG o JPEG requerida");
  const file=`images/${randomUUID()}.${png?"png":"jpg"}`,path=designPath(cwd,slug,file);
  mkdirSync(join(path,".."),{recursive:true});writeFileSync(path,b,{flag:"wx",mode:0o600});return file;
}
// Bloqueo corto por diseño, nunca por proyecto: dos pestañas/CLIs no pierden decisiones.
async function locked<T>(cwd:string,slug:string,fn:()=>T):Promise<T>{
  const lock=designPath(cwd,slug,".nein-lock");let held=false;
  for(let i=0;i<20;i++){try{writeFileSync(lock,String(process.pid),{flag:"wx",mode:0o600});held=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;await new Promise(r=>setTimeout(r,50));}}
  if(!held)throw new Error("El diseño tiene otra escritura o un bloqueo anterior; no se sobrescribe.");
  try{return fn();}finally{unlinkSync(lock);}
}
export async function changeDesign(cwd:string,slug:string,input:unknown):Promise<unknown>{
  if(!input||typeof input!=="object")throw new Error("Acción de diseño inválida");
  const v=input as Record<string,unknown>;readDesign(cwd,slug);
  return locked(cwd,slug,()=>{
    const d=readDesign(cwd,slug),file=board(d,v.file);
    if(v.action==="comment"){
      const list=readComments(cwd,slug);if(list.length>=200)throw new Error("Límite de comentarios alcanzado");
      const comment:Comment={id:randomUUID(),file,selector:text(v.selector??"",500),excerpt:text(v.excerpt??"",500),text:text(v.text),status:"open",recordedAt:new Date().toISOString(),screenshot:saveImage(cwd,slug,v.screenshot)};
      if(!comment.text.trim())throw new Error("Comentario vacío");list.push(comment);atomicJSON(designPath(cwd,slug,"comments.json"),list);return comment;
    }
    if(v.action==="resolve"){
      const list=readComments(cwd,slug),c=list.find(c=>c.id===v.id&&c.file===file);if(!c)throw new Error("Comentario desconocido");c.status="resolved";atomicJSON(designPath(cwd,slug,"comments.json"),list);return c;
    }
    if(v.action==="choose"){d.chosen=file;delete d.acceptance;}
    else if(v.action==="implement"){
      if(d.chosen!==file)throw new Error("Elige primero esta dirección");
      if(!["in_progress","implemented"].includes(String(v.status)))throw new Error("Estado de implementación inválido");
      d.implementation={file,status:v.status as "implemented"|"in_progress",note:text(v.note??""),...(v.preview?{preview:previewURL(v.preview)}:{})};delete d.acceptance;
    }else if(v.action==="accept"){
      if(d.chosen!==file||d.implementation?.file!==file||d.implementation.status!=="implemented")throw new Error("La dirección aún no está implementada");
      const note=text(v.note);if(!note.trim())throw new Error("Describe qué has comprobado visualmente");
      d.acceptance={file,note,recordedAt:new Date().toISOString(),code:fingerprint(cwd,true),artboard:createHash("sha256").update(readFileSync(designPath(cwd,slug,file))).digest("hex"),screenshot:saveImage(cwd,slug,v.screenshot)};
    }else throw new Error("Acción desconocida");
    atomicJSON(designPath(cwd,slug),d);return d;
  });
}
export function artboardHTML(cwd:string,slug:string,file:string):string {
  board(readDesign(cwd,slug),file);const path=designPath(cwd,slug,file);
  if(lstatSync(path).size>2_000_000)throw new Error("HTML demasiado grande");
  const html=readFileSync(path,"utf8");
  // El iframe tiene origen opaco. Solo comunica una referencia al elemento que
  // el usuario señala; el comentario se guarda al pulsar su botón en la página.
  return html+`<script>document.addEventListener('click',e=>{let n=e.target;if(!(n instanceof Element))return;let p=[];for(let i=0;n&&i<5;i++,n=n.parentElement)p.unshift(n.tagName.toLowerCase()+':nth-of-type('+(Array.from(n.parentElement?.children||[]).filter(x=>x.tagName===n.tagName).indexOf(n)+1)+')');parent.postMessage({kind:'nein-design-pick',file:${JSON.stringify(file)},selector:p.join(' > '),excerpt:(e.target.textContent||'').slice(0,300)},'*')},true)</script>`;
}
