// =============================================================================
// [FLOW] COMANDOS DEL TRABAJADOR
// Cada bash tiene su propio propietario del pipe y hereda el bloqueo del árbol.
// Si Pi muere, EOF llega al host aunque bash haya creado otro grupo de procesos.
// =============================================================================
import { spawn } from 'node:child_process';
import type { BashOperations } from '@earendil-works/pi-coding-agent';

export function ownedShell(host: string): BashOperations {
  return { exec(command,cwd,options) {
    return new Promise((resolve,reject)=>{
      if(options.signal?.aborted){reject(new Error('aborted'));return;}
      const child=spawn(host,['--worker-host','--project',cwd,'--','/bin/bash','-c',command],{
        cwd,detached:true,env:{...process.env,...options.env,N_EIN_LEASE_FD:'3'},stdio:['pipe','pipe','pipe',3],
      });
      let stopped=false;
      const stop=()=>{stopped=true;child.stdin.end();};
      const timer=options.timeout?setTimeout(stop,options.timeout*1000):undefined;
      options.signal?.addEventListener('abort',stop,{once:true});
      child.stdout.on('data',options.onData);child.stderr.on('data',options.onData);child.stdin.on('error',()=>{});
      child.once('error',reject);
      child.once('close',code=>{if(timer)clearTimeout(timer);options.signal?.removeEventListener('abort',stop);resolve({exitCode:stopped?130:code});});
    });
  }};
}
