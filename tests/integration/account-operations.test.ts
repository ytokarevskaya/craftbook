import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/node-postgres";
import { fixtures } from "../helpers/fixtures";
import { runOperation, OpsError, type OpsInput } from "../../scripts/ops/service";
import { changePassword, passwordAccess, identityTransaction, PasswordError } from "../../src/modules/identity/password-service";
import { verifyIdentity, withAccount } from "../../src/modules/identity/service";
import { AccessError } from "../../src/modules/identity/errors";

const password=()=>randomBytes(24).toString('base64url');
test('Etapa 3: účty, hesla a obnova částečných operací',async t=>{
 const f=await fixtures();
 const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:3});
 const deps={pool,admin:f.admin,authUrl:f.authUrl,publicKey:f.publicKey};
 const client=()=>createClient(f.authUrl,f.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const input=(kind:OpsInput['kind'],targetId?:string):OpsInput=>({kind,targetId,key:randomUUID(),reference:'isolated-test'});
 const signin=async(email:string,pwd:string)=>{
  const auth=client();const signed=await auth.auth.signInWithPassword({email,password:pwd});
  assert.equal(!!signed.error,false,'Auth přihlášení musí uspět'); return {auth,identity:await verifyIdentity(auth),refresh:signed.data.session!.refresh_token};
 };
 const read=(identity:Awaited<ReturnType<typeof verifyIdentity>>)=>withAccount(drizzle(f.runtime),identity,async(_tx,profile)=>profile);
 const state=async(id:string)=>(await pool.query('select * from app.user_account where auth_user_id=$1',[id])).rows[0];
 try {
  await t.test('založení, duplicitní e-mail, opakování i provisioning zachovají profil',async()=>{
   const id=randomUUID();f.track(id);
   const email=`ops-${id}@example.invalid`, temp=password();const op={...input('create',id),email,password:temp};
   const result=await runOperation(deps,op);assert.equal(result.targetId,id);
   const a=await state(id);assert.equal(a.status,'pending_password');assert.equal(a.must_change_password,true);assert(a.temp_expires_at>Date.now());
   await runOperation(deps,{...op,password:password()});
   const signed=await signin(email,temp);
   assert.equal(await passwordAccess(f.runtime,signed.identity),'pending');await assert.rejects(()=>read(signed.identity),AccessError);
   await pool.query("update app.user_profile set display_name='Zachovat',has_workshop=true where user_id=$1",[id]);
   await runOperation(deps,input('provision',id));
   const p=(await pool.query('select * from app.user_profile where user_id=$1',[id])).rows[0];assert.equal(p.display_name,'Zachovat');assert.equal(p.has_workshop,true);
   const duplicateId=randomUUID();f.track(duplicateId);
   await assert.rejects(()=>runOperation(deps,{...input('create',duplicateId),email,password:password()}),OpsError);
   await signin(email,temp); // Existing password was not replaced.
  });
  await t.test('povinná změna aktivuje až po Auth a odmítne všechny staré relace',async()=>{
   const a=await f.create(false);await runOperation(deps,input('provision',a.id));
   const first=await signin(a.email,a.password), second=await signin(a.email,a.password);const next=password();
   await changePassword({pool:f.runtime,auth:first.auth,authUrl:f.authUrl,publicKey:f.publicKey},{newPassword:next,confirmation:next});
   assert.equal((await state(a.id)).status,'active');assert.equal((await state(a.id)).must_change_password,false);assert.equal((await state(a.id)).temp_expires_at,null);
   await assert.rejects(()=>read(second.identity),AccessError);
   assert((await client().auth.refreshSession({refresh_token:second.refresh})).error);
   await read((await signin(a.email,next)).identity);
  });
  await t.test('stará dočasná relace vyžaduje nové přihlášení bez zablokování účtu',async()=>{
   const a=await f.create(false);await runOperation(deps,input('provision',a.id));const signed=await signin(a.email,a.password);
   await pool.query("update auth.sessions set created_at=now()-interval '25 hours' where id=$1",[signed.identity.sessionId]);
   await pool.query("update app.user_account set sessions_valid_after=now()-interval '26 hours' where auth_user_id=$1",[a.id]);
   const next=password();
   await assert.rejects(()=>changePassword({pool:f.runtime,auth:signed.auth,authUrl:f.authUrl,publicKey:f.publicKey},{newPassword:next,confirmation:next}),error=>error instanceof PasswordError&&error.code==='RELOGIN_REQUIRED');
   assert.equal((await state(a.id)).status,'pending_password');
   const fresh=await signin(a.email,a.password);
   await changePassword({pool:f.runtime,auth:fresh.auth,authUrl:f.authUrl,publicKey:f.publicKey},{newPassword:next,confirmation:next});
   await read((await signin(a.email,next)).identity);
  });
  await t.test('expirace, chybějící profil a nesprávné současné heslo',async()=>{
   const a=await f.create(false);await runOperation(deps,input('provision',a.id));const signed=await signin(a.email,a.password);
   await pool.query("update app.user_account set temp_expires_at=now()-interval '1 second' where auth_user_id=$1",[a.id]);
   assert.equal(await passwordAccess(f.runtime,signed.identity),'expired');const next=password();
   await assert.rejects(()=>changePassword({pool:f.runtime,auth:signed.auth,authUrl:f.authUrl,publicKey:f.publicKey},{newPassword:next,confirmation:next}),AccessError);
   const b=await f.create();const active=await signin(b.email,b.password);
   await assert.rejects(()=>changePassword({pool:f.runtime,auth:active.auth,authUrl:f.authUrl,publicKey:f.publicKey},{currentPassword:'wrong-password',newPassword:next,confirmation:next}),error=>error instanceof PasswordError&&error.code==='CURRENT_PASSWORD_INVALID');
   assert.equal((await state(b.id)).status,'active');await read(active.identity);
   await pool.query('delete from app.user_profile where user_id=$1',[b.id]);assert.equal(await passwordAccess(f.runtime,active.identity),'blocked');
   await runOperation(deps,input('provision',b.id));assert.equal((await state(b.id)).status,'pending_password');
  });
  await t.test('běžná změna reautentizuje a zneplatní access i refresh',async()=>{
   const a=await f.create();const first=await signin(a.email,a.password), second=await signin(a.email,a.password);const next=password();
   await changePassword({pool:f.runtime,auth:first.auth,authUrl:f.authUrl,publicKey:f.publicKey},{currentPassword:a.password,newPassword:next,confirmation:next});
   await assert.rejects(()=>read(first.identity),AccessError);await assert.rejects(()=>read(second.identity),AccessError);
   assert((await client().auth.refreshSession({refresh_token:second.refresh})).error);await read((await signin(a.email,next)).identity);
  });
  await t.test('reset, deaktivace a zákaz resetu disabled účtu',async()=>{
   const a=await f.create();const old=await signin(a.email,a.password);const temp=password();
   const reset={...input('reset',a.id),password:temp};await runOperation(deps,reset);await runOperation(deps,reset);
   await assert.rejects(()=>read(old.identity),AccessError);assert((await client().auth.refreshSession({refresh_token:old.refresh})).error);
   const limited=await signin(a.email,temp);assert.equal(await passwordAccess(f.runtime,limited.identity),'pending');
   await runOperation(deps,input('deactivate',a.id));assert.equal((await state(a.id)).status,'disabled');
   assert.equal((await f.migration.query('select count(*)::int as count from auth.sessions where user_id=$1',[a.id])).rows[0].count,0);
   await assert.rejects(()=>read(limited.identity),AccessError);
   assert((await client().auth.refreshSession({refresh_token:limited.refresh})).error);
   assert((await client().auth.signInWithPassword({email:a.email,password:temp})).error);
   await assert.rejects(()=>runOperation(deps,{...input('reset',a.id),password:password()}),OpsError);
   assert.equal((await state(a.id)).status,'disabled');assert.equal((await pool.query('select * from app.user_profile where user_id=$1',[a.id])).rowCount,1);
  });
  await t.test('ztracená odpověď create a neúplný zápis DB se bezpečně obnoví bez další identity',async()=>{
   for(const point of ['after_identity','before_complete']) {
    const id=randomUUID();f.track(id);const op={...input('create',id),email:`recover-${id}@example.invalid`,password:password()};
    await assert.rejects(()=>runOperation({...deps,checkpoint:async p=>{if(p===point)throw new Error('simulated');}},op),OpsError);
    assert.equal(await state(id),undefined);
    await runOperation(deps,op);await runOperation(deps,op);
    assert.equal((await state(id)).status,'pending_password');
   }
  });
  await t.test('selhání v každé fázi resetu zachová blokaci a stejný klíč lze obnovit',async()=>{
   for(const point of ['after_block','after_auth','after_revoke','before_complete']) {
    const a=await f.create();const old=await signin(a.email,a.password);const op={...input('reset',a.id),password:password()};
    await assert.rejects(()=>runOperation({...deps,checkpoint:async p=>{if(p===point)throw new Error('simulated');}},op),OpsError);
    assert.equal((await state(a.id)).status,'inactive');await assert.rejects(()=>read(old.identity),AccessError);
    await runOperation(deps,op);assert.equal((await state(a.id)).status,'pending_password');
    assert.equal(await passwordAccess(f.runtime,(await signin(a.email,op.password)).identity),'pending');
   }
  });
  await t.test('selhání webové změny vyžaduje reset, staré dokončení nepřepíše novější operaci',async()=>{
   for(const point of ['after_block','after_auth','after_revoke']) {
    const a=await f.create();const old=await signin(a.email,a.password);const next=password();
    await assert.rejects(()=>changePassword({pool:f.runtime,auth:old.auth,authUrl:f.authUrl,publicKey:f.publicKey,checkpoint:async p=>{if(p===point)throw new Error('simulated');}},{currentPassword:a.password,newPassword:next,confirmation:next}),PasswordError);
    const operation=(await state(a.id)).operation_id;assert.equal((await state(a.id)).status,'inactive');
    const reset={...input('reset',a.id),password:password()};await runOperation(deps,reset);
    const c=await f.runtime.connect();try{await assert.rejects(()=>identityTransaction(c,old.identity,()=>c.query("select app.advance_password_change($1,'complete')",[operation])));}finally{c.release();}
    assert.equal((await state(a.id)).status,'pending_password');
   }
  });
  await t.test('Auth selhání deaktivace zůstane disabled; starý reset je superseded',async()=>{
   const a=await f.create();const reset={...input('reset',a.id),password:password()};
   await assert.rejects(()=>runOperation({...deps,checkpoint:async p=>{if(p==='after_auth')throw new Error('simulated');}},reset));
   const deactivate=input('deactivate',a.id);
   await assert.rejects(()=>runOperation({...deps,checkpoint:async p=>{if(p==='after_block')throw new Error('simulated');}},deactivate));
   assert.equal((await state(a.id)).status,'disabled');
   await runOperation(deps,deactivate);await assert.rejects(()=>runOperation(deps,reset),OpsError);
  });
  await t.test('souběh a runtime zákaz provozního zápisu či zásahu A do B',async()=>{
   const a=await f.create(), b=await f.create();const ia=(await signin(a.email,a.password)).identity;
   let release!:()=>void;let reached!:()=>void;
   const gate=new Promise<void>(r=>{release=r;});const started=new Promise<void>(r=>{reached=r;});
   const reset={...input('reset',a.id),password:password()};
   const running=runOperation({...deps,checkpoint:async p=>{if(p==='after_block'){reached();await gate;}}},reset);
   await started;
   try { await assert.rejects(()=>runOperation(deps,input('deactivate',a.id)),OpsError); }
   finally {release();await running;}
   const c=await f.runtime.connect();
   try {
    await assert.rejects(()=>c.query('select * from app.account_provision_operation'));
    await assert.rejects(()=>c.query("update app.user_account set status='active' where auth_user_id=$1",[b.id]));
    await assert.rejects(()=>identityTransaction(c,ia,()=>c.query("select app.advance_password_change($1,'complete')",[reset.key])));
   } finally{c.release();}
   assert.equal((await state(b.id)).status,'active');
   const records=await pool.query('select * from app.account_provision_operation where target_id=$1',[a.id]);
   assert.equal(JSON.stringify(records.rows).includes(reset.password),false);
  });
 } finally {await pool.end();await f.cleanup();}
});
