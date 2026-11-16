import { test } from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { fixtures } from "../helpers/fixtures";
import { provision, assertLocalUrl } from "../../scripts/local-common";
import { verifyIdentity, withAccount, updateProfile } from "../../src/modules/identity/service";
import { AccessError } from "../../src/modules/identity/errors";

test("Lokální Auth a skutečná runtime PostgreSQL role", async t => {
 const f = await fixtures();
 try {
  const a = await f.create(), b = await f.create(), incomplete = await f.create(false);
  const db = drizzle(f.runtime);
  const login = async (u: typeof a) => { const result = await u.auth.auth.signInWithPassword({email:u.email,password:u.password}); assert.equal(result.error,null); return verifyIdentity(u.auth); };
  let ia = await login(a); const ib = await login(b); const ic = await login(incomplete);
  const read = (identity: typeof ia) => withAccount(db,identity,async (_tx,profile)=>profile);
  const blocked = async () => { await assert.rejects(()=>read(ia),error=>error instanceof AccessError && error.code==="ACCOUNT_BLOCKED"); };
  await t.test("přihlášení, špatné heslo, výchozí dílna a nezávislé profily", async()=>{
   assert.equal((await read(ia)).hasWorkshop,false);
   assert.equal((await a.auth.auth.signInWithPassword({email:a.email,password:"invalid-password"})).error?.status,400);
   await updateProfile(db,ia,{displayName:"Účet A",hasWorkshop:true});
   assert.equal((await read(ia)).displayName,"Účet A"); assert.equal((await read(ib)).displayName,"");
   assert.equal((await read(ib)).hasWorkshop,false);
   await assert.rejects(()=>updateProfile(db,ia,{displayName:"Podvrh",hasWorkshop:true,userId:b.id}));
  });
  await t.test("A nečte ani nemění B přes skutečné SQL a RLS", async()=>{
   await withAccount(db,ia,async tx=>{
    const rows=await tx.execute(sql`select * from app.user_profile where user_id=${b.id}`); assert.equal(rows.rowCount,0);
    const update=await tx.execute(sql`update app.user_profile set display_name='Cizí' where user_id=${b.id}`); assert.equal(update.rowCount,0);
    const accounts=await tx.execute(sql`select * from app.user_account`); assert.equal(accounts.rowCount,1);
   });
  });
  await t.test("stejné fyzické spojení A → bez kontextu → B, COMMIT i ROLLBACK", async()=>{
   const c=await f.runtime.connect();
   try {
    for (const end of ["COMMIT","ROLLBACK"]) {
     await c.query("BEGIN");
     await c.query("select set_config('app.user_id',$1,true),set_config('app.session_id',$2,true)",[ia.userId,ia.sessionId]);
     assert.equal((await c.query("select user_id from app.user_profile")).rows[0].user_id,a.id);
     await c.query(end);
     assert.equal((await c.query("select * from app.user_profile")).rowCount,0);
     assert.equal((await c.query("select * from app.user_account")).rowCount,0);
     await c.query("BEGIN");
     await c.query("select set_config('app.user_id',$1,true),set_config('app.session_id',$2,true)",[ib.userId,ib.sessionId]);
     assert.equal((await c.query("select user_id from app.user_profile")).rows[0].user_id,b.id); await c.query("COMMIT");
    }
    await c.query("BEGIN");
    await c.query("select set_config('app.user_id',$1,true),set_config('app.session_id',$2,true)",[ia.userId,ib.sessionId]);
    assert.equal((await c.query("select * from app.user_profile")).rowCount,0); await c.query("ROLLBACK");
    await c.query("BEGIN"); await c.query("select set_config('app.user_id','invalid',true)");
    assert.equal((await c.query("select * from app.user_profile")).rowCount,0); await c.query("ROLLBACK");
   } finally { c.release(); }
  });
  await t.test("runtime není vlastník, nemá BYPASSRLS, superuser ani členství",async()=>{
   const role=(await f.runtime.query("select rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit from pg_roles where rolname=current_user")).rows[0];
   for(const value of Object.values(role)) assert.equal(value,false);
   assert.equal((await f.runtime.query("select * from pg_auth_members where member=(select oid from pg_roles where rolname=current_user)")).rowCount,0);
   const owners=await f.runtime.query("select tableowner from pg_tables where schemaname='app'"); for(const row of owners.rows) assert.notEqual(row.tableowner,"craftbook_runtime");
   await assert.rejects(()=>f.runtime.query("SET ROLE postgres"));
   await assert.rejects(()=>f.runtime.query("UPDATE app.user_account SET status='active'"));
   await assert.rejects(()=>f.runtime.query("UPDATE app.user_profile SET user_id=$1",[b.id]));
   await assert.rejects(()=>f.runtime.query("SELECT * FROM auth.sessions"));
   await assert.rejects(()=>f.runtime.query("INSERT INTO app.user_account(auth_user_id) VALUES($1)",[incomplete.id]));
   await assert.rejects(()=>f.runtime.query("ALTER TABLE app.user_profile DISABLE ROW LEVEL SECURITY"));
   const fn=await f.migration.query("select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') as anon from pg_proc where oid='app.current_session_started_at()'::regprocedure");
   assert.equal(fn.rows[0].prosecdef,true); assert.equal(fn.rows[0].anon,false); assert(fn.rows[0].proconfig.some((v:string)=>v.startsWith('search_path=')));
  });
  await t.test("chybějící účet/profil a všechny blokující příznaky",async()=>{
   await assert.rejects(()=>read(ic), AccessError);
   for(const status of ['inactive','disabled','pending_password']) {
    await f.migration.query("update app.user_account set status=$1 where auth_user_id=$2",[status,a.id]); await blocked();
   }
   await f.migration.query("update app.user_account set status='active',must_change_password=true where auth_user_id=$1",[a.id]); await blocked();
   await f.migration.query("update app.user_account set must_change_password=false,temp_expires_at=now()-interval '1 second' where auth_user_id=$1",[a.id]); await blocked();
   await f.migration.query("update app.user_account set temp_expires_at=null where auth_user_id=$1",[a.id]);
   await f.migration.query("delete from app.user_profile where user_id=$1",[a.id]); await blocked();
   await f.migration.query("insert into app.user_profile(user_id) values($1)",[a.id]);
  });
  await t.test("obnovení tokenu zachová identitu; sessions_valid_after nelze obejít refreshem",async()=>{
   assert.equal((await a.auth.auth.refreshSession()).error,null);
   const refreshed=await verifyIdentity(a.auth); assert.equal(refreshed.sessionId,ia.sessionId); await read(refreshed);
   await f.migration.query("update app.user_account set sessions_valid_after=clock_timestamp() where auth_user_id=$1",[a.id]); await blocked();
   assert.equal((await a.auth.auth.refreshSession()).error,null);
   ia=await verifyIdentity(a.auth); await blocked();
   ia=await login(a); await read(ia);
  });
  await t.test("metadata nezvýší oprávnění; Data API nevystavuje app",async()=>{
   await a.auth.auth.updateUser({data:{status:'active',has_workshop:true,must_change_password:false}});
   await f.migration.query("update app.user_account set status='disabled' where auth_user_id=$1",[a.id]); await blocked();
   await f.migration.query("update app.user_account set status='active' where auth_user_id=$1",[a.id]);
   const result=await a.auth.schema('app').from('user_profile').select('*'); assert(result.error);
  });
  await t.test("přímá veřejná registrace je zakázaná",async()=>{
   const response=await a.auth.auth.signUp({email:`blocked-${Date.now()}@example.invalid`,password:a.password});
   assert(response.error); assert.equal(response.data.user,null);
  });
  await t.test("provisioning je opakovatelný a nepřepisuje existující stav",async()=>{
   assert.equal(await provision(f.migration,incomplete.id),true);
   assert.equal(await provision(f.migration,incomplete.id),false);
   const account=(await f.migration.query("select status,must_change_password,temp_expires_at from app.user_account where auth_user_id=$1",[incomplete.id])).rows[0];
   assert.equal(account.status,'pending_password'); assert.equal(account.must_change_password,true); assert(account.temp_expires_at);
   assert.equal(await provision(f.migration,incomplete.id,true),false);
   await assert.rejects(()=>read(ic),AccessError);
   for (const kind of ['auth','db'] as const) assert.throws(()=>assertLocalUrl('https://example.com',kind));
  });
  await t.test("odhlášení zruší relaci a starý kontext již nefunguje",async()=>{
   assert.equal((await a.auth.auth.signOut({scope:'local'})).error,null);
   await assert.rejects(()=>verifyIdentity(a.auth),AccessError); await blocked();
  });
 } finally { await f.cleanup(); }
});
