import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { unpack } from '../helpers/archive';
import { fixtures } from '../helpers/fixtures';
import { verifyIdentity, withAccount } from '../../src/modules/identity/service';
import { saveDocument } from '../../src/modules/documents/service';
import { emptyBody } from '../../src/modules/documents/content';
import { PrivateStorage } from '../../src/modules/files/storage';
import { prepareUpload, finalizeUpload, readAsset } from '../../src/modules/files/service';
import { saveItem, createPurchase, listItems } from '../../src/modules/inventory/service';
import { saveProduct, getProduct, startProduct, archiveProduct } from '../../src/modules/workshop/service';
import { settleOwn } from '../../src/modules/inventory/settlements';
import { claimExport, releaseExport, exportSnapshot, buildExport, singleExportFile } from '../../src/modules/export/service';
import { csv, zip, sha256 } from '../../src/modules/export/archive';
test('Etapa 9: export na skutečném runtime PostgreSQL a Storage', async t => {
 const f = await fixtures(), a = await f.create(), b = await f.create();
 try {
  for (const u of [a,b]) await u.auth.auth.signInWithPassword({ email:u.email, password:u.password });
  const db = drizzle(f.runtime), storage = new PrivateStorage(f.admin);
  const d = {db, storage, identity: await verifyIdentity(a.auth)}, other = {...d, identity: await verifyIdentity(b.auth)};
  const uploaded: string[] = [];
  for (const owner of [d,d,other]) {
   const bytes = Buffer.from('# Příloha\nŽluťoučký kůň'), p = await prepareUpload(owner,{name:'stejný název.md',mime:'text/markdown',bytes:bytes.length});
   const put = await fetch(p.url,{method:'PUT',headers:{'Content-Type':'text/markdown'},body:new Uint8Array(bytes)}); assert(put.ok);
   await finalizeUpload(owner,p.id); uploaded.push(p.id);
   await saveDocument(owner,{id:randomUUID(),title:'=HYPERLINK("nebezpečné")',kind:'file',assetId:p.id});
  }
  await saveDocument(d,{id:randomUUID(),title:'Česká poznámka',kind:'note',body:emptyBody});
  await f.migration.query('update app.user_profile set has_workshop=true where user_id=$1',[a.id]);
  const itemId=randomUUID(); await saveItem(d,{id:itemId,name:'Ag',type:'metal'});
  await createPurchase(d,{requestKey:randomUUID(),businessDate:'2026-11-17',supplier:'Žluťoučký',lines:[{itemId,quantity:'10.125',totalCost:null}]});
  const productId=randomUUID();
  await saveProduct(d,{id:productId,source:'own',procedureId:null,procedureRevision:null,plan:{title:'Archivovaná výroba',description:'',steps:[],materials:[{id:randomUUID(),specification:'Ag',type:'metal',unit:'g',quantity:'5'}],attachments:[]}});
  const planned=await getProduct(d,productId);
  await startProduct(d,productId,{requestKey:randomUUID(),version:1,reservations:planned.materials.map(m=>({materialId:m.id,itemId,quantity:'5',reserveEnabled:true,confirmed:true,cardVersion:1}))});
  for(const mode of ['complete','correct'] as const) {
   const detail=await getProduct(d,productId);
   await settleOwn(d,productId,mode,{requestKey:randomUUID(),version:detail.product.row_version,expectedRevision:detail.settlements[0]?.revision??0,reason:'Historie pro export',lines:detail.materials.map(m=>({materialId:m.id,itemId,cardVersion:1,taken:'5',inProduct:'4',returned:mode==='complete'?'0.5':'0.3',scrap:'0.5',lost:mode==='complete'?'0':'0.2',confirmed:true}))});
  }
  await archiveProduct(d,productId,{version:(await getProduct(d,productId)).product.row_version,archived:true});
  await f.migration.query('update app.asset set workshop_only=true where id=$1',[uploaded[0]]);
  await f.migration.query('update app.inventory_item set archived_at=now() where id=$1',[itemId]);
  await f.migration.query('update app.user_profile set has_workshop=false where user_id=$1',[a.id]);
  await t.test('úzká výjimka po vypnutí dílny a úplný ZIP bez cizích dat',async()=>{
   await assert.rejects(()=>listItems(d)); await assert.rejects(()=>readAsset(d,uploaded[0]));
   const token=await claimExport(d);
   try {
    await assert.rejects(()=>claimExport(other));
    const snapshot=await exportSnapshot(d,token);
    assert.equal(snapshot.tables.purchase_line[0].quantity,'10.125'); assert.equal(snapshot.tables.purchase_line[0].total_cost,null);
    assert.equal(snapshot.tables.inventory_item[0].id,itemId); assert(snapshot.tables.inventory_item[0].archived_at);
    assert.equal((await f.runtime.query('select * from app.inventory_item')).rowCount,0);
    const result=await buildExport(d,token,true,AbortSignal.timeout(15000)); assert(result.complete);
    const entries=await unpack(result.bytes), data=JSON.parse(entries.get('data.json')!.toString());
    assert.equal(data.tables.product[0].id,productId);assert(data.tables.product[0].archived_at);
    assert.equal(data.tables.product_settlement.length,2);assert.equal(data.tables.settlement_line.length,2);
    assert.equal(data.tables.product_procedure_snapshot.length,1);assert(data.tables.inventory_movement.length>2);
    assert.equal(data.tables.asset.length,2); assert.equal(data.tables.document.length,3);
    assert(!JSON.stringify(data).includes(b.id)); assert(!JSON.stringify(data).includes('storage_key'));
    assert.equal(data.tables.purchase_line[0].total_cost,null);
    assert(!JSON.stringify(data).includes('creation_hash')); assert(!JSON.stringify(data).includes('request_key'));
    const manifest=JSON.parse(entries.get('manifest.json')!.toString());
    for(const entry of manifest.entries) assert.equal(sha256(entries.get(entry.path)!),entry.sha256);
    for(const file of manifest.files) { assert(file.verified); assert(file.path.startsWith('files/'+file.assetId)); }
    assert.notEqual(manifest.files[0].path,manifest.files[1].path); assert.equal(manifest.files[0].originalName,manifest.files[1].originalName);
    assert(entries.get('csv/document.csv')!.toString().includes("'=HYPERLINK"));
    await assert.rejects(()=>singleExportFile(d,token,uploaded[2],AbortSignal.timeout(1000)));
    assert((await singleExportFile(d,token,uploaded[0],AbortSignal.timeout(15000))).bytes.length);
   } finally { await releaseExport(d,token); }
  });
  await t.test('DB snapshot končí před sítí; souběžný nákup nemění exportovaný snímek',async()=>{
   await f.migration.query('update app.user_profile set has_workshop=true where user_id=$1',[a.id]);
   let observed=false;
   class ConcurrentStorage extends PrivateStorage {
    override async bytes(key:string,max:number,signal?:AbortSignal) {
     if(!observed) {
      observed=true;
      await createPurchase(d,{requestKey:randomUUID(),businessDate:'2026-11-17',supplier:'Souběžný nákup',lines:[{itemId,quantity:'1',totalCost:'30'}]});
     }
     return super.bytes(key,max,signal);
    }
   }
   // Archived card must be explicitly restored for a regular new purchase.
   await f.migration.query('update app.inventory_item set archived_at=null where id=$1',[itemId]);
   const token=await claimExport(d);
   try {
    const before=(await exportSnapshot(d,token)).tables.purchase.length;
    const result=await buildExport({...d,storage:new ConcurrentStorage(f.admin)},token,true,AbortSignal.timeout(15000));
    const entries=await unpack(result.bytes),data=JSON.parse(entries.get('data.json')!.toString());
    assert(observed);assert.equal(data.tables.purchase.length,before);
    assert.equal((await exportSnapshot(d,token)).tables.purchase.length,before+1);
   } finally {
    await releaseExport(d,token);
    await f.migration.query('update app.user_profile set has_workshop=false where user_id=$1',[a.id]);
   }
  });
  await t.test('oddělené soubory, pending, chybějící a změněný soubor, přerušení a release',async()=>{
   const token=await claimExport(d);
   try {
    const separate=await buildExport(d,token,false,AbortSignal.timeout(15000)); assert.equal(separate.complete,false);
    const key=(await f.migration.query('select storage_key from app.asset where id=$1',[uploaded[1]])).rows[0].storage_key;
    await storage.remove(key);
    await assert.rejects(()=>buildExport(d,token,true,AbortSignal.timeout(15000)),{code:'FILE_UNAVAILABLE'});
    const bytes=Buffer.from('# Příloha\nŽluťoučký kůň'); assert(!(await f.admin.storage.from('craftbook-private').upload(key,bytes,{contentType:'text/markdown'})).error);
    await storage.remove(key);
    const corrupt=Buffer.from(bytes);corrupt[0]=33;
    assert(!(await f.admin.storage.from('craftbook-private').upload(key,corrupt,{contentType:'text/markdown'})).error);
    await assert.rejects(()=>buildExport(d,token,true,AbortSignal.timeout(15000)),{code:'FILE_UNAVAILABLE'});
    await storage.remove(key);
    assert(!(await f.admin.storage.from('craftbook-private').upload(key,bytes,{contentType:'text/markdown'})).error);
    await prepareUpload(d,{name:'čekající.md',mime:'text/markdown',bytes:5});
    assert.equal((await buildExport(d,token,true,AbortSignal.timeout(15000))).complete,false);
    const controller=new AbortController();controller.abort();await assert.rejects(()=>buildExport(d,token,true,controller.signal));
   } finally { await releaseExport(d,token); }
   const next=await claimExport(other);await releaseExport(other,next);
  });
  await t.test('limit nevrací oříznutá data a expirovaný lease lze bezpečně převzít',async()=>{
   const token=await claimExport(d);
   try {
    await f.migration.query(`insert into app.document(id,owner_id,title,kind,body_json,creation_hash)
     select gen_random_uuid(),$1,'Limit exportu 9','note',$2::jsonb,'fixture' from generate_series(1,10001)`,[a.id,JSON.stringify(emptyBody)]);
    await assert.rejects(()=>exportSnapshot(d,token),{code:'LIMIT',status:413});
    await f.migration.query("delete from app.document where owner_id=$1 and title='Limit exportu 9'",[a.id]);
    await f.migration.query("update app.export_lease set expires_at=now()-interval '1 second' where token=$1",[token]);
    const next=await claimExport(other);
    try {await releaseExport(d,token);await assert.rejects(()=>claimExport(d));}
    finally {await releaseExport(other,next);}
   } finally {await releaseExport(d,token);}
  });
  await t.test('blokované účty, stará relace a přímá oprávnění runtime',async()=>{
   await assert.rejects(()=>f.runtime.query('select * from app.export_lease'));
   await assert.rejects(()=>f.runtime.query('select * from app.export_records($1)',[randomUUID()]));
   for(const status of ['inactive','pending_password','disabled']) {
    await f.migration.query('update app.user_account set status=$2 where auth_user_id=$1',[a.id,status]);
    await assert.rejects(()=>claimExport(d));
   }
   await f.migration.query("update app.user_account set status='active',sessions_valid_after=now()+interval '1 second' where auth_user_id=$1",[a.id]);
   await assert.rejects(()=>claimExport(d));
   assert.equal((await withAccount(db,other.identity,tx=>tx.execute(sql`select * from app.inventory_item`))).rows.length,0);
  });
 } finally { await f.cleanup(); }
});
test('CSV a bezpečné unikátní ZIP cesty',async()=>{
 const bytes=csv([{name:'České "uvozovky"; text',value:'  =1+1',negative:'-1',nil:null}]);
 assert(bytes.toString().includes('České ""uvozovky""; text'));assert(bytes.toString().includes("'  =1+1"));
 assert.throws(()=>zip([{path:'../escape',bytes}]));assert.throws(()=>zip([{path:'data',bytes},{path:'data',bytes}]));
 const entries=await unpack(zip([{path:'data.csv',bytes}]));assert.deepEqual(entries.get('data.csv'),bytes);
});
