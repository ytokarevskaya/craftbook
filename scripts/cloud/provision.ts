import { cloudDatabaseUrl } from '../../src/lib/database-config';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { cloudConnections,cloudEnvPath,serializeEnv } from './config';
import { api,verifyTargets } from './api';
import { applyMigrations,assertMigrationRole,migrationState } from './migrations';
import { cloudTarget } from '../../src/lib/cloud-target';
import { verifyBackup } from '../recovery/backup';
import { prepareStorage } from '../recovery/backup';
export async function migrateCloud(backupPath?:string,maintenanceConfirmed=false) {
 const c=cloudConnections();
 try {
  const target=await verifyTargets(c.env);console.log(`Ověřen cíl: ${cloudTarget.projectRef}, Heroku ${target.appName} (${target.appId}).`);
  const client=await c.migration.connect();
  try {
   await assertMigrationRole(client);const state=await migrationState(client);
   const formation=await api('heroku',`/apps/${target.appId}/formation`);
   let allowExisting=false;
   if(state.history.length&&state.pending.length) {
    if(!backupPath||!maintenanceConfirmed||formation.some((p:{quantity:number})=>p.quantity>0))throw new Error('BACKUP_REQUIRED_USE_DOCUMENTED_MAINTENANCE');
    const receipt=await verifyBackup(backupPath);
    if(receipt.projectId!==cloudTarget.projectRef||Date.now()-Date.parse(receipt.finishedAt)>3600000)throw new Error('BACKUP_TARGET_OR_AGE');
    for(const [table,count] of Object.entries(receipt.counts)) {
     if(!/^\w+$/.test(table)||(await client.query('select count(*)::text n from app."'+table+'"')).rows[0].n!==count)throw new Error('DATA_CHANGED_SINCE_BACKUP');
    }
    allowExisting=true;
   }
   if(!state.history.length) {
    const users=await c.admin.auth.admin.listUsers({page:1,perPage:1});
    const buckets=await c.admin.storage.listBuckets();
    if(users.error||buckets.error||users.data.users.length||buckets.data.length||formation.some((p:{quantity:number})=>p.quantity>0))throw new Error('NEW_TARGET_NOT_EMPTY');
   }
   await applyMigrations(client,()=>assertMigrationRole(client),allowExisting);
  }finally{client.release();}
  if(!c.env.DATABASE_URL) {
   const formation=await api('heroku',`/apps/${target.appId}/formation`);
   if(formation.some((p:{quantity:number})=>p.quantity>0))throw new Error('RUNTIME_SETUP_REQUIRES_STOPPED_WEB');
   const password=randomBytes(32).toString('hex');
   await c.migration.query(`alter role craftbook_runtime password '${password}'`);
   c.env.DATABASE_URL=cloudDatabaseUrl('craftbook_runtime',password);writeFileSync(cloudEnvPath,serializeEnv(c.env),{mode:0o600});
   console.log('Samostatné runtime heslo připraveno, uloženo pouze v ignorované cloudové konfiguraci.');
  }
 }finally{await c.migration.end();await c.runtime?.end();}
}
export async function configureCloudStorage() {
 const c=cloudConnections();try {
  await verifyTargets(c.env);
  const client=await c.migration.connect();try{await assertMigrationRole(client);if((await migrationState(client)).pending.length)throw new Error('MIGRATIONS_PENDING');}finally{client.release();}
  const bucket=await c.admin.storage.getBucket('craftbook-private');
  if(bucket.data&&(bucket.data.public||bucket.data.file_size_limit!==10485760))throw new Error('EXISTING_BUCKET_CONFIG_MISMATCH');
  await prepareStorage(c.admin,c.migration);
  console.log('Soukromý craftbook-private a restriktivní politika připraveny.');
 }finally{await c.migration.end();await c.runtime?.end();}
}
export async function verifyRuntime() {
 const c=cloudConnections();try {
  await verifyTargets(c.env);if(!c.runtime)throw new Error('RUNTIME_CONFIG_MISSING');
  const {rows:[r]}=await c.runtime.query(`select current_user as role,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit,
   (select count(*)::int from pg_class where relnamespace='app'::regnamespace and relowner=(select oid from pg_roles where rolname=current_user)) as owned,
   (select count(*)::int from pg_auth_members where member=(select oid from pg_roles where rolname=current_user)) as memberships,
   (select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl from pg_roles where rolname=current_user`);
  if(r.role!=='craftbook_runtime'||r.rolsuper||r.rolbypassrls||r.rolcreatedb||r.rolcreaterole||r.rolreplication||r.rolinherit||r.owned||r.memberships||!r.ssl)throw new Error('UNSAFE_RUNTIME_ROLE');
  if((await c.runtime.query('select * from app.document')).rowCount)throw new Error('RUNTIME_RLS_FAILED');
  console.log('Runtime: craftbook_runtime, ověřené TLS, bez vlastnictví/privilegovaných členství, RLS bez kontextu uzavřená.');
 }finally{await c.migration.end();await c.runtime?.end();}
}
