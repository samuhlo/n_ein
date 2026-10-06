import { writeFileSync } from 'node:fs';
if(process.env.N_EIN_TEST_PID)writeFileSync(process.env.N_EIN_TEST_PID,String(process.pid));
import { ownedShell } from '../../pi-package/agents/shell.ts';
await ownedShell(process.env.N_EIN_WORKER_HOST!).exec(process.argv[2],process.cwd(),{onData:()=>{}});
