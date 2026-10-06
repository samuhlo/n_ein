// =============================================================================
// [CORE] EQUIPO DE UN ENCARGO
// Las tareas pertenecen al proyecto; los procesos pertenecen a una sesión.
// Reanudar exige reconciliar ambos, no reconstruir un proceso desde un PID viejo.
// =============================================================================
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { memoryDirective } from '../memory.ts';
import { langDirective, loadLang } from '../lang.ts';
import { loadModels } from '../models.ts';
import { startWorker } from './rpc.ts';
import { TeamStore, type Assignment, type TaskRecord } from './store.ts';

export type TeamOptions={root:string;cwd:string;owner:string;onChange?():void;onResult?(task:TaskRecord):void;host?:string;env?:NodeJS.ProcessEnv};
export class TeamManager {
  readonly store:TeamStore;
  readonly host:string;
  private live=new Map<string,ReturnType<typeof startWorker>>();
  private closing=false;
  private owned=new Set<string>();
  private limit=2;
  private activity=new Map<string,string>();
  constructor(readonly options:TeamOptions){this.store=new TeamStore(options.cwd);this.host=options.host??(existsSync(join(options.root,'bin/n-ein'))?join(options.root,'bin/n-ein'):join(options.root,'dist/n-ein'));}
  private changed(){try{this.options.onChange?.();}catch{/* Un fallo visual no cancela trabajo. */}}
  list(){return this.store.list().map(t=>({...t,activity:this.activity.get(t.id)}));}
  free(cwd:string){try{execFileSync(this.host,['--worker-probe','--project',cwd],{stdio:'pipe',timeout:3000,env:{...process.env,N_EIN_LEASE_FD:''}});return true;}catch{return false;}}
  recover(){
    for(const t of this.store.list())if(['running','queued'].includes(t.status)&&!this.live.has(t.id)&&!this.owned.has(t.id)&&this.free(t.cwd)){
      try{this.store.snapshot(t.id);}catch{/* Un árbol ausente sigue siendo pendiente. */}
      this.store.update(t.id,{status:'interrupted',error:'Previous execution stopped; inspect preserved work and resume explicitly.'});
    }
    this.changed();
  }
  start(tasks:Omit<Assignment,'owner'>[]){
    if(this.closing||this.limit===0)throw new Error('Team is stopped; continue directly or explicitly enable workers.');
    if(!existsSync(this.host))throw new Error('Worker host missing; build or repair the n_ein package.');
    if(tasks.length<1||tasks.length>8)throw new Error('Assign between one and eight tasks; at most two run together.');
    const created:TaskRecord[]=[];
    try{for(const task of tasks){const record=this.store.create({...task,owner:this.options.owner});created.push(record);this.owned.add(record.id);}}
    finally{this.pump();this.changed();}
    return created;
  }
  resume(id:string,instruction:string){
    if(this.closing||this.limit===0)throw new Error('Workers are disabled.');
    const t=this.store.get(id);this.store.validateTree(t);
    if(this.live.has(id)||!this.free(t.cwd))throw new Error('Task still has a writer; do not replace it.');
    if(t.status==='integrated')throw new Error('Task already integrated; assign new work separately.');
    this.owned.add(id);this.activity.set(id,instruction);
    this.store.update(id,{status:'queued',owner:this.options.owner,error:undefined,delivered:false});this.pump();
  }
  private pump(){
    if(this.closing)return;
    for(const t of this.store.list().filter(t=>t.status==='queued'&&this.owned.has(t.id))){
      if(this.live.size>=this.limit)break;
      try{this.launch(t);}catch(e){this.store.update(t.id,{status:'failed',error:String(e)});this.changed();}
    }
  }
  private launch(t:TaskRecord){
    this.store.validateTree(t);if(!this.free(t.cwd))throw new Error('Worktree is already owned.');
    const {root}=this.options;
    const env={...process.env,...this.options.env,N_EIN_WORKER_HOST:this.host,N_EIN_CHILD:'1'};
    delete env.N_EIN_HANDOFF_SIGNAL;delete env.N_EIN_WORK_DOC;delete env.N_EIN_LEASE_FD;
    const models=loadModels(root);
    const agentHome=env.PI_CODING_AGENT_DIR||env.N_EIN_AGENT_DIR||join(env.N_EIN_HOME||join(homedir(),'.n_ein'),env.N_EIN_CHANNEL||'dev','pi-agent');
    env.PI_CODING_AGENT_DIR=agentHome;env.PI_SKIP_VERSION_CHECK='1';env.DO_NOT_TRACK='1';
    const sessions=env.N_EIN_TEAM_SESSION_DIR||join(agentHome,'team-sessions');mkdirSync(sessions,{recursive:true,mode:0o700});
    const session=t.session||join(sessions,`${t.id}.jsonl`);
    // Preparar el índice del árbol concreto; un fallo conserva la ruta directa.
    if(env.N_EIN_CODEGRAPH_BIN)try{execFileSync(join(root,'bin/n-ein-codegraph'),[],{cwd:t.cwd,env,stdio:'pipe',timeout:60_000});}catch{}
    const binary=env.N_EIN_PI_BIN||join(env.N_EIN_HOME||join(homedir(),'.n_ein'),'runtimes/pi',models.version,'bin/pi');
    if(!t.model.includes('/')||t.model.startsWith('nein/'))throw new Error('A worker requires a physical provider/model.');
    const instruction=this.activity.get(t.id)||'';
    const args=['--mode','rpc','--no-extensions','--no-skills','--no-themes','--no-prompt-templates',
      '-e',join(root,'pi-package/agents/child.ts'),'-e',join(root,'pi-package/extensions/codegraph.ts'),
      '--skill',join(root,'pi-package/skills'),'--model',t.model,'--thinking',t.thinking,'--session',session,
      '--append-system-prompt',join(root,'pi-package/persona.md'),'--append-system-prompt',join(root,'pi-package/agents/worker.md'),
      '--append-system-prompt',langDirective(loadLang(root)),'--append-system-prompt',memoryDirective()];
    const prompt=[`Authorized assignment ${t.taskId}: ${t.label}`,t.prompt,`Your branch: ${t.branch}. Base: ${t.base}.`,
      `The coordinator owns WORK.md at ${join(t.origin,'WORK.md')}; read it for context, do not edit either copy.`,
      'Implement only this assignment, check its behaviour and commit your own changes on this branch. Report changes, checks, remaining issues and the commit. Do not merge or publish. If blocked by a product decision, return BLOCKED: with the question; do not guess.',
      instruction?`Continuation: ${instruction}`:''].join('\n\n');
    this.store.update(t.id,{status:'running',attempt:t.attempt+1,session,error:undefined,delivered:false});
    const run=startWorker({host:this.host,cwd:t.cwd,binary,args,prompt,env,onEvent:event=>{
      if(event.type==='tool_execution_start'){this.activity.set(t.id,event.toolName);this.store.update(t.id,{activity:event.toolName});}
      if(event.type==='tool_execution_end')this.activity.set(t.id,'working');
      this.changed();
    }});
    this.live.set(t.id,run);
    void run.done.then(result=>{
      this.live.delete(t.id);this.activity.delete(t.id);
      try{
        this.store.snapshot(t.id);
        const saved=this.store.update(t.id,{status:result.status,result:result.text,error:result.error,tokens:t.tokens+result.tokens,cost:t.cost+result.cost,usageKnown:t.usageKnown||result.usageKnown});
        this.changed();this.options.onResult?.(saved);
      }catch(e){console.error(`[ERR] :: TEAM_SAVE :: reason: ${String(e)}`);}
      this.pump();
    });
    this.changed();
  }
  async wait(){while(this.live.size)await Promise.all([...this.live.values()].map(t=>t.done));return this.list();}
  async steer(id:string,message:string){const run=this.live.get(id);if(!run)throw new Error('Task is not running; use resume with the instruction.');await run.steer(message);}
  async stop(id?:string){
    const tasks=this.store.list().filter(t=>(!id||t.id===id)&&t.owner===this.options.owner);
    for(const t of tasks)if(t.status==='queued')this.store.update(t.id,{status:'stopped'});
    await Promise.all(tasks.map(t=>this.live.get(t.id)?.stop()));this.changed();
  }
  async setLimit(limit:number){this.limit=limit;const ids=[...this.live.keys()].slice(limit);for(const id of ids)await this.stop(id);if(limit===0)await this.stop();else this.pump();}
  async shutdown(){this.closing=true;await this.stop();}
  integrate(id:string){const t=this.store.get(id);if(!this.free(t.cwd))throw new Error('Worker tree still owned.');const value=this.store.integrate(id);this.changed();return value;}
}
