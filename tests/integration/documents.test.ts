import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { docxFixture } from '../helpers/docx';
import { createClient } from '@supabase/supabase-js';
import { fixtures } from '../helpers/fixtures';
import { verifyIdentity,withAccount } from '../../src/modules/identity/service';
import { saveDocument,getDocument,listDocuments,deleteDocument } from '../../src/modules/documents/service';
import { emptyBody,validateBody } from '../../src/modules/documents/content';
import { prepareUpload,finalizeUpload,getAsset,readAsset } from '../../src/modules/files/service';
import { PrivateStorage } from '../../src/modules/files/storage';
import { cleanupAssets } from '../../src/modules/files/cleanup';
import { validateFile } from '../../src/modules/files/validate';
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
test('Etapa 4: skutečné dokumenty, Storage, RLS a obnova',async t=>{
 const f=await fixtures();const ops=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:3});const runtime=new Pool({connectionString:process.env.DATABASE_URL,max:3});
 const a=await f.create(),b=await f.create();await a.auth.auth.signInWithPassword({email:a.email,password:a.password});await b.auth.auth.signInWithPassword({email:b.email,password:b.password});
 const storage=new PrivateStorage(f.admin),db=drizzle(runtime),da={db,identity:await verifyIdentity(a.auth),storage},dbb={db,identity:await verifyIdentity(b.auth),storage};
 const image=await sharp({create:{width:20,height:20,channels:3,background:'#355e50'}}).png().toBuffer();
 const put=async(d:typeof da,buffer:Buffer,name='a.pdf',mime='application/pdf')=>{const p=await prepareUpload(d,{name,mime,bytes:buffer.length});const r=await fetch(p.url,{method:'PUT',headers:{'Content-Type':mime},body:new Uint8Array(buffer)});assert(r.ok,'Signed upload musí uspět');return p;};
 const age=async(id:string)=>ops.query("update app.asset set unlinked_at=now()-interval '25 hours',upload_expires_at=now()-interval '1 hour' where id=$1",[id]);
 try{
  await t.test('CRUD, idempotentní vytvoření, hledání, stabilní stránky a konflikt',async()=>{
   const id=randomUUID();const input={id,title:'Jehla',kind:'note',body:emptyBody};await saveDocument(da,input);await saveDocument(da,input);
   for(let i=0;i<22;i++)await saveDocument(da,{...input,id:randomUUID(),title:`Stránky ${i}`});
   const one=await listDocuments(da,'Stránky',1),two=await listDocuments(da,'Stránky',2);assert.equal(one.items.length,20);assert.equal(two.items.length,2);assert.equal(new Set([...one.items,...two.items].map(d=>d.id)).size,22);
   assert.equal((await listDocuments(dbb)).total,0);assert.equal((await listDocuments(da,'Jehla')).total,1);
   await saveDocument(da,{...input,title:'Jehlice',version:1});await assert.rejects(()=>saveDocument(da,{...input,version:1}));assert.equal((await getDocument(da,id)).title,'Jehlice');
   await a.auth.auth.signOut();await a.auth.auth.signInWithPassword({email:a.email,password:a.password});da.identity=await verifyIdentity(a.auth);assert.equal((await getDocument(da,id)).title,'Jehlice');
   await deleteDocument(da,id,2);await deleteDocument(da,id,2);assert.equal((await listDocuments(da,'Jehlice')).total,0);
  });
  await t.test('PDF a obrázek: finalize retry, Asset ID, immutable objekt i při x-upsert',async()=>{
   const p=await put(da,pdf);await finalizeUpload(da,p.id);await finalizeUpload(da,p.id);
   const doc=randomUUID();await saveDocument(da,{id:doc,title:'Podklad',kind:'file',assetId:p.id});assert.equal((await getDocument(da,doc)).asset_id,p.id);
   const replay=await fetch(p.url,{method:'PUT',headers:{'Content-Type':'application/pdf','x-upsert':'true'},body:new Uint8Array(Buffer.from('%PDF-1.4 malicious %%EOF'))});assert(!replay.ok);assert.deepEqual((await readAsset(da,p.id)).bytes,pdf);
   const img=await put(da,image,'photo.png','image/png');await finalizeUpload(da,img.id);
   const body={version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Zápis'}]},{type:'assetImage',attrs:{assetId:img.id,alt:'Zkouška'}}]}};
   const note=randomUUID();await saveDocument(da,{id:note,title:'S obrázkem',kind:'note',body});assert.deepEqual((await getDocument(da,note)).body_json,body);assert(!JSON.stringify(body).includes('http'));
   await assert.rejects(()=>saveDocument(dbb,{id:randomUUID(),title:'Cizí',kind:'note',body}));
  });
  await t.test('validní DOCX a UTF-8 MD zůstávají původními přílohami',async()=>{
   for(const [name,mime,buffer] of [['poznamka.md','text/markdown',Buffer.from('# Zkouška\nSoukromé poznámky')],['poznamka.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',docxFixture()]] as const){
    const p=await put(da,buffer,name,mime);await finalizeUpload(da,p.id);const id=randomUUID();await saveDocument(da,{id,title:name,kind:'file',assetId:p.id});assert.deepEqual((await readAsset(da,p.id)).bytes,buffer);await saveDocument(da,{id,title:'Přejmenováno',kind:'file',assetId:p.id,version:1});await deleteDocument(da,id,2);
   }
  });
  await t.test('A/B a přímé Storage požadavky, žádný kontext a blokovaný účet',async()=>{
   const p=await put(dbb,pdf);await finalizeUpload(dbb,p.id);const id=randomUUID();await saveDocument(dbb,{id,title:'Soukromé B',kind:'file',assetId:p.id});
   await assert.rejects(()=>getDocument(da,id));await assert.rejects(()=>getAsset(da,p.id));await assert.rejects(()=>finalizeUpload(da,p.id));await assert.rejects(()=>readAsset(da,p.id));await assert.rejects(()=>saveDocument(da,{id,title:'Pokus',kind:'file',assetId:p.id,version:1}));await deleteDocument(da,id,1);assert.equal((await getDocument(dbb,id)).title,'Soukromé B');
   const key=(await getAsset(dbb,p.id)).storage_key;
   assert((await a.auth.storage.from('craftbook-private').download(key)).error);assert((await a.auth.storage.from('craftbook-private').createSignedUrl(key,60)).error);assert((await a.auth.storage.from('craftbook-private').upload(key,pdf)).error);assert((await b.auth.storage.from('craftbook-private').download(key)).error);const anon=createClient(f.authUrl,f.publicKey,{auth:{persistSession:false}});assert((await anon.storage.from('craftbook-private').download(key)).error);
   assert.equal((await runtime.query('select * from app.document')).rowCount,0);
   for(const status of ['inactive','pending_password','disabled']){await ops.query('update app.user_account set status=$2 where auth_user_id=$1',[a.id,status]);await assert.rejects(()=>listDocuments(da));await assert.rejects(()=>prepareUpload(da,{name:'x.pdf',mime:'application/pdf',bytes:pdf.length}));await assert.rejects(()=>finalizeUpload(da,p.id));}
   await ops.query("update app.user_account set status='active',sessions_valid_after=now()+interval '1 second' where auth_user_id=$1",[a.id]);await assert.rejects(()=>listDocuments(da));await ops.query("update app.user_account set sessions_valid_after=now()-interval '1 hour' where auth_user_id=$1",[a.id]);
  });
  await t.test('server odmítá XSS, atributy, falešné typy, limity a cizí vazby',async()=>{
   for(const node of [{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]},{type:'image',attrs:{src:'https://foreign.invalid'}},{type:'text',text:'x',attrs:{onclick:'x'}}])assert.throws(()=>validateBody({version:1,doc:{type:'doc',content:[{type:'paragraph',content:[node]}]}}));
   assert.throws(()=>validateBody({version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x'.repeat(300000)}]}]}}));
   await assert.rejects(()=>prepareUpload(da,{name:'x.svg',mime:'image/svg+xml',bytes:5}));await assert.rejects(()=>prepareUpload(da,{name:'x.pdf',mime:'application/pdf',bytes:10485761}));await assert.rejects(()=>prepareUpload(da,{name:'x.pdf',mime:'image/png',bytes:4}));
   const fake=await put(da,Buffer.from('not a PDF'));await assert.rejects(()=>finalizeUpload(da,fake.id));assert.equal((await getAsset(da,fake.id)).state,'pending');
   await assert.rejects(()=>validateFile(Buffer.from([255,0,1]),'x.md','text/markdown',3));await assert.rejects(()=>validateFile(pdf,'x.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf.length));
   const large=await sharp({create:{width:2001,height:2,channels:3,background:'white'}}).png().toBuffer();await assert.rejects(()=>validateFile(large,'x.png','image/png',large.length));
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`insert into app.asset_link(owner_id,document_id,asset_id,role,position) values(${a.id},${randomUUID()},${fake.id},'main',0)`)));
  });
  await t.test('skutečné SQL vynucuje hlavní přílohu, vlastníka vazeb a ochranu reference',async()=>{
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`insert into app.document(id,owner_id,title,kind,creation_hash) values(${randomUUID()},${a.id},'Bez přílohy','file','test')`)));
   const img=await put(da,image,'fk.png','image/png');await finalizeUpload(da,img.id);
   const foreign=randomUUID();await saveDocument(dbb,{id:foreign,title:'B',kind:'note',body:emptyBody});
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`insert into app.asset_link(owner_id,document_id,asset_id,role,position) values(${a.id},${foreign},${img.id},'image',0)`)));
   const mine=randomUUID(),body={version:1,doc:{type:'doc',content:[{type:'assetImage',attrs:{assetId:img.id,alt:''}}]}};await saveDocument(da,{id:mine,title:'Vazba',kind:'note',body});
   await assert.rejects(()=>withAccount(db,da.identity,tx=>tx.execute(sql`update app.asset set state='deleting' where id=${img.id}`)));
   const roles=await ops.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in ('app.document'::regclass,'app.asset'::regclass,'app.asset_link'::regclass)");assert(roles.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
  });
  await t.test('přerušený upload, sdílené reference, grace a retry mazání',async()=>{
   const fresh=await prepareUpload(da,{name:'fresh.pdf',mime:'application/pdf',bytes:pdf.length});await assert.rejects(()=>finalizeUpload(da,fresh.id));await cleanupAssets(ops,storage,true,50,a.id);assert.equal((await getAsset(da,fresh.id)).state,'pending');await age(fresh.id);await cleanupAssets(ops,storage,true,50,a.id);await assert.rejects(()=>getAsset(da,fresh.id));
   const p=await put(da,image,'shared.png','image/png');await finalizeUpload(da,p.id);const body={version:1,doc:{type:'doc',content:[{type:'assetImage',attrs:{assetId:p.id,alt:''}}]}};const ids=[randomUUID(),randomUUID()];for(const id of ids)await saveDocument(da,{id,title:'Sdílený',kind:'note',body});
   await deleteDocument(da,ids[0],1);await age(p.id);await cleanupAssets(ops,storage,true,50,a.id);assert.equal((await getAsset(da,p.id)).state,'ready');await deleteDocument(da,ids[1],1);await age(p.id);
   const broken=new PrivateStorage(f.admin);broken.remove=async()=>{throw new Error('simulated');};const failed=await cleanupAssets(ops,broken,true,50,a.id);assert(failed.failed>0);assert.equal((await getAsset(da,p.id)).state,'deleting');await assert.rejects(()=>saveDocument(da,{id:randomUUID(),title:'Smazaný',kind:'note',body}));
   await cleanupAssets(ops,storage,true,50,a.id);await assert.rejects(()=>getAsset(da,p.id));await cleanupAssets(ops,storage,true,50,a.id);
  });
  await t.test('souběh finalizace/připojení s označením deleting',async()=>{
   const p=await put(da,pdf);await age(p.id);const hold=await ops.connect();await hold.query('BEGIN');await hold.query("update app.asset set state='deleting' where id=$1",[p.id]);
   const final=finalizeUpload(da,p.id);await new Promise(r=>setTimeout(r,100));await hold.query('COMMIT');hold.release();await assert.rejects(()=>final);await cleanupAssets(ops,storage,true,50,a.id);
   const q=await put(da,pdf);await finalizeUpload(da,q.id);await age(q.id);const conn=await ops.connect();await conn.query('BEGIN');await conn.query('select id from app.asset where id=$1 for update',[q.id]);
   const save=saveDocument(da,{id:randomUUID(),title:'Závod',kind:'file',assetId:q.id});await conn.query("update app.asset set state='deleting' where id=$1",[q.id]);await conn.query('COMMIT');conn.release();await assert.rejects(()=>save);await cleanupAssets(ops,storage,true,50,a.id);
  });
  await t.test('krátký signed download expiruje a nový vyžaduje aktivní účet',async()=>{
   const p=await put(da,pdf);await finalizeUpload(da,p.id);const arow=await getAsset(da,p.id);const url=await storage.signedDownload(arow.storage_key,1);assert((await fetch(url)).ok);await new Promise(r=>setTimeout(r,2200));assert(!(await fetch(url)).ok);assert.deepEqual((await readAsset(da,p.id)).bytes,pdf);
   await ops.query("update app.user_account set status='disabled' where auth_user_id=$1",[a.id]);await assert.rejects(()=>readAsset(da,p.id));await ops.query("update app.user_account set status='active' where auth_user_id=$1",[a.id]);
  });
 }finally{await runtime.end();await ops.end();await f.cleanup();}
});
