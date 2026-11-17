import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { command } from '../recovery/environment';
// Local ops core, never imported by the web. Credentials only in a 0600 pgpass.
export async function dumpDatabase(connectionString:string,verifiedTls:boolean,ca?:string) {
 const url=new URL(connectionString),dir=await mkdtemp(join(tmpdir(),'craftbook-pgdump-'));
 try {
  const image=(await command('docker',['inspect','supabase_db_craftbook-local','--format','{{.Image}}'])).toString().trim();
  if(!/^sha256:[a-f0-9]{64}$/.test(image))throw new Error('PG_DUMP_IMAGE_MISSING');
  const host=['127.0.0.1','localhost'].includes(url.hostname)?'host.docker.internal':url.hostname;
  if(!verifiedTls&&host!=='host.docker.internal')throw new Error('REMOTE_DUMP_REQUIRES_TLS');
  const escape=(value:string)=>value.replaceAll('\\','\\\\').replaceAll(':','\\:');
  const pass=[host,url.port||'5432',url.pathname.slice(1),decodeURIComponent(url.username),decodeURIComponent(url.password)].map(escape).join(':')+'\n';
  await writeFile(join(dir,'pgpass'),pass,{mode:0o600});
  if(ca)await writeFile(join(dir,'ca.pem'),ca,{mode:0o600});
  const env=['PGHOST='+host,'PGPORT='+(url.port||'5432'),'PGDATABASE=postgres','PGUSER='+decodeURIComponent(url.username),
   'PGPASSFILE=/run/craftbook/pgpass','PGSSLMODE='+(verifiedTls?'verify-full':'disable'),
   ...(verifiedTls?['PGSSLROOTCERT='+(ca?'/run/craftbook/ca.pem':'/etc/ssl/certs/ca-certificates.crt')]:[])];
  return await command('docker',['run','--rm','--user','0:0','--mount',`type=bind,src=${dir},dst=/run/craftbook,readonly`,...env.flatMap(value=>['--env',value]),'--entrypoint','pg_dump',image,
   '--no-password','--format=custom','--schema=app','--lock-wait-timeout=5000']);
 } finally {await rm(dir,{recursive:true,force:true});}
}
