import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
const execute = promisify(execFile);
const cli = resolve('node_modules/.bin/supabase');
export type Marker = { version: 1; id: string; kind: 'source'|'target'; projectId: string; apiPort: number; dbPort: number };
export async function command(file: string, args: string[], input?: Buffer, timeout=180000) {
 return new Promise<Buffer>((resolve, reject) => {
  const child=spawn(file,args,{stdio:['pipe','pipe','pipe']}), chunks:Buffer[]=[];let size=0;
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('COMMAND_TIMEOUT'));},timeout);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>134217728){child.kill();reject(new Error('COMMAND_LIMIT'));}else chunks.push(chunk);});
  // Never surface raw CLI/docker/SQL diagnostics: may contain private rows/keys.
  child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(new Error('COMMAND_FAILED'));});
  child.on('close',code=>{clearTimeout(timer);if(code)reject(new Error('COMMAND_FAILED'));else resolve(Buffer.concat(chunks));});
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
export async function createEnvironment(root: string, kind: Marker['kind']) {
 const base=await realpath(root);
 if(!/^\/private\/tmp\/craftbook-recovery-[a-f0-9-]{36}$/.test(base))throw new Error('UNSAFE_RECOVERY_ROOT');
 const id=randomUUID(), workdir=join(base,kind), apiPort=kind==='source'?55321:56321;
 await mkdir(join(workdir,'supabase'),{recursive:true,mode:0o700});
 const marker:Marker={version:1,id,kind,projectId:`craftbook-r-${kind}-${id.slice(0,8)}`,apiPort,dbPort:apiPort+1};
 await writeFile(join(workdir,'recovery-marker.json'),JSON.stringify(marker),{mode:0o600,flag:'wx'});
 const config=(await readFile('supabase/config.toml','utf8')).replace('craftbook-local',marker.projectId).replaceAll('54321',String(apiPort)).replaceAll('54322',String(apiPort+1)).replaceAll('54320',String(apiPort-1));
 await writeFile(join(workdir,'supabase/config.toml'),config,{mode:0o600});
 return workdir;
}
export async function environmentMarker(workdir:string, requireTarget=false) {
 const path=await realpath(workdir);
 if(!/^\/private\/tmp\/craftbook-recovery-[a-f0-9-]{36}\/(source|target)$/.test(path))throw new Error('UNSAFE_RECOVERY_PATH');
 const m=JSON.parse(await readFile(join(path,'recovery-marker.json'),'utf8')) as Marker;
 if(m.version!==1||!['source','target'].includes(m.kind)||! /^[a-f0-9-]{36}$/.test(m.id)||m.projectId!==`craftbook-r-${m.kind}-${m.id.slice(0,8)}`||m.apiPort!==(m.kind==='source'?55321:56321)||m.dbPort!==m.apiPort+1||!path.endsWith('/'+m.kind)||(requireTarget&&m.kind!=='target'))throw new Error('UNSAFE_RECOVERY_MARKER');
 const config=await readFile(join(path,'supabase/config.toml'),'utf8');
 if(!config.includes(`project_id = "${m.projectId}"`)||!config.includes(`port = ${m.apiPort}`)||!config.includes(`port = ${m.dbPort}`))throw new Error('RECOVERY_CONFIG_MISMATCH');
 return m;
}
export async function assertRecoveryEnvironment(workdir:string, authUrl?:string, requireTarget=false) {
 const m=await environmentMarker(workdir,requireTarget);
 if(authUrl && authUrl!==`http://127.0.0.1:${m.apiPort}`)throw new Error('RECOVERY_URL_MISMATCH');
 const {stdout}=await execute('docker',['inspect',`supabase_db_${m.projectId}`,'--format','{{json .Config.Labels}}'],{timeout:10000});
 const labels=JSON.parse(stdout);
 if(labels['com.supabase.cli.project']!==m.projectId||labels['com.supabase.cli.workdir']!==await realpath(workdir))throw new Error('RECOVERY_CONTAINER_MISMATCH');
 return m;
}
export async function startEnvironment(workdir:string) {
 await environmentMarker(workdir);
 await command(cli,['start','--workdir',workdir,'--exclude','realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']);
 return connectEnvironment(workdir);
}
export async function connectEnvironment(workdir:string) {
 const marker=await assertRecoveryEnvironment(workdir);
 const status=JSON.parse((await command(cli,['status','--workdir',workdir,'-o','json'])).toString());
 if(status.API_URL!==`http://127.0.0.1:${marker.apiPort}`)throw new Error('RECOVERY_STATUS_MISMATCH');
 const dbUrl=new URL(status.DB_URL);
 if(dbUrl.hostname!=='127.0.0.1'||dbUrl.port!==String(marker.dbPort)||dbUrl.pathname!=='/postgres'||dbUrl.username!=='postgres')throw new Error('RECOVERY_DB_MISMATCH');
 const migration=new Pool({connectionString:dbUrl.href,max:3}),runtimePassword=randomBytes(30).toString('hex');
 dbUrl.username='craftbook_runtime';dbUrl.password=runtimePassword;
 const runtime=new Pool({connectionString:dbUrl.href,max:3});
 const authUrl=status.API_URL as string, publicKey=status.ANON_KEY as string,secretKey=status.SERVICE_ROLE_KEY as string;
 if(!publicKey||!secretKey)throw new Error('RECOVERY_KEYS_MISSING');
 const admin=createClient(authUrl,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
 return {workdir,marker,migration,runtime,runtimePassword,runtimeUrl:dbUrl.href,admin,authUrl,publicKey,secretKey};
}
export type Environment=Awaited<ReturnType<typeof connectEnvironment>>;
export async function setRuntimePassword(e:Environment) {
 // Generated hex only, never a caller-supplied SQL literal.
 await e.migration.query(`alter role craftbook_runtime password '${e.runtimePassword}'`);
}
export async function migrateEnvironment(e:Environment) {
 const {readdir}=await import('node:fs/promises');
 for(const file of (await readdir('supabase/migrations')).filter(f=>/^\d+_.*\.sql$/.test(f)).sort())await e.migration.query(await readFile(join('supabase/migrations',file),'utf8'));
 await setRuntimePassword(e);
}
export async function stopEnvironment(e:Environment) {
 await e.runtime.end();await e.migration.end();await assertRecoveryEnvironment(e.workdir);
 await command(cli,['stop','--workdir',e.workdir,'--no-backup']);
}
