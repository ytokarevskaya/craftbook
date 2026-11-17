import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/node-postgres';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { createEnvironment, startEnvironment, migrateEnvironment, stopEnvironment, type Environment } from '../../scripts/recovery/environment';
import { backup, restore, verifyBackup, prepareStorage } from '../../scripts/recovery/backup';
import { runOperation } from '../../scripts/ops/service';
import { verifyIdentity, withAccount } from '../../src/modules/identity/service';
import { changePassword } from '../../src/modules/identity/password-service';
import { PrivateStorage } from '../../src/modules/files/storage';
import { prepareUpload, finalizeUpload, readAsset } from '../../src/modules/files/service';
import { saveDocument, getDocument } from '../../src/modules/documents/service';
import { saveProcedure, getProcedure, saveProduct, getProduct, startProduct, completeProduct } from '../../src/modules/workshop/service';
import { saveItem, createPurchase, getItem, reconcile } from '../../src/modules/inventory/service';
import { settleOwn } from '../../src/modules/inventory/settlements';

test('Etapa 9: skutečná izolovaná záloha → obnova → reset → nový provoz', {timeout:600000}, async()=>{
 const root=await mkdtemp('/private/tmp/craftbook-recovery-');
 // mkdtemp suffix is replaced by UUID directory to make safety markers explicit.
 await rm(root,{recursive:true});
 const base='/private/tmp/craftbook-recovery-'+randomUUID();
 const {mkdir}=await import('node:fs/promises');await mkdir(base,{mode:0o700});
 let source:Environment|undefined,target:Environment|undefined,server:ChildProcess|undefined;
 const origin='http://127.0.0.1:3104';
 try {
  console.log('Obnova: spouštím izolovaný zdroj (55321/55322).');
  source=await startEnvironment(await createEnvironment(base,'source'));
  await migrateEnvironment(source);await prepareStorage(source.admin,source.migration);
  async function user() {
   const id=randomUUID(),email=`craftbook-test-${id}@example.invalid`,password=randomBytes(24).toString('base64url');
   const result=await source!.admin.auth.admin.createUser({id,email,password,email_confirm:true});assert(!result.error);
   await source!.migration.query("insert into app.user_account(auth_user_id,status,must_change_password) values($1,'active',false)",[id]);
   await source!.migration.query('insert into app.user_profile(user_id,has_workshop) values($1,true)',[id]);
   const auth=createClient(source!.authUrl,source!.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   assert(!(await auth.auth.signInWithPassword({email,password})).error);
   return {id,email,password,auth,identity:await verifyIdentity(auth)};
  }
  const a=await user(),b=await user(),inactive=await user();
  const d={db:drizzle(source.runtime),identity:a.identity,storage:new PrivateStorage(source.admin)};
  const other={...d,identity:b.identity};
  const image=await sharp({create:{width:24,height:24,channels:3,background:'#355e50'}}).png().toBuffer();
  async function put(bytes:Buffer,name:string,mime:string,owner=d) {
   const p=await prepareUpload(owner,{name,mime,bytes:bytes.length});assert((await fetch(p.url,{method:'PUT',headers:{'Content-Type':mime},body:new Uint8Array(bytes)})).ok);await finalizeUpload(owner,p.id);return p.id;
  }
  const photo=await put(image,'Obrázek.png','image/png'),foreign=await put(image,'Cizí.png','image/png',other);
  const pdf=await put(Buffer.from('%PDF-1.4\n%%EOF'),'Faktura.pdf','application/pdf');
  const note=randomUUID(),fileDocument=randomUUID();
  const body={version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Obnovená česká poznámka'}]},{type:'assetImage',attrs:{assetId:photo,alt:'Obnovený obrázek'}}]}};
  await saveDocument(d,{id:note,title:'Obnova poznámky',kind:'note',body});
  await saveDocument(d,{id:fileDocument,title:'Dokument PDF',kind:'file',assetId:pdf});
  await saveDocument(other,{id:randomUUID(),title:'Soukromé B',kind:'note',body:{version:1,doc:{type:'doc',content:[{type:'assetImage',attrs:{assetId:foreign,alt:'B'}}]}}});
  const plan={title:'Obnovený postup',description:'Test obnovy',steps:[{id:randomUUID(),text:'Připravit'}],materials:[{id:randomUUID(),specification:'Ag',type:'metal' as const,unit:'g' as const,quantity:null}],attachments:[photo]};
  const procedure=randomUUID();await saveProcedure(d,{id:procedure,plan});const pattern=await getProcedure(d,procedure);
  const school=randomUUID();await saveProduct(d,{id:school,source:'school',procedureId:procedure,procedureRevision:pattern.revision_counter,plan});
  await startProduct(d,school,{requestKey:randomUUID(),version:1,expectedProcedureRevision:pattern.revision_counter});
  let schoolDetail=await getProduct(d,school);
  await completeProduct(d,school,{requestKey:randomUUID(),version:schoolDetail.product.row_version,actual:schoolDetail.materials.map(m=>({id:m.id,quantity:null,confirmed:false})),additional:[],schoolCost:null});
  const card=randomUUID();await saveItem(d,{id:card,name:'Ag drát',type:'metal'});
  await createPurchase(d,{requestKey:randomUUID(),businessDate:'2026-11-17',supplier:'Test obnovy',lines:[{itemId:card,quantity:'10',totalCost:'300'}],attachments:[pdf]});
  const own=randomUUID();await saveProduct(d,{id:own,source:'own',procedureId:null,procedureRevision:null,plan:{...plan,title:'Vlastní obnova',materials:[{...plan.materials[0],id:randomUUID(),quantity:'5'}],attachments:[]}});
  const ownDetail=await getProduct(d,own);
  await startProduct(d,own,{requestKey:randomUUID(),version:1,reservations:ownDetail.materials.map(m=>({materialId:m.id,itemId:card,quantity:'5',reserveEnabled:true,confirmed:true,cardVersion:1}))});
  async function actual(returned:string,lost:string) {
   const p=await getProduct(d,own);return {requestKey:randomUUID(),version:p.product.row_version,expectedRevision:p.settlements[0]?.revision??0,reason:'Ověření obnovy',lines:p.materials.map(m=>({materialId:m.id,itemId:card,cardVersion:1,taken:'5',inProduct:'4',returned,scrap:'0.5',lost,confirmed:true}))};
  }
  await settleOwn(d,own,'complete',await actual('0.5','0'));
  assert.equal((await getItem(d,card)).balance.free_known_value,'165.000000');
  await settleOwn(d,own,'correct',await actual('0.3','0.2'));
  assert.deepEqual(await reconcile(d),[]);
  await source.migration.query("update app.user_account set status='inactive' where auth_user_id=$1",[inactive.id]);
  assert(!(await source.admin.auth.admin.updateUserById(inactive.id,{ban_duration:'876000h'})).error);
  const backupPath=base+'/backup';
  console.log('Obnova: vytvářím skutečný dump a kopii Storage v okně bez zápisů.');
  const manifest=await backup({admin:source.admin,migration:source.migration,projectId:source.marker.projectId},backupPath,true);
  assert.equal(manifest.versions.schema,'migrations/20261117001000_export.sql');
  assert.equal(manifest.identities.length,3);assert.equal(manifest.objects.length,3);
  for(const variant of ['corrupt','missing','incomplete']) {
   const path=base+'/'+variant;await cp(backupPath,path,{recursive:true});
   if(variant==='corrupt')await writeFile(path+'/'+manifest.objects[0].path,'poškozeno');
   if(variant==='missing')await rm(path+'/'+manifest.objects[0].path);
   if(variant==='incomplete')await writeFile(path+'/INCOMPLETE','přerušeno');
   await assert.rejects(()=>verifyBackup(path));
  }
  console.log('Obnova: spouštím čistý izolovaný cíl (56321/56322).');
  target=await startEnvironment(await createEnvironment(base,'target'));
  await assert.rejects(()=>restore(source!,backupPath));
  for(const variant of ['corrupt','missing','incomplete'])await assert.rejects(()=>restore(target!,base+'/'+variant));
  assert.equal((await target.migration.query("select 1 from pg_namespace where nspname='app'")).rowCount,0);
  await restore(target,backupPath);
  assert.equal(JSON.parse(await readFile(target.workdir+'/restore-state.json','utf8')).state,'complete-access-blocked');
  await assert.rejects(()=>restore(target!,backupPath)); // no overwrite/retry into populated target
  const db=drizzle(target.runtime),restored={db,identity:a.identity,storage:new PrivateStorage(target.admin)};
  await assert.rejects(()=>withAccount(db,a.identity,async()=>{}));
  const blocked=(await target.migration.query('select status from app.user_account where auth_user_id=$1',[inactive.id])).rows[0];assert.equal(blocked.status,'inactive');
  const blockedAuth=await target.admin.auth.admin.getUserById(inactive.id);
  assert(Date.parse((blockedAuth.data.user as unknown as {banned_until:string}).banned_until)>Date.now());
  async function reset(u:typeof a) {
   const temporary=randomBytes(24).toString('base64url'),newPassword=randomBytes(24).toString('base64url');
   await runOperation({pool:target!.migration,admin:target!.admin,authUrl:target!.authUrl,publicKey:target!.publicKey,recoveryWorkdir:target!.workdir},{kind:'reset',key:randomUUID(),targetId:u.id,reference:'Izolovaný test obnovy',password:temporary});
   const auth=createClient(target!.authUrl,target!.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   assert(!(await auth.auth.signInWithPassword({email:u.email,password:temporary})).error);
   const pending=await verifyIdentity(auth);await assert.rejects(()=>withAccount(db,pending,async()=>{}));
   await changePassword({pool:target!.runtime,auth,authUrl:target!.authUrl,publicKey:target!.publicKey},{newPassword,confirmation:newPassword});
   assert(!(await auth.auth.signInWithPassword({email:u.email,password:newPassword})).error);
   return {auth,identity:await verifyIdentity(auth),password:newPassword};
  }
  const recovered=await reset(a),recoveredB=await reset(b);restored.identity=recovered.identity;
  await assert.rejects(()=>withAccount(db,a.identity,async()=>{})); // old source session still rejected after reset
  await assert.rejects(()=>withAccount(db,inactive.identity,async()=>{}));
  assert.deepEqual((await getDocument(restored,note)).body_json,body);
  assert.deepEqual((await readAsset(restored,photo)).bytes,image);
  await assert.rejects(()=>readAsset(restored,foreign));
  await assert.rejects(()=>getDocument({...restored,identity:recoveredB.identity},note));
  assert((await recoveredB.auth.storage.from('craftbook-private').download('anything')).error);
  assert.equal((await target.runtime.query('select * from app.document')).rowCount,0);
  const role=(await target.runtime.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
  assert.equal((await target.migration.query("select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='app' and not c.convalidated")).rowCount,0);
  assert.deepEqual(await reconcile(restored),[]);
  schoolDetail=await getProduct(restored,school);assert.equal(schoolDetail.product.school_cost,null);assert.equal(schoolDetail.product.status,'done');assert(schoolDetail.snapshot);
  assert.equal((await getProduct(restored,own)).settlements.length,2);
  const before=await getItem(restored,card),sequence=BigInt(before.history[0].posting_sequence as string);
  await createPurchase(restored,{requestKey:randomUUID(),businessDate:'2026-11-17',supplier:'Nová operace po obnově',lines:[{itemId:card,quantity:'1',totalCost:'30'}]});
  const after=await getItem(restored,card);assert(BigInt(after.history[0].posting_sequence as string)>sequence);assert.deepEqual(await reconcile(restored),[]);
  console.log('Obnova: kontrolní součty, vlastníci, RLS, reset i nový ledger prošly; ověřuji zobrazení.');
  const targetEnv={...process.env,APP_URL:origin,DATABASE_URL:target.runtimeUrl,NEXT_PUBLIC_SUPABASE_URL:target.authUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:target.publicKey,STORAGE_SECRET_KEY:target.secretKey,NEXT_TELEMETRY_DISABLED:'1'};
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3104'],{env:targetEnv,stdio:'ignore'});
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('RESTORE_WEB_FAILED');try{if((await fetch(origin+'/api/health',{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const browser=await chromium.launch({channel:'chrome'});
  try {
   for(const width of [1440,375]) {
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
    page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
    try {
     await page.goto(origin+'/login');await page.getByLabel('E-mail',{exact:true}).fill(a.email);await page.getByLabel('Heslo',{exact:true}).fill(recovered.password);const loginResponse=page.waitForResponse(r=>r.url()===origin+'/api/auth/login');
     await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();
     const response=await loginResponse;assert.equal(response.status(),200);
     await page.waitForURL(origin+'/',{timeout:15000});
     await page.goto(origin+'/documents/'+note);await page.locator('.note-content').getByText('Obnovená česká poznámka').waitFor();
     assert.equal((await page.request.get(origin+'/api/assets/'+photo+'/content')).status(),200);
     await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLImageElement>('.note-content img')).some(img=>img.complete&&img.naturalWidth>0));
     await page.goto(origin+'/products/'+school);assert((await page.locator('body').innerText()).includes('Dokončený'));
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     assert.equal((await page.request.get(origin+'/api/assets/'+foreign+'/content')).status(),404);
    } finally {await context.close();}
   }
  } finally {await browser.close();}
  console.log('Obnova: desktop i 375 px zobrazily skutečně obnovená data.');
 } finally {
  if(server&&server.exitCode===null){const stopped=new Promise(r=>server!.once('exit',r));server.kill('SIGTERM');await stopped;}
  if(target)await stopEnvironment(target);if(source)await stopEnvironment(source);
 }
});
