import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createEnvironment,startEnvironment,stopEnvironment} from '../../scripts/recovery/environment';
import {applyMigrations,migrationState} from '../../scripts/cloud/migrations';
import {dumpDatabase} from '../../scripts/cloud/dump';
test('Migrace bez superusera na odděleném PG; opakování, kontrola historie a skutečný síťový dump', {timeout:180000},async()=>{
 const base='/private/tmp/craftbook-recovery-'+randomUUID();await mkdir(base,{mode:0o700});
 const e=await startEnvironment(await createEnvironment(base,'source'));
 try {
  const client=await e.migration.connect();
  try {
   const verify=async()=>{const r=(await client.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,true);};
   const count=await applyMigrations(client,verify);assert.equal(count,12);
   assert.equal(await applyMigrations(client,verify),count);
   await client.query("update app.schema_migration set checksum='wrong' where name=(select min(name) from app.schema_migration)");
   await assert.rejects(()=>migrationState(client));
  }finally{client.release();}
  const dumped=await dumpDatabase(e.migration.options.connectionString!,false);assert(dumped.length>1000);assert.equal(dumped.subarray(0,5).toString(),'PGDMP');
  // Dump bytes are never printed or added to the repository.
  const path=base+'/test.dump';await writeFile(path,dumped,{mode:0o600});assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),createHash('sha256').update(dumped).digest('hex'));await rm(path);
 }finally{await stopEnvironment(e);}
});
