// [UI] ENCARGO LOCAL
// Un servidor por proyecto/canal. Las peticiones necesitan token y origen propio;
// abrir la vista no lanza modelos ni modifica el proyecto.
import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listDesigns, readDesign, readComments, changeDesign, artboardHTML, designPath } from "./design.ts";
import { inspectWork } from "./evidence.ts";
import { atomicJSON, dataDir, listSessions } from "./state.ts";
export type WorkServer = {pid:number;port:number;token:string;build:string};
export const serverPath=(root:string,cwd:string)=>join(dataDir(root,cwd),"server.json");
export const buildId=(root:string)=>createHash("sha256").update(["state.ts","evidence.ts","server.ts","web.ts","design.ts","design-web.ts"].map(p=>readFileSync(join(root,"pi-package/workspace",p))).join("\n")).digest("hex");
export const workHTML = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>n_ein · Encargo</title>
<style>body{margin:0;background:#141414;color:#FAF3F0;font:16px system-ui;line-height:1.5}main{max-width:1100px;margin:auto;padding:32px}h1,h2{font-size:18px;letter-spacing:.08em}h1,b{color:#FFCA40}section{border-top:1px solid #444;margin-top:28px;padding-top:16px}button,input,textarea{font:inherit;background:#222;color:inherit;border:1px solid #777;padding:8px}button{cursor:pointer}article{padding:12px 0;border-bottom:1px solid #333}small{color:#aaa}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#FFCA40}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #444;padding:10px;vertical-align:top}p{white-space:pre-wrap}#error{color:#ffaaa0}@media(max-width:600px){main{padding:16px}table{font-size:13px}}</style>
<main><h1>// 004 ENCARGO</h1><button id="refresh">Actualizar</button><p id="error" role="alert"></p><div id="work"></div><section><h2>SESIONES</h2><input id="search" placeholder="Buscar objetivo o siguiente paso" aria-label="Buscar sesiones"><div id="sessions"></div></section><section id="design"><h2>DISEÑOS</h2><div id="designs"></div></section></main><script type="module" src="/app.js"></script></html>`;
export async function serveWork(root:string,cwd:string, options:{token?:string;port?:number;publish?:boolean}={}) {
  const built=await Bun.build({entrypoints:[join(root,"pi-package/workspace/web.ts")],target:"browser",minify:true});
  if(!built.success) throw new Error("La vista del encargo no compila");
  const js=await built.outputs[0].text(),token=options.token??randomBytes(32).toString("hex"),build=buildId(root);
  let last=Date.now();
  const server=Bun.serve({hostname:"127.0.0.1",port:options.port??0,maxRequestBodySize:4*1024*1024,
    async fetch(req) {
      const url=new URL(req.url),host=`127.0.0.1:${server.port}`;
      if(req.headers.get("host")!==host || (req.headers.has("origin") && req.headers.get("origin")!==`http://${host}`)) return new Response("Origen rechazado",{status:403});
      if(req.method!=="GET" && req.method!=="POST") return new Response("Método rechazado",{status:405});
      if(url.pathname==="/") return new Response(workHTML,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; style-src 'unsafe-inline'; frame-src http://127.0.0.1:* http://localhost:*; object-src 'none'; base-uri 'none'; frame-ancestors 'none'","Referrer-Policy":"no-referrer"}});
      if(url.pathname==="/app.js") return new Response(js,{headers:{"Content-Type":"application/javascript"}});
      const frameAccess = ["/artboard","/image"].includes(url.pathname) && url.searchParams.get("token") === token;
      if(!frameAccess && req.headers.get("authorization")!==`Bearer ${token}`) return new Response("Acceso rechazado",{status:403});
      last=Date.now();
      try {
        const slug=url.searchParams.get("slug")??"";
        if(req.method==="POST") {
          if(url.pathname!=="/design")return new Response("Método rechazado",{status:405});
          if(!req.headers.get("content-type")?.startsWith("application/json"))return new Response("JSON requerido",{status:415});
          return Response.json(await changeDesign(cwd,slug,await req.json()));
        }
        if(url.pathname==="/designs") return Response.json(listDesigns(cwd));
        if(url.pathname==="/design") return Response.json({design:readDesign(cwd,slug),comments:readComments(cwd,slug)});
        if(url.pathname==="/artboard") return new Response(artboardHTML(cwd,slug,url.searchParams.get("file")??""),{headers:{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox allow-scripts","Referrer-Policy":"no-referrer"}});
        if(url.pathname==="/image") {
          const file=url.searchParams.get("file")??"";
          if(!/^images\/[a-f0-9-]+\.(png|jpg)$/.test(file))throw new Error("Captura inválida");
          return new Response(readFileSync(designPath(cwd,slug,file)),{headers:{"Content-Type":file.endsWith(".png")?"image/png":"image/jpeg","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
        }
      }catch(error){return new Response(String(error),{status:400});}
      if(url.pathname==="/health") return Response.json({build});
      if(url.pathname==="/state") return Response.json({work:inspectWork(root,cwd),sessions:listSessions(root,cwd,url.searchParams.get("query")??"")});
      return new Response("No encontrado",{status:404});
    }});
  const state:WorkServer={pid:process.pid,port:server.port!,token,build};
  if(options.publish!==false)atomicJSON(serverPath(root,cwd),state);
  const timer=setInterval(()=>{if(Date.now()-last>2*60*60_000){server.stop();clearInterval(timer);}},60_000);timer.unref();
  return {server,state,close:()=>{clearInterval(timer);server.stop(true);}};
}
