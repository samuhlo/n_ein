// =============================================================================
// [BENCH] EQUIPO FRENTE A EJECUCIÓN DIRECTA
// Copias y productos congelados. Variantes en serie; incluye todos los hijos.
// uso: bun evals/bench/parallel.ts s6|s2|s3 serial|team identificador
// =============================================================================
import {spawn,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,cpSync,readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {acceptanceStatus} from './acceptance.ts';
const repo=resolve(import.meta.dir,'../..');
const [scenario,arm,id]=process.argv.slice(2);
if(!['s6','s2','s3'].includes(scenario)||!['serial','team'].includes(arm)||!id||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('scenario arm unique-id required');
const bench=process.env.N_EIN_BENCH||resolve(repo,'../n_ein-bench');
const project=join(bench,'copies',id),log=join(bench,'logs',id),product=join(bench,'products',id);
if(existsSync(project)||existsSync(log)||existsSync(product))throw new Error('Run already exists; preserve it.');
mkdirSync(log,{recursive:true});mkdirSync(product,{recursive:true});
execFileSync('cp',['-c','-R',join(bench,'bases/4d66007'),project]);
const revision=arm==='serial'?'b619eaa':execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const archive=join(log,'product.tar');execFileSync('git',['archive','--format=tar',`--output=${archive}`,revision],{cwd:repo});execFileSync('tar',['-xf',archive,'-C',product]);
mkdirSync(join(product,'dist'));cpSync(join(repo,'dist/n-ein'),join(product,'dist/n-ein'));
const base=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim();
const prompt={s6:'En el panel del centro, que el título «Los cursos del centro» muestre cuántos cursos hay, por ejemplo «Los cursos del centro (3)». Si no hay ninguno, el título se queda como está.',s2:'Haz que el Anexo III lea la planificación guardada del curso en el servidor en vez del cuerpo que manda el cliente, y que el cliente deje de mandarla cuando hay curso.',s3:'Cierra las deudas de docs/alpha-v1/estado-actual.md: que al dar de alta un centro se rechace a quien ya tiene cursos propios o módulos asignados; que tests/pages/anexo-iv-codigo.test.ts monte el componente en vez de leerlo como texto; y corrige el documento, que todavía da en gris el botón «Crear un curso» del centro.'}[scenario]!;
const model={model:'openai/gpt-6-sol',thinking:'medium'};
writeFileSync(join(log,'models.json'),JSON.stringify({schema:1,agents:{principal:model,mecanico:model,ordinario:model,riesgo:model,abierto:model}}));
writeFileSync(join(log,'lang.json'),JSON.stringify({chat:'es',artifacts:'proyecto'}));
writeFileSync(join(log,'meta.json'),JSON.stringify({run:id,scenario,arm,sourceCommit:revision,base_rev:base,model}));
const env={...process.env,N_EIN_AGENT_DIR:join(homedir(),'.n_ein/preview/pi-agent'),N_EIN_MODELS_FILE:join(log,'models.json'),N_EIN_LANG_FILE:join(log,'lang.json'),N_EIN_TEAM_SESSION_DIR:join(log,'workers'),N_EIN_TEAM:arm==='team'?'1':'0',PI_OFFLINE:'1',DO_NOT_TRACK:'1'};
const out=Bun.file(join(log,'events.jsonl')).writer(),err=Bun.file(join(log,'stderr')).writer();
const started=Date.now();
const child=spawn(join(product,'dist/n-ein'),['--root',product,'--project',project,'--runtime','pi','--','--mode','json','--print','--session-dir',join(log,'sessions'),prompt],{cwd:project,env,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',x=>out.write(x));child.stderr.on('data',x=>err.write(x));
const timeout=setTimeout(()=>child.kill('SIGTERM'),1_200_000);
const exit=await new Promise<number|null>((r,j)=>{child.once('close',r);child.once('error',j)});clearTimeout(timeout);await out.end();await err.end();
const modelSeconds=(Date.now()-started)/1000;
const events=readFileSync(join(log,'events.jsonl'),'utf8').split('\n').flatMap(l=>{try{return [JSON.parse(l)]}catch{return []}});
const messages=events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').map(e=>e.message);
const dir=join(project,'.git/n_ein/team');
const tasks=existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(join(dir,f),'utf8'))):[];
const summary={id,scenario,arm,revision,exit,modelSeconds,childCount:tasks.length,tokens:messages.reduce((s,m)=>s+(m.usage?.input??0)+(m.usage?.output??0)+(m.usage?.cacheRead??0)+(m.usage?.cacheWrite??0),0)+tasks.reduce((s,t)=>s+t.tokens,0),catalogUsd:messages.reduce((s,m)=>s+(m.usage?.cost?.total??0),0)+tasks.reduce((s,t)=>s+t.cost,0),tasks:tasks.map(t=>({id:t.id,status:t.status,error:t.error})),last:messages.at(-1)};
writeFileSync(join(log,'parallel.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,last:undefined}));
const graded=spawn(join(repo,'evals/bench/grade.sh'),[id],{cwd:repo,env:{...process.env,N_EIN_BENCH:bench,N_EIN_REPO:repo},stdio:['ignore','pipe','pipe']});let gradeOut='';graded.stdout.on('data',x=>gradeOut+=x);graded.stderr.on('data',()=>{});
await new Promise<void>(r=>graded.once('close',()=>r()));
const grade=JSON.parse(readFileSync(join(log,'grade.json'),'utf8'));
const acceptance=acceptanceStatus(scenario,grade);
writeFileSync(join(log,'parallel.json'),JSON.stringify({...summary,secondsToAcceptedResult:(Date.now()-started)/1000,grade,acceptance},null,2));console.log(JSON.stringify({id,acceptance,grade}));
