import { showDesigns } from "./design-web.ts";
// [UI] ESTADO, CRITERIOS Y COMPROBACIONES
// Todo contenido del proyecto se dibuja como texto, nunca como HTML confiable.
const key="nein-work-token", token=location.hash.slice(1)||sessionStorage.getItem(key)||"";
if(token){sessionStorage.setItem(key,token);history.replaceState(null,"",location.pathname);}
export async function api(path:string,body?:unknown) {
  const r=await fetch(path,{method:body===undefined?"GET":"POST",headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{"content-type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Error(await r.text());return r.json();
}
export function el(tag:string,text=""):HTMLElement {const n=document.createElement(tag);n.textContent=text;return n;}
const label:Record<string,string>={verified:"comprobación superada",stale:"evidencia obsoleta",failed:"comprobación fallida",unknown:"vigencia desconocida"};
let generation=0;
async function refresh(){const mine=++generation;try{
  const data=await api(`/state?query=${encodeURIComponent((document.querySelector("#search") as HTMLInputElement).value)}`),w=data.work;
  if(mine!==generation)return;
  const box=document.querySelector("#work")!;box.replaceChildren(el("p",w.objective||"Sin documento activo"));
  const tasks=el("section");tasks.append(el("h2","TAREAS"));
  for(const t of w.tasks)tasks.append(el("p",`${t.done?"Implementado":"Pendiente"} · ${t.text}`));box.append(tasks);
  const section=el("section");section.append(el("h2","PETICIONES Y EVIDENCIA"),el("small","El resultado acredita la ejecución. El alcance de cada prueba está declarado por el agente; comprueba que cubre lo pedido."));
  const table=el("table"),head=el("tr");for(const t of ["Petición / tarea","Estado","Comprobación"])head.append(el("th",t));table.append(head);
  for(const c of w.criteria){const e=w.evidence.find((e:any)=>e.criterion===c.text),r=el("tr");r.append(el("td",c.text),el("td",e?label[e.state]:"Sin comprobar"));const detail=el("td");if(e){const d=el("details");d.append(el("summary",e.command.join(" ")),el("pre",`exit: ${e.exit??"desconocido"}\n${e.ended}\n${e.error??""}\nLog: ${e.log}`));detail.append(d);}r.append(detail);table.append(r);}section.append(table);box.append(section);
  if(w.invalid||w.omitted)box.append(el("p",`${w.invalid} registros no legibles · ${w.omitted} históricos omitidos`));
  box.append(el("h2","SIGUIENTE PASO"),el("p",w.next||"Sin publicar"));
  const sessions=document.querySelector("#sessions")!;sessions.replaceChildren();
  for(const s of data.sessions.sessions){const row=el("article");row.append(el("b",`${s.runtime} · ${s.objective||"Sin objetivo publicado"}`),el("p",`${s.progress}\nSiguiente: ${s.next||"sin publicar"}`),el("small",`${s.recordedAt}${s.stale?" · resumen antiguo":""} · ${s.id}`));sessions.append(row);}
  document.querySelector("#error")!.textContent="";
}catch(e){document.querySelector("#error")!.textContent=String(e);}}
document.querySelector("#refresh")!.addEventListener("click",refresh);
let searchTimer: ReturnType<typeof setTimeout>;
document.querySelector("#search")!.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(refresh,150);});
void refresh();

void showDesigns(token);
