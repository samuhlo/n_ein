// [UI] ELEGIR, COMENTAR Y CONTRASTAR
// El HTML del proyecto corre en un iframe aislado. Los comentarios nunca son
// instrucciones ejecutadas: el usuario lleva el encargo a su conversación.
import { api, el } from "./web.ts";
export async function showDesigns(token:string){
  const host=document.querySelector("#designs")!;
  const warn=(error:unknown)=>{document.querySelector("#error")!.textContent=String(error);};
  const list=async()=>{try{
    const data=await api("/designs");host.replaceChildren();
    if(!data.designs.length)host.append(el("p","Aquí aparecerán las variantes de diseño que prepares con n_ein."));
    for(const d of data.designs){const b=el("button",d.title);b.onclick=()=>{void open(d.slug);};host.append(b);}
    if(data.invalid.length)host.append(el("p",`Diseños no legibles: ${data.invalid.join(", ")}`));
  }catch(e){warn(e);}};
  let picked:((e:MessageEvent)=>void)|undefined;
  const open=async(slug:string,file?:string)=>{try{
    const data=await api(`/design?slug=${encodeURIComponent(slug)}`),d=data.design,selected=file??d.chosen??d.artboards[0].file;
    if(picked)window.removeEventListener("message",picked);
    host.replaceChildren();const back=el("button","Todos los diseños");back.onclick=()=>{void list();};host.append(back,el("h3",d.title),el("p",d.brief));
    for(const a of d.artboards){const b=el("button",`${d.chosen===a.file?"✓ ":""}${a.title}`);b.title=a.tradeoff;b.onclick=()=>{void open(slug,a.file);};host.append(b);}
    const frame=document.createElement("iframe");frame.title="Variante de diseño";frame.sandbox.add("allow-scripts");frame.referrerPolicy="no-referrer";frame.style.cssText="width:100%;height:580px;border:1px solid #555;background:white";
    frame.src=`/artboard?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(selected)}&token=${encodeURIComponent(token)}`;host.append(frame);
    const post=async(body:unknown)=>{try{await api(`/design?slug=${encodeURIComponent(slug)}`,body);await open(slug,selected);}catch(e){warn(e);}};
    const choose=el("button",d.chosen===selected?"Dirección elegida":"Elegir esta dirección");(choose as HTMLButtonElement).disabled=d.chosen===selected;choose.onclick=()=>{void post({action:"choose",file:selected});};host.append(choose);
    const request=el("button","Preparar implementación / comentarios");request.onclick=()=>{
      const message=`Trabaja sobre el diseño docs/design/${slug}. Dirección: ${selected}. ${d.chosen===selected?"Implementa la dirección elegida y aplica los comentarios abiertos dentro del alcance acordado.":"Revisa esta alternativa; todavía no autoriza implementarla."} Consulta el manifiesto y comments.json antes de cambiar código.`;
      const text=el("pre",message);host.append(text);void navigator.clipboard?.writeText(message).catch(()=>{});
    };host.append(request,el("p","Copia el encargo a la conversación para que el agente continúe. Señala un elemento del boceto y escribe tu comentario."));
    const target=el("small","Sin elemento señalado"),input=document.createElement("textarea"),image=document.createElement("input");
    input.placeholder="Qué quieres cambiar";input.setAttribute("aria-label","Comentario sobre el diseño");input.style.cssText="display:block;width:95%;min-height:80px";
    image.type="file";image.accept="image/png,image/jpeg";image.setAttribute("aria-label","Captura opcional");let selector="",excerpt="";
    picked=e=>{if(e.source!==frame.contentWindow||e.data?.kind!=="nein-design-pick"||e.data.file!==selected)return;selector=String(e.data.selector).slice(0,500);excerpt=String(e.data.excerpt).slice(0,500);target.textContent=`Elemento: ${excerpt||selector}`;};window.addEventListener("message",picked);
    const screenshot=async()=>{const f=image.files?.[0];if(!f)return undefined;if(f.size>2_000_000)throw new Error("La captura debe ocupar menos de 2 MB");const bytes=new Uint8Array(await f.arrayBuffer());let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return {type:f.type,data:btoa(binary)};};
    const add=el("button","Guardar comentario");add.onclick=()=>{void screenshot().then(s=>post({action:"comment",file:selected,selector,excerpt,text:input.value,screenshot:s})).catch(warn);};
    host.append(target,input,image,add);
    for(const c of data.comments.filter((c:any)=>c.file===selected)){const row=el("article");row.append(el("b",c.status==="resolved"?"Resuelto":"Pendiente"),el("p",c.text),el("small",c.excerpt||c.selector));
      if(c.screenshot){const img=document.createElement("img");img.alt="Captura del comentario";img.style.maxWidth="100%";img.src=`/image?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(c.screenshot)}&token=${encodeURIComponent(token)}`;row.append(img);}host.append(row);}
    const impl=d.implementation;
    if(impl?.file===selected){host.append(el("h3",impl.status==="implemented"?"Implementación entregada":"Implementación en curso"),el("p",impl.note));
      if(impl.preview){const preview=document.createElement("iframe");preview.title="Aplicación implementada";preview.src=impl.preview;preview.sandbox.add("allow-scripts","allow-forms");preview.referrerPolicy="no-referrer";preview.style.cssText=frame.style.cssText;host.append(el("h3","Comparar con la aplicación"),preview);const link=el("a","Abrir aplicación en otra pestaña") as HTMLAnchorElement;link.href=impl.preview;link.target="_blank";link.rel="noopener noreferrer";host.append(link);}
      if(impl.status==="implemented"&&d.chosen===selected){const note=document.createElement("textarea");note.placeholder="Qué comprobaste: pantallas, vacío, carga, error y recuperación";note.setAttribute("aria-label","Comprobación visual");const accept=el("button","Registrar comprobación visual");accept.onclick=()=>{void screenshot().then(s=>post({action:"accept",file:selected,note:note.value,screenshot:s})).catch(warn);};host.append(el("h3","Comprobación visual"),note,accept);}
    }
    if(d.acceptance){host.append(el("p",`${d.acceptanceCurrent?"Comprobación visual registrada para este código":"Comprobación visual histórica; hay que contrastarla con el estado actual"}: ${d.acceptance.note}`));}
  }catch(e){warn(e);}};
  await list();
}
