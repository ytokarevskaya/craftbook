import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import sharp from 'sharp';
import { fixtures } from '../helpers/fixtures';
import { verifyIdentity,withAccount } from '../../src/modules/identity/service';
import * as work from '../../src/modules/workshop/service';
import { planInput,progress,type Plan } from '../../src/modules/workshop/input';
import { emptyBody } from '../../src/modules/documents/content';
import { PrivateStorage } from '../../src/modules/files/storage';
import { prepareUpload,finalizeUpload } from '../../src/modules/files/service';
import { cleanupAssets } from '../../src/modules/files/cleanup';
const plan=():Plan=>({title:'Školní prsten',description:'Zkouška',steps:[{id:randomUUID(),text:'Připravit drát'},{id:randomUUID(),text:'Spojit'}],materials:[{id:randomUUID(),specification:'Stříbro Ag 925, drát 1 mm',type:'metal',unit:'g',quantity:null}],attachments:[]});
test('Etapa 5: školní cyklus a skutečná RLS/Storage',async t=>{
 const f=await fixtures(),runtime=new Pool({connectionString:process.env.DATABASE_URL,max:4}),ops=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:3}),db=drizzle(runtime),storage=new PrivateStorage(f.admin);
 const a=await f.create(),b=await f.create();for(const u of [a,b])await u.auth.auth.signInWithPassword({email:u.email,password:u.password});
 const da={db,identity:await verifyIdentity(a.auth)},dbb={db,identity:await verifyIdentity(b.auth)};
 const product=async(p=plan(),procedure?:work.Procedure)=>{const id=randomUUID();await work.saveProduct(da,{id,source:'school',procedureId:procedure?.id??null,procedureRevision:procedure?.revision_counter??null,plan:p});return id;};
 const start=async(id:string)=>{const d=await work.getProduct(da,id);return work.startProduct(da,id,{version:d.product.row_version,requestKey:randomUUID(),expectedProcedureRevision:d.procedure?.revision_counter??null});};
 const complete=async(id:string,cost:string|null=null)=>{const d=await work.getProduct(da,id);return work.completeProduct(da,id,{version:d.product.row_version,requestKey:randomUUID(),schoolCost:cost,actual:[]});};
 const upload=async()=>{const bytes=await sharp({create:{width:5,height:5,channels:3,background:'white'}}).png().toBuffer();const p=await prepareUpload({...da,storage},{name:'test.png',mime:'image/png',bytes:bytes.length});assert((await fetch(p.url,{method:'PUT',headers:{'Content-Type':'image/png'},body:new Uint8Array(bytes)})).ok);await finalizeUpload({...da,storage},p.id);return p.id;};
 try{
  await t.test('vzor s null množstvím → výrobek → snapshot, deník a fotky → done bez ceny',async()=>{
   const pid=randomUUID(),p=plan(),asset=await upload();p.attachments=[asset];await work.saveProcedure(da,{id:pid,plan:p});const proc=await work.getProcedure(da,pid),id=await product(proc.plan,proc);await start(id);
   let d=await work.getProduct(da,id);assert.equal(d.snapshot?.content_json.materials[0].quantity,null);assert.equal(d.product.status,'in_progress');assert.equal(d.materials[0].actual_confirmed,false);
   const jid=randomUUID(),body={version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Zkušenost'}]},{type:'assetImage',attrs:{assetId:asset,alt:''}}]}};
   await work.saveJournal(da,id,{id:jid,occurredAt:'2026-11-17',body});await work.setPhoto(da,id,{assetId:asset,role:'progress',present:true});await complete(id);d=await work.getProduct(da,id);assert.equal(d.product.school_cost,null);assert.equal(d.product.status,'done');assert.equal(d.journal.length,1);
   const finished=d.product.completed_at;await work.saveJournal(da,id,{id:jid,version:1,occurredAt:'2026-11-18',body:emptyBody});await work.setPhoto(da,id,{assetId:asset,role:'finished',present:true});await work.deleteJournal(da,id,jid,2);d=await work.getProduct(da,id);assert.deepEqual(d.product.completed_at,finished);assert.equal(d.journal.length,0);assert(d.snapshot);
  });
  await t.test('ruční výrobek bez kroků, materiálů, spotřeby a ceny lze dokončit',async()=>{
   const id=await product({...plan(),steps:[],materials:[]});await start(id);let d=await work.getProduct(da,id);assert.deepEqual(d.progress,{total:0,completed:0,percent:null});await complete(id);d=await work.getProduct(da,id);assert.equal(d.product.saved_procedure_id,null);assert.equal(d.product.created_without_procedure,true);assert.equal(d.product.school_cost,null);assert.equal(d.snapshot?.source_id,null);
  });
  await t.test('ruční výrobek → přesná skutečnost → upravený nový vzor právě jednou',async()=>{
   const id=await product({...plan(),materials:[{id:randomUUID(),specification:'Ag',type:'metal',unit:'g',quantity:'5.250'}]});await start(id);let d=await work.getProduct(da,id);await work.completeProduct(da,id,{requestKey:randomUUID(),version:d.product.row_version,schoolCost:null,actual:[{id:d.materials[0].id,quantity:'6.125',confirmed:true}]});d=await work.getProduct(da,id);const proposed=work.proposal(d);assert.equal(proposed.materials[0].quantity,'6.125');assert.equal(proposed.attachments.length,0);assert(!JSON.stringify(proposed).includes('is_completed'));
   proposed.title='Nový upravený vzor';const command={requestKey:randomUUID(),version:d.product.row_version,plan:proposed};const [one,two]=await Promise.all([work.createProcedureFromProduct(da,id,command),work.createProcedureFromProduct(da,id,command)]);assert.equal(one.id,two.id);assert.equal((await work.getProcedure(da,one.id)).title,proposed.title);const after=await work.getProduct(da,id);assert.equal(after.product.procedure_id,null);assert.equal(after.product.created_without_procedure,true);assert.deepEqual(after.product.completed_at,d.product.completed_at);assert.deepEqual(after.snapshot,d.snapshot);
  });
  await t.test('změna revize před zahájením je konflikt; po zahájení je kopie neměnná',async()=>{
   const pid=randomUUID(),p=plan();await work.saveProcedure(da,{id:pid,plan:p});const proc=await work.getProcedure(da,pid),id=await product(proc.plan,proc);await work.saveProcedure(da,{id:pid,version:1,plan:{...proc.plan,title:'Změněný vzor'}});
   await assert.rejects(()=>work.startProduct(da,id,{version:1,requestKey:randomUUID(),expectedProcedureRevision:1}),e=>e instanceof work.WorkError&&e.code==='PROCEDURE_CHANGED');await start(id);let d=await work.getProduct(da,id);assert.equal(d.snapshot?.content_json.title,proc.title);assert.equal(d.snapshot?.source_revision,2);
   const original=d.snapshot;await work.setStep(da,id,{stepId:d.steps[0].id,version:d.steps[0].row_version,completed:true});await work.saveProcedure(da,{id:pid,version:2,plan:{...proc.plan,steps:[]}});d=await work.getProduct(da,id);assert.deepEqual(d.snapshot,original);assert(d.steps[0].is_completed);
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`update app.product_procedure_snapshot set content_json='{}' where product_id=${id}`)));
  });
  await t.test('souběžné start/done, retry a návrat planned zachovávají jedinou kopii',async()=>{
   const id=await product();const cmd={version:1,requestKey:randomUUID(),expectedProcedureRevision:null};await Promise.all([work.startProduct(da,id,cmd),work.startProduct(da,id,cmd)]);let d=await work.getProduct(da,id);const original=d.snapshot,started=d.product.started_at;await work.setStep(da,id,{stepId:d.steps[0].id,version:d.steps[0].row_version,completed:true});d=await work.getProduct(da,id);await work.returnToPlan(da,id,d.product.row_version);await start(id);d=await work.getProduct(da,id);assert.deepEqual(d.snapshot,original);assert.deepEqual(d.product.started_at,started);assert(d.steps[0].is_completed);
   const done={requestKey:randomUUID(),version:d.product.row_version,schoolCost:null,actual:[]};await Promise.all([work.completeProduct(da,id,done),work.completeProduct(da,id,done)]);d=await work.getProduct(da,id);await assert.rejects(()=>work.completeProduct(da,id,{...done,schoolCost:'0'}));await assert.rejects(()=>work.returnToPlan(da,id,d.product.row_version));assert.equal((await ops.query('select count(*)::int n from app.product_procedure_snapshot where product_id=$1',[id])).rows[0].n,1);
  });
  await t.test('explicitní checkboxy, pracovní úpravy a relogin nemění snapshot ani stav done automaticky',async()=>{
   const id=await product();await start(id);let d=await work.getProduct(da,id);const snap=d.snapshot;for(const s of d.steps){const v={stepId:s.id,version:s.row_version,completed:true};await work.setStep(da,id,v);await work.setStep(da,id,v);}d=await work.getProduct(da,id);assert.equal(d.progress.percent,100);assert.equal(d.product.status,'in_progress');
   const changed=work.productPlan(d);changed.steps.push({id:randomUUID(),text:'Další krok'});await work.saveProduct(da,{id,version:d.product.row_version,source:'school',procedureId:null,procedureRevision:null,plan:changed});d=await work.getProduct(da,id);assert.equal(d.progress.completed,2);assert.equal(d.progress.total,3);assert.deepEqual(d.snapshot,snap);
   await a.auth.auth.signOut();await a.auth.auth.signInWithPassword({email:a.email,password:a.password});da.identity=await verifyIdentity(a.auth);assert.equal((await work.getProduct(da,id)).progress.completed,2);await complete(id);await assert.rejects(()=>work.setStep(da,id,{stepId:d.steps[0].id,version:d.steps[0].row_version,completed:false}));assert.equal(progress([]).percent,null);
  });
  await t.test('null/0/cena přesně jako řetězce; completed_at se opravou nemění',async()=>{
   const id=await product();await start(id);await complete(id);let d=await work.getProduct(da,id);const time=d.product.completed_at;assert.equal(d.product.school_cost,null);assert.equal(d.materials[0].actual_quantity,null);
   for(const cost of ['0','12345678901234.123456',null]){await work.updateActual(da,id,{version:d.product.row_version,schoolCost:cost,actual:[]});d=await work.getProduct(da,id);assert.equal(d.product.school_cost,cost===null?null:cost==='0'?'0.000000':cost);assert.deepEqual(d.product.completed_at,time);}
   const snapshot=d.snapshot,extra=randomUUID();await work.updateActual(da,id,{version:d.product.row_version,schoolCost:null,actual:[],additional:[{id:extra,specification:'Dodatečná součástka',type:'component',unit:'ks',quantity:'2'}]});d=await work.getProduct(da,id);assert.equal(d.materials.find(m=>m.id===extra)?.planned_quantity,null);assert.equal(d.materials.find(m=>m.id===extra)?.actual_quantity,'2.000');assert.deepEqual(d.snapshot,snapshot);assert.deepEqual(d.product.completed_at,time);assert.equal(work.proposal(d).materials.find(m=>m.id===extra)?.quantity,'2.000');
   assert.throws(()=>planInput.parse({...plan(),materials:[{id:randomUUID(),specification:'Kámen',type:'stone',unit:'ks',quantity:'1.5'}]}));assert.throws(()=>planInput.parse({...plan(),materials:[{id:randomUUID(),specification:'Kov',type:'metal',unit:'g',quantity:'1.2345'}]}));
   await assert.rejects(()=>work.saveProduct(da,{id:randomUUID(),source:'own',procedureId:null,procedureRevision:null,plan:plan()}));
   assert.equal((await ops.query("select count(*)::int n from app.inventory_movement where owner_id=$1",[a.id])).rows[0].n,0);
  });
  await t.test('A/B, cizí vazby, neaktivní účet, stará relace a konflikty editace',async()=>{
   const foreign=randomUUID();await work.saveProcedure(dbb,{id:foreign,plan:plan()});await assert.rejects(()=>work.getProcedure(da,foreign));await assert.rejects(()=>product(plan(),{id:foreign,revision_counter:1} as work.Procedure));
   const id=await product();await assert.rejects(()=>work.getProduct(dbb,id));await assert.rejects(()=>work.saveJournal(dbb,id,{id:randomUUID(),occurredAt:'2026-11-17',body:emptyBody}));await assert.rejects(()=>work.startProduct(dbb,id,{version:1,requestKey:randomUUID()}));
   const asset=await upload();await assert.rejects(()=>work.saveProcedure(dbb,{id:randomUUID(),plan:{...plan(),attachments:[asset]}}));
   const bid=randomUUID();await work.saveProduct(dbb,{id:bid,source:'school',procedureId:null,procedureRevision:null,plan:plan()});await work.startProduct(dbb,bid,{version:1,requestKey:randomUUID()});const bd=await work.getProduct(dbb,bid);await assert.rejects(()=>work.setPhoto(dbb,bid,{assetId:asset,role:'progress',present:true}));await assert.rejects(()=>work.saveJournal(dbb,bid,{id:randomUUID(),occurredAt:'2026-11-17',body:{version:1,doc:{type:'doc',content:[{type:'assetImage',attrs:{assetId:asset,alt:''}}]}}}));
   await assert.rejects(()=>work.updateActual(da,id,{version:1,schoolCost:null,actual:[{id:bd.materials[0].id,quantity:'1',confirmed:true}]}));
   assert.equal((await withAccount(db,da.identity,tx=>tx.execute(sql`select * from app.product_procedure_snapshot where product_id=${bid}`))).rowCount,0);
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`insert into app.asset_link(owner_id,product_id,asset_id,role,position) values(${a.id},${bid},${asset},'progress',0)`)));
   let d=await work.getProduct(da,id);const p=work.productPlan(d),input={id,version:1,source:'school',procedureId:null,procedureRevision:null,plan:p};await work.saveProduct(da,input);await assert.rejects(()=>work.saveProduct(da,input));
   const malicious={version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]}};await assert.rejects(()=>work.saveJournal(da,id,{id:randomUUID(),occurredAt:'2026-11-17',body:malicious}));
   assert.equal((await runtime.query('select * from app.product')).rowCount,0);
   for(const status of ['inactive','pending_password','disabled']){await ops.query('update app.user_account set status=$2 where auth_user_id=$1',[a.id,status]);await assert.rejects(()=>work.getProduct(da,id));await assert.rejects(()=>work.listWork(da,'procedure'));}
   await ops.query("update app.user_account set status='active',sessions_valid_after=now()+interval '1 second' where auth_user_id=$1",[a.id]);await assert.rejects(()=>work.getProduct(da,id));await ops.query("update app.user_account set sessions_valid_after=now()-interval '1 hour' where auth_user_id=$1",[a.id]);d=await work.getProduct(da,id);assert.equal(d.product.status,'planned');
  });
  await t.test('archivace a odebrání příloh neodstraní snapshotové reference',async()=>{
   const asset=await upload(),p={...plan(),attachments:[asset]},pid=randomUUID();await work.saveProcedure(da,{id:pid,plan:p});const proc=await work.getProcedure(da,pid),id=await product(proc.plan,proc);await start(id);
   await work.saveProcedure(da,{id:pid,version:1,plan:{...proc.plan,attachments:[]}});let d=await work.getProduct(da,id);await work.saveProduct(da,{id,version:d.product.row_version,source:'school',procedureId:pid,procedureRevision:1,plan:{...work.productPlan(d),attachments:[]}});await work.archiveProcedure(da,pid,2);
   await assert.rejects(()=>product(proc.plan,{...proc,revision_counter:3,archived_at:'now'}));d=await work.getProduct(da,id);assert.equal(d.snapshot?.content_json.attachments[0],asset);
   await ops.query("update app.asset set unlinked_at=now()-interval '25 hours',upload_expires_at=now()-interval '1 hour' where id=$1",[asset]);await cleanupAssets(ops,storage,true,50,a.id);assert.equal((await ops.query('select state from app.asset where id=$1',[asset])).rows[0].state,'ready');
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`delete from app.asset_link where snapshot_id=${d.snapshot!.id}`)));
  });
  await t.test('hledání a stránkování postupů/výrobků s filtry',async()=>{
   for(let i=0;i<21;i++)await work.saveProcedure(da,{id:randomUUID(),plan:{...plan(),title:`Stránkování ${i}`}});assert.equal((await work.listWork(da,'procedure','Stránkování',1)).items.length,20);assert.equal((await work.listWork(da,'procedure','Stránkování',2)).items.length,1);
   const done=await work.listWork(da,'product','',1,'done');assert(done.items.length>0);assert(done.items.every(p=>p.status==='done'));assert.equal((await work.listWork(dbb,'product')).total,1);
  });
 }finally{await runtime.end();await ops.end();await f.cleanup();}
});
