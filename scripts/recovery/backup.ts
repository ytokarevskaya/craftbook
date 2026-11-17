import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import { cloudTarget } from '../../src/lib/cloud-target';
import { assertCloudOps } from '../cloud/guard';
import { command, assertRecoveryEnvironment, setRuntimePassword, type Environment } from './environment';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const bucketId='craftbook-private';
const bucketOptions={public:false,fileSizeLimit:10485760,allowedMimeTypes:['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown']};
export type BackupSource={admin:SupabaseClient;migration:Pool;projectId:string;configuration?:Record<string,unknown>;dump?:()=>Promise<Buffer>};
type Entry={path:string;bytes:number;sha256:string};
type ObjectEntry=Entry & {bucket:string;key:string;mime:string};
type Identity={id:string;email:string;blocked:boolean};
export type Manifest={format:'craftbook-ops-backup';version:1;complete:boolean;startedAt:string;finishedAt:string;projectId:string;versions:Record<string,string>;entries:Entry[];objects:ObjectEntry[];identities:Identity[];counts:Record<string,string>;configuration?:Record<string,unknown>};
export async function prepareStorage(admin:SupabaseClient,pool:Pool) {
 const found=await admin.storage.getBucket(bucketId);
 const result=found.data?await admin.storage.updateBucket(bucketId,bucketOptions):await admin.storage.createBucket(bucketId,bucketOptions);
 if(result.error)throw new Error('STORAGE_SETUP');
 await pool.query(`do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='craftbook_private_deny') then
 create policy craftbook_private_deny on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'craftbook-private') with check(bucket_id<>'craftbook-private'); end if; end $$`);
}
async function storageKeys(admin:SupabaseClient) {
 const buckets=await admin.storage.listBuckets();if(buckets.error)throw new Error('BUCKETS_FAILED');
 if(buckets.data.some(b=>b.id!==bucketId))throw new Error('UNEXPECTED_BUCKET');
 const keys:string[]=[];
 async function visit(prefix:string) {
  for(let offset=0;;offset+=100) {
   const result=await admin.storage.from(bucketId).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
   if(result.error)throw new Error('STORAGE_LIST_FAILED');
   for(const item of result.data) {
    const key=prefix?prefix+'/'+item.name:item.name;
    if(item.id)keys.push(key);else await visit(key);
    if(keys.length>10000||key.split('/').length>10)throw new Error('BACKUP_LIMIT');
   }
   if(result.data.length<100)break;
  }
 }
 if(buckets.data.length)await visit('');return keys.sort();
}
async function objectDownload(admin:SupabaseClient,key:string) {
 const result=await admin.storage.from(bucketId).download(key);
 if(result.error||!result.data||result.data.size>10485760)throw new Error('STORAGE_READ_FAILED');
 return {bytes:Buffer.from(await result.data.arrayBuffer()),mime:result.data.type};
}
async function objectBytes(admin:SupabaseClient,key:string) {return (await objectDownload(admin,key)).bytes;}
export async function backup(source:BackupSource,directory:string,maintenanceConfirmed:boolean) {
 if(!maintenanceConfirmed)throw new Error('MAINTENANCE_REQUIRED');
 if(source.projectId===cloudTarget.projectRef) {
  if(!source.dump)throw new Error('CLOUD_DUMP_REQUIRED');
  await assertCloudOps(source.migration,cloudTarget.authUrl);
 }else if(!/^craftbook-(local|r-source-[a-f0-9]{8})$/.test(source.projectId)||source.dump)throw new Error('UNSAFE_BACKUP_SOURCE');
 const path=resolve(directory),repo=await realpath('.');
 if(path===repo||path.startsWith(repo+'/'))throw new Error('BACKUP_INSIDE_REPOSITORY');
 await mkdir(path,{mode:0o700}); // existing output is never overwritten
 const actual=await realpath(path);if(actual===repo||actual.startsWith(repo+'/'))throw new Error('BACKUP_INSIDE_REPOSITORY');
 const startedAt=new Date().toISOString(),entries:Entry[]=[],objects:ObjectEntry[]=[],identities:Identity[]=[];
 const lock=await source.migration.connect();
 try {
  await lock.query('BEGIN');await lock.query("set local lock_timeout='5s'");
  const tables=(await lock.query<{name:string}>("select tablename as name from pg_tables where schemaname='app' order by tablename")).rows;
  if(!tables.length||tables.some(t=>!/^\w+$/.test(t.name)))throw new Error('SCHEMA_MISSING');
  // Maintenance operation: writers and cleanup are blocked across DB + Storage reads.
  await lock.query('LOCK TABLE '+tables.map(t=>'app."'+t.name+'"').join(',')+' IN SHARE MODE');
  if((await lock.query("select 1 from app.asset where state<>'ready' limit 1")).rowCount)throw new Error('UNFINISHED_UPLOADS');
  if((await lock.query('select 1 from app.export_lease where expires_at>now() limit 1')).rowCount)throw new Error('EXPORT_IN_PROGRESS');
  const counts:Record<string,string>={};
  for(const t of tables)counts[t.name]=(await lock.query('select count(*)::text n from app."'+t.name+'"')).rows[0].n;
  for(let page=1;;page++) {
   const result=await source.admin.auth.admin.listUsers({page,perPage:100});if(result.error)throw new Error('AUTH_LIST_FAILED');
   for(const user of result.data.users) {
    if(!user.email)throw new Error('UNSUPPORTED_IDENTITY');
    const banned=(user as typeof user & {banned_until?:string}).banned_until;
    identities.push({id:user.id,email:user.email,blocked:!!banned&&Date.parse(banned)>Date.now()});
   }
   if(result.data.users.length<100)break;if(page>100)throw new Error('BACKUP_LIMIT');
  }
  async function save(name:string,bytes:Buffer) {
   await writeFile(join(path,name),bytes,{mode:0o600,flag:'wx'});const entry={path:name,bytes:bytes.length,sha256:hash(bytes)};entries.push(entry);return entry;
  }
  await save('app.dump',source.dump?await source.dump():await command('docker',['exec',`supabase_db_${source.projectId}`,'pg_dump','-U','postgres','-d','postgres','--format=custom','--schema=app','--lock-wait-timeout=5000']));
  await mkdir(join(path,'migrations'),{mode:0o700});
  const allMigrations=(await readdir('supabase/migrations')).filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
  const applied=tables.some(t=>t.name==='schema_migration')?(await lock.query<{name:string;checksum:string}>('select name,checksum from app.schema_migration order by name')).rows:null;
  if(applied&&applied.some((r,i)=>r.name!==allMigrations[i]))throw new Error('BACKUP_MIGRATION_MISMATCH');
  for(const file of applied?applied.map(r=>r.name):allMigrations){
   const bytes=await readFile(join('supabase/migrations',file));
   if(applied&&applied.find(r=>r.name===file)?.checksum!==hash(bytes))throw new Error('BACKUP_MIGRATION_MISMATCH');
   await save('migrations/'+file,bytes);
  }
  await save('config.toml',await readFile('supabase/config.toml'));
  await save('runtime-role.sql',Buffer.from('CREATE ROLE craftbook_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\n'));
  await mkdir(join(path,'objects'),{mode:0o700});
  const keys=await storageKeys(source.admin);let total=0;
  const expected=(await lock.query<{storage_key:string;bytes:number;checksum:string}>('select storage_key,bytes,checksum from app.asset')).rows;
  if(expected.some(a=>!keys.includes(a.storage_key)))throw new Error('ASSET_OBJECT_MISSING');
  for(const [index,key] of keys.entries()) {
   const {bytes,mime}=await objectDownload(source.admin,key);total+=bytes.length;
   const asset=expected.find(a=>a.storage_key===key);
   if(asset&&(asset.bytes!==bytes.length||asset.checksum!==hash(bytes)))throw new Error('ASSET_OBJECT_CORRUPT');if(total>268435456)throw new Error('BACKUP_LIMIT');
   objects.push({...await save(`objects/${index}.bin`,bytes),bucket:bucketId,key,mime});
  }
  if(JSON.stringify(await storageKeys(source.admin))!==JSON.stringify(keys))throw new Error('STORAGE_CHANGED');
  for(const object of objects)if(hash(await objectBytes(source.admin,object.key))!==object.sha256)throw new Error('STORAGE_CHANGED');
  const versions={node:process.version,app:JSON.parse(await readFile('package.json','utf8')).version,
   schema:entries.filter(e=>e.path.startsWith('migrations/')).at(-1)!.path,
   postgres:(await lock.query('show server_version')).rows[0].server_version,
   cli:(await command(resolve('node_modules/.bin/supabase'),['--version'])).toString().trim()};
  const manifest:Manifest={...(source.configuration?{configuration:source.configuration}:{}),format:'craftbook-ops-backup',version:1,complete:true,startedAt,finishedAt:new Date().toISOString(),projectId:source.projectId,versions,entries,objects,identities,counts};
  await writeFile(join(path,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  await lock.query('COMMIT');return manifest;
 } catch(error) {await lock.query('ROLLBACK');await writeFile(join(path,'INCOMPLETE'), 'Záloha selhala. Neobnovovat.\n',{mode:0o600});throw error;}
 finally {lock.release();}
}
export async function verifyBackup(directory:string) {
 const path=await realpath(directory);
 try {await stat(join(path,'INCOMPLETE'));throw new Error('BACKUP_INCOMPLETE');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const manifest=JSON.parse(await readFile(join(path,'manifest.json'),'utf8')) as Manifest;
 if(manifest.format!=='craftbook-ops-backup'||manifest.version!==1||manifest.complete!==true||!Array.isArray(manifest.entries)||!Array.isArray(manifest.objects)||!Array.isArray(manifest.identities))throw new Error('INVALID_MANIFEST');
 const names=new Set<string>();
 for(const entry of manifest.entries) {
  if(!/^(app\.dump|config\.toml|runtime-role\.sql|migrations\/\d+_[a-z0-9_]+\.sql|objects\/\d+\.bin)$/.test(entry.path)||names.has(entry.path))throw new Error('INVALID_BACKUP_PATH');
  names.add(entry.path);const file=await realpath(join(path,entry.path)),rel=relative(path,file);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('INVALID_BACKUP_PATH');
  const bytes=await readFile(file);if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error('BACKUP_CHECKSUM');
 }
 for(const name of ['app.dump','config.toml','runtime-role.sql'])if(!names.has(name))throw new Error('BACKUP_INCOMPLETE');
 for(const object of manifest.objects) {
  if(object.bucket!==bucketId||!names.has(object.path)||!manifest.entries.some(e=>e.path===object.path&&e.sha256===object.sha256&&e.bytes===object.bytes)||!object.key||object.key.includes('..')||object.key.startsWith('/'))throw new Error('INVALID_OBJECT');
 }
 if(new Set(manifest.objects.map(o=>o.key)).size!==manifest.objects.length)throw new Error('DUPLICATE_OBJECT');
 return manifest;
}
export async function restore(e:Environment,directory:string) {
 await assertRecoveryEnvironment(e.workdir,e.authUrl,true);
 const manifest=await verifyBackup(directory);
 const migrations=(await readdir('supabase/migrations')).filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
 const saved=manifest.entries.filter(e=>e.path.startsWith('migrations/'));
 if(saved.length!==migrations.length)throw new Error('BACKUP_SCHEMA_MISMATCH');
 for(const file of migrations) {
  const entry=saved.find(e=>e.path==='migrations/'+file);
  if(!entry||entry.sha256!==hash(await readFile(join('supabase/migrations',file))))throw new Error('BACKUP_SCHEMA_MISMATCH');
 }
 const existing=await e.migration.query("select 1 from pg_namespace where nspname='app'");
 if(existing.rowCount)throw new Error('TARGET_NOT_EMPTY');
 const users=await e.admin.auth.admin.listUsers({page:1,perPage:1});if(users.error||users.data.users.length)throw new Error('TARGET_AUTH_NOT_EMPTY');
 if((await storageKeys(e.admin)).length)throw new Error('TARGET_STORAGE_NOT_EMPTY');
 await writeFile(join(e.workdir,'restore-state.json'),JSON.stringify({state:'running',startedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
 try {
  // Supported Admin API retains Auth UUID. Passwords/hashes/sessions are never copied.
  for(const identity of manifest.identities) {
   const result=await e.admin.auth.admin.createUser({id:identity.id,email:identity.email,password:randomBytes(32).toString('base64url'),email_confirm:true,...(identity.blocked?{ban_duration:'876000h'}:{})});
   if(result.error||result.data.user?.id!==identity.id)throw new Error('AUTH_RESTORE_FAILED');
  }
  await e.migration.query('CREATE ROLE craftbook_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  await command('docker',['exec','-i',`supabase_db_${e.marker.projectId}`,'pg_restore','-U','postgres','-d','postgres','--no-owner','--exit-on-error','--single-transaction'],await readFile(join(directory,'app.dump')));
  for(const [table,count] of Object.entries(manifest.counts)) {
   if(!/^\w+$/.test(table))throw new Error('INVALID_TABLE');
   if((await e.migration.query('select count(*)::text n from app."'+table+'"')).rows[0].n!==count)throw new Error('RESTORE_COUNT');
  }
  await prepareStorage(e.admin,e.migration);
  for(const object of manifest.objects) {
   const result=await e.admin.storage.from(bucketId).upload(object.key,await readFile(join(directory,object.path)),{contentType:object.mime,upsert:false});
   if(result.error)throw new Error('STORAGE_RESTORE_FAILED');
   if(hash(await objectBytes(e.admin,object.key))!==object.sha256)throw new Error('RESTORE_CHECKSUM');
  }
  // Keep inactive/disabled blocked. Every other account requires a controlled reset.
  await e.migration.query(`update app.user_account set status=case when status in ('inactive','disabled') then status else 'pending_password' end,
   must_change_password=true,temp_expires_at=null,sessions_valid_after=clock_timestamp()`);
  await e.migration.query('delete from app.export_lease');
  await setRuntimePassword(e);
  await writeFile(join(e.workdir,'restore-state.json'),JSON.stringify({state:'complete-access-blocked',finishedAt:new Date().toISOString()}),{mode:0o600});
  return manifest;
 } catch(error) {
  // No success marker; retained target is intentionally unusable until diagnosed.
  await writeFile(join(e.workdir,'restore-state.json'),JSON.stringify({state:'failed',finishedAt:new Date().toISOString()}),{mode:0o600});throw error;
 }
}
