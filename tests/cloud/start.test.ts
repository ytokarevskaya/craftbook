import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {cloudTarget} from '../../src/lib/cloud-target';
test('Produkční start s nestandardním PORT a HTTPS redirect bez důvěry k podvrženému hostu',{timeout:30000},async()=>{
 const child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,PORT:'3198',APP_URL:cloudTarget.origin,NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
 try {
  let ready=false;
  for(let i=0;i<80;i++){
   if(child.exitCode!==null)throw new Error('START_FAILED');
   try{if((await fetch('http://127.0.0.1:3198/api/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(ready);
  const response=await fetch('http://127.0.0.1:3198/login?probe=1',{redirect:'manual',headers:{'x-forwarded-proto':'http','x-forwarded-host':'attacker.invalid',host:'attacker.invalid'}});
  assert.equal(response.status,308);assert.equal(response.headers.get('location'),cloudTarget.origin+'/login?probe=1');
  assert.deepEqual(await(await fetch('http://127.0.0.1:3198/api/health')).json(),{status:'ok'});
 }finally{if(child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await ended;}}
});
