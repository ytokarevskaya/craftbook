import { createHash } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import type { PoolClient } from 'pg';
export async function migrationFiles() {
 return Promise.all((await readdir('supabase/migrations')).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort().map(async name=>{
  const text=await readFile('supabase/migrations/'+name,'utf8');return {name,text,checksum:createHash('sha256').update(text).digest('hex')};
 }));
}
export async function migrationState(client:PoolClient) {
 const {rows:[state]}=await client.query("select to_regnamespace('app') is not null as schema_exists,to_regclass('app.schema_migration') is not null as history_exists");
 if(state.schema_exists&&!state.history_exists)throw new Error('UNKNOWN_APP_SCHEMA');
 const history: {name:string;checksum:string}[]=state.history_exists?(await client.query('select name,checksum from app.schema_migration order by name')).rows:[];
 const files=await migrationFiles();
 if(history.length>files.length||history.some((row,i)=>row.name!==files[i]?.name||row.checksum!==files[i]?.checksum))throw new Error('MIGRATION_HISTORY_MISMATCH');
 return {history,files,pending:files.slice(history.length)};
}
// Trusted ops core only. Callers validate their connection before invoking this.
export async function applyMigrations(client:PoolClient,verifyStep:()=>Promise<void>,allowExistingData=false) {
 await client.query("select pg_advisory_lock(hashtextextended('craftbook-migrations',0))");
 try {
  const state=await migrationState(client);
  if(state.history.length&&state.pending.length&&!allowExistingData)throw new Error('BACKUP_REQUIRED');
  for(const file of state.pending) {
   await verifyStep();const fresh=await migrationState(client);
   if(fresh.pending[0]?.name!==file.name)throw new Error('MIGRATION_HISTORY_CHANGED');
   await client.query('BEGIN');
   try {
    await client.query("set local lock_timeout='5s'");await client.query("set local statement_timeout='60s'");
    await client.query(file.text);
    if(!fresh.history.length)await client.query(`create table app.schema_migration(name text primary key,checksum text not null,applied_at timestamptz not null default now());
     revoke all on app.schema_migration from public,anon,authenticated,service_role,craftbook_runtime;
     alter table app.schema_migration enable row level security;alter table app.schema_migration force row level security;`);
    await client.query('insert into app.schema_migration(name,checksum) values($1,$2)',[file.name,file.checksum]);
    await client.query('COMMIT');console.log(`Migrace dokončena: ${file.name}`);
   }catch(error){await client.query('ROLLBACK');throw error;}
  }
  return (await migrationState(client)).history.length;
 }finally{await client.query("select pg_advisory_unlock(hashtextextended('craftbook-migrations',0))");}
}
export async function assertMigrationRole(client:PoolClient) {
 const {rows:[state]}=await client.query(`select current_user as role,current_database() as db,r.rolbypassrls,
  (select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl from pg_roles r where rolname=current_user`);
 if(state.role!=='postgres'||state.db!=='postgres'||!state.rolbypassrls||!state.ssl)throw new Error('CLOUD_MIGRATION_ROLE_OR_TLS');
}
