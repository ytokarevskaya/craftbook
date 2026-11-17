import {existsSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {parseEnv} from 'node:util';
import {z} from 'zod';
import {cloudConnections,serializeEnv,required} from './config';
import {api,verifyTargets} from './api';
import {cloudTarget} from '../../src/lib/cloud-target';
import {runOperation} from '../ops/service';
async function main() {
 const c=cloudConnections(),path='.env.pilot-login.local';
 try {
  await verifyTargets(c.env);
  const policy=await api('supabase',`/v1/projects/${cloudTarget.projectRef}/config/auth`);
  if(!policy.disable_signup||policy.site_url!==cloudTarget.origin)throw new Error('AUTH_POLICY_NOT_READY');
  if(!existsSync(path)) {
   const email=z.email().parse(required(c.env,'FIRST_ACCOUNT_EMAIL'));
   writeFileSync(path,serializeEnv({EMAIL:email,TEMPORARY_PASSWORD:randomBytes(24).toString('base64url'),OPERATION_ID:randomUUID()}),{mode:0o600,flag:'wx'});
  }
  if((statSync(path).mode&0o077)!==0)throw new Error('LOGIN_FILE_PERMISSIONS');
  const login=parseEnv(readFileSync(path,'utf8'));
  const result=await runOperation({pool:c.migration,admin:c.admin,authUrl:c.authUrl,publicKey:c.publicKey,cloudProject:cloudTarget.projectRef},
   {kind:'create',key:login.OPERATION_ID!,reference:'První pilotní účet',email:login.EMAIL,password:login.TEMPORARY_PASSWORD});
  writeFileSync(path,serializeEnv({EMAIL:login.EMAIL!,TEMPORARY_PASSWORD:login.TEMPORARY_PASSWORD!,OPERATION_ID:login.OPERATION_ID!,ACCOUNT_ID:result.targetId}),{mode:0o600});
  console.log('První účet připraven v pending_password na 48 h. Přihlašovací údaje jsou pouze v chráněném ignorovaném .env.pilot-login.local; heslo nebylo vypsáno.');
 }finally{await c.migration.end();await c.runtime?.end();}
}
void main().catch(()=>{console.error('První účet nebyl dokončen. Zachovejte soubor operace a použijte cloud:account:status/resume; heslo neposílejte do chatu.');process.exitCode=1;});
