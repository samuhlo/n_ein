// =============================================================================
// [FLOW] TRABAJO PARALELO POR CONVERSACIÓN
// El modelo decide el reparto; esta extensión ejecuta y conserva los hechos.
// =============================================================================
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeamManager } from '../agents/manager.ts';
import { type TaskRecord } from '../agents/store.ts';
import { loadModels } from '../models.ts';
import { newJobText } from '../router.ts';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const teams=new Map<string,TeamManager>();
export function teamReport(tasks:TaskRecord[]){return tasks.map(t=>({id:t.id,task:t.taskId,label:t.label,status:t.status,worktree:t.cwd,branch:t.branch,head:t.head,dirty:t.dirty,model:t.model,thinking:t.thinking,attempt:t.attempt,tokens:t.usageKnown?t.tokens:null,cost:t.usageKnown?t.cost:null,result:t.result?.slice(0,12000),error:t.error}));}
export async function stopTeam(cwd:string){const team=teams.get(cwd);if(team){await team.shutdown();for(const t of team.list())if(!team.free(t.cwd))throw new Error(`Cannot transfer: worker tree still owned: ${t.cwd}`);}}

export default function(pi:ExtensionAPI){
  if(process.env.N_EIN_CHILD==='1')return;
  let team:TeamManager|undefined,ctx:ExtensionContext|undefined,suspended=false,background=false;
  const initialize=async(next:ExtensionContext)=>{
    suspended=true;if(team)await team.shutdown();if(ctx)teams.delete(ctx.cwd);
    ctx=next;team=undefined;background=false;
    try{
      const owner=next.sessionManager.getSessionId();
      team=new TeamManager({root,cwd:next.cwd,owner,onResult:task=>{
        if(suspended||!background||!ctx||ctx.sessionManager.getSessionId()!==owner)return;
        const key=`${task.id}:${task.attempt}`;
        const seen=ctx.sessionManager.getBranch().some((e:any)=>e.type==='custom_message'&&e.customType==='nein.team.result'&&e.details?.key===key);
        if(!seen)pi.sendMessage({customType:'nein.team.result',content:JSON.stringify(teamReport([task])),display:true,details:{key}},{deliverAs:'steer',triggerTurn:true});
        team!.store.update(task.id,{delivered:true});
      }});
      team.recover();teams.set(next.cwd,team);suspended=false;
    }catch{/* Fuera de Git, o sin estado legible, el trabajo directo sigue disponible. */}
  };
  pi.on('session_start',async(_event,next)=>{await initialize(next);});
  pi.on('session_shutdown',async()=>{suspended=true;await team?.shutdown();if(ctx)teams.delete(ctx.cwd);});
  pi.on('session_before_switch',async()=>{suspended=true;await team?.shutdown();});
  pi.on('session_before_fork',async()=>{suspended=true;await team?.shutdown();});
  pi.on('input',async(event)=>{if(newJobText(event.text)!==undefined){suspended=true;await team?.shutdown();}});
  if(process.env.N_EIN_TEAM==='0')return;
  pi.registerTool({
    name:'nein_team',label:'Equipo',
    description:'Manage general-purpose Pi workers for an AUTHORIZED implementation. Delegate only substantial independent tasks with a committed common base and WORK.md. At most two workers run, each in a separate worktree. Prefer direct work for small/dependent tasks. Start takes taskId, label, full bounded assignment with acceptance and relevant context, and class. Results are ready for coordinator review and integration, NOT overall acceptance. status recovers results; resume preserves partial work; integrate merges only an owned clean ready branch into the work branch. stop preserves changes. limit=0 means work alone. No recursive workers, remote delivery or new authorization. In interactive sessions results arrive automatically; do not poll.',
    parameters:Type.Object({action:Type.Union(['start','status','stop','resume','steer','integrate','limit'].map(x=>Type.Literal(x))),
      tasks:Type.Optional(Type.Array(Type.Object({taskId:Type.String(),label:Type.String(),prompt:Type.String(),class:Type.Union(['mecanico','ordinario','riesgo','abierto'].map(x=>Type.Literal(x))),dependsOn:Type.Optional(Type.Array(Type.String()))}))),
      id:Type.Optional(Type.String()),message:Type.Optional(Type.String()),limit:Type.Optional(Type.Integer({minimum:0,maximum:2}))}),
    async execute(_id,params,signal,_update,next){
      try{
        if(!team||suspended){await initialize(next);}
        ctx=next;if(!team)throw new Error('Team unavailable: inspect Git/work records and continue directly.');
        background=next.mode==='tui'||next.mode==='rpc';
        if(params.action==='start'){
          const config=loadModels(root);
          const tasks=(params.tasks??[]).map(t=>{
            const chosen=next.model&&next.model.provider!=='nein'?{model:`${next.model.provider}/${next.model.id}`,thinking:next.thinkingLevel??'medium'}:config.routing[t.class];
            return {taskId:t.taskId,label:t.label,prompt:t.prompt,dependsOn:t.dependsOn,...chosen};
          });
          team.start(tasks);
          if(!background){const stop=()=>{void team?.stop();};signal?.addEventListener('abort',stop,{once:true});try{await team.wait();}finally{signal?.removeEventListener('abort',stop);}}
        }else if(params.action==='stop')await team.stop(params.id);
        else if(params.action==='limit')await team.setLimit(params.limit??0);
        else if(params.action==='status')team.recover();
        else{
          if(!params.id)throw new Error('Task identity required.');
          if(params.action==='integrate')team.integrate(params.id);
          else if(params.action==='steer')await team.steer(params.id,params.message||'Report current blocker.');
          else if(params.action==='resume'){team.resume(params.id,params.message||'Continue the preserved assignment.');if(!background)await team.wait();}
        }
        return {content:[{type:'text',text:JSON.stringify(teamReport(team.list()))}],details:undefined};
      }catch(e){return {isError:true,content:[{type:'text',text:String(e)}],details:undefined};}
    },
  });
}
