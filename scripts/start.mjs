import { spawn } from 'node:child_process';
const port=process.env.PORT??'3000';
if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('INVALID_PORT');
// Preserve explicit Next CLI args used by local E2E servers.
const args=process.argv.slice(2);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',port,...args],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('START_FAILED');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
