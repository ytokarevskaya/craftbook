import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {chromium,type BrowserContext} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {cloudConnections} from './config';
import {api,verifyTargets} from './api';
import {cloudTarget} from '../../src/lib/cloud-target';
import {runOperation} from '../ops/service';
import {unpack} from '../../tests/helpers/archive';
import type {ProductDetail} from '../../src/modules/workshop/service';
type User={id?:string;email:string;temporaryPassword:string;password:string;createKey:string};
let phase='target',lastRoute='';
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--synthetic-accounts-authorized')throw new Error('AUTHORIZATION_FLAG_REQUIRED');
 const c=cloudConnections(),target=await verifyTargets(c.env);
 await mkdir('.cloud',{recursive:true,mode:0o700});
 let state;
 try{state=JSON.parse(await readFile('.cloud/smoke-secrets.json','utf8'));}
 catch{state={date:new Date().toISOString().slice(0,10),users:Array.from({length:2},()=>({email:`craftbook-pilot-${randomUUID()}@example.invalid`,temporaryPassword:randomBytes(24).toString('base64url'),password:randomBytes(24).toString('base64url'),createKey:randomUUID()})),ids:Object.fromEntries(['noteA','noteB','file','procedure','school','own','item','purchase','startSchool','startOwn','doneSchool','doneOwn','journal'].map(key=>[key,randomUUID()]))};}
 const users:User[]=state.users,ids:Record<string,string>=state.ids;
 const save=()=>writeFile('.cloud/smoke-secrets.json',JSON.stringify(state),{mode:0o600});await save();
 const ops={pool:c.migration,admin:c.admin,authUrl:c.authUrl,publicKey:c.publicKey,cloudProject:cloudTarget.projectRef};
 const browser=await chromium.launch({channel:'chrome'}),contexts:BrowserContext[]=[];
 const origin=cloudTarget.origin;
 async function request<T>(context:BrowserContext,path:string,method='GET',data?:unknown):Promise<T>{
  lastRoute=method+' '+path;
  const response=await context.request.fetch(origin+path,{method,headers:{Origin:origin},...(data===undefined?{}:{data})});
  if(!response.ok()){let code='FAILED';try{const body=await response.json();if(typeof body.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(body.code))code=body.code;}catch{}throw new Error('HTTP_'+response.status()+'_'+code);}return await response.json() as T;
 }
 async function login(context:BrowserContext,user:User){
  let result=await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:user.email,password:user.password}});
  if(!result.ok())result=await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:user.email,password:user.temporaryPassword}});
  assert(result.ok());const next=await result.json();
  if(next.redirect==='/change-password'){
   assert.equal((await context.request.get(origin+'/api/profile')).status(),403);
   await request(context,'/api/auth/password','POST',{newPassword:user.password,confirmation:user.password});
   result=await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:user.email,password:user.password}});assert(result.ok());
  }
  assert.equal((await result.json()).redirect,'/');
 }
 try{
  phase='provision-test-accounts';
  for(const user of users){
   assert(/^craftbook-pilot-[a-f0-9-]+@example\.invalid$/.test(user.email));
   const result=await runOperation(ops,{kind:'create',key:user.createKey,reference:'Autorizovaný syntetický pilotní test',email:user.email,password:user.temporaryPassword});user.id=result.targetId;await save();
   const context=await browser.newContext({viewport:{width:375,height:900}});context.setDefaultTimeout(20000);contexts.push(context);await login(context,user);
  }
  const [a,b]=contexts;
  const health=await a.request.get(origin+'/api/health');assert.deepEqual(await health.json(),{status:'ok'});
  assert((await a.cookies(origin)).filter(cookie=>cookie.name.startsWith('sb-')).every(cookie=>cookie.secure&&cookie.httpOnly&&cookie.sameSite==='Lax'));
  assert.equal((await a.request.patch(origin+'/api/profile',{headers:{Origin:'https://attacker.invalid'},data:{}})).status(),403);
  const signup=createClient(c.authUrl,c.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const negative=await signup.auth.signUp({email:`craftbook-negative-${randomUUID()}@example.com`,password:randomBytes(24).toString('base64url')});assert.equal(negative.error?.code,'signup_disabled');
  phase='upload-and-documents';
  const image=await sharp({create:{width:60,height:40,channels:3,background:'#355e50'}}).png().toBuffer();
  async function upload(context:BrowserContext,name:string,mime:string,bytes:Buffer){
   const p=await request<{id:string;url:string}>(context,'/api/assets/prepare','POST',{name,mime,bytes:bytes.length});
   assert.equal(new URL(p.url).origin,c.authUrl);
   assert((await fetch(p.url,{method:'PUT',headers:{'Content-Type':mime},body:new Uint8Array(bytes)})).ok);
   await request(context,'/api/assets/'+p.id+'/finalize','POST',{});return p.id;
  }
  if(!ids.imageA){ids.imageA=await upload(a,'pilot.png','image/png',image);await save();}
  if(!ids.imageB){ids.imageB=await upload(b,'pilot-b.png','image/png',image);await save();}
  if(!ids.pdf){ids.pdf=await upload(a,'pilot-faktura.pdf','application/pdf',Buffer.from('%PDF-1.4\n%%EOF'));await save();}
  const body=(assetId:string)=>({version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Syntetická pilotní kontrola — nejde o skutečnou výrobu.'}]},{type:'assetImage',attrs:{assetId,alt:'Testovací obrázek'}}]}});
  await request(a,'/api/documents','POST',{id:ids.noteA,title:'Pilotní technická poznámka',kind:'note',body:body(ids.imageA)});
  await request(b,'/api/documents','POST',{id:ids.noteB,title:'Oddělená syntetická poznámka B',kind:'note',body:body(ids.imageB)});
  await request(a,'/api/documents','POST',{id:ids.file,title:'Syntetická pilotní faktura',kind:'file',assetId:ids.pdf});
  for(const path of ['/api/documents/'+ids.noteA,'/api/assets/'+ids.imageA+'/content'])assert.equal((await b.request.get(origin+path)).status(),404);
  const plan=(title:string,quantity:string|null)=>({title,description:'Syntetická pilotní data, nikoli skutečná výroba.',steps:[{id:randomUUID(),text:'Kontrolní krok'}],materials:[{id:randomUUID(),specification:'Ag',type:'metal',unit:'g',quantity}],attachments:[]});
  if(!state.schoolPlan){state.schoolPlan=plan('Pilotní školní výrobek',null);state.ownPlan=plan('Pilotní vlastní výrobek','5');await save();}
  phase='school-flow';
  await request(a,'/api/procedures','POST',{id:ids.procedure,plan:state.schoolPlan});
  const pattern=await request<{revision_counter:number}>(a,'/api/procedures/'+ids.procedure);
  let schoolResponse=await a.request.get(origin+'/api/products/'+ids.school);
  if(schoolResponse.status()===404){await request(a,'/api/products','POST',{id:ids.school,source:'school',procedureId:ids.procedure,procedureRevision:pattern.revision_counter,plan:state.schoolPlan});schoolResponse=await a.request.get(origin+'/api/products/'+ids.school);}
  let school=await schoolResponse.json() as ProductDetail;
  if(school.product.status==='planned')await request(a,`/api/products/${ids.school}/actions/start`,'POST',{requestKey:ids.startSchool,version:school.product.row_version,expectedProcedureRevision:pattern.revision_counter});
  school=await request<ProductDetail>(a,'/api/products/'+ids.school);
  if(!school.steps[0].is_completed)await request(a,`/api/products/${ids.school}/actions/step`,'POST',{stepId:school.steps[0].id,completed:true,version:school.steps[0].row_version});
  await request(a,`/api/products/${ids.school}/actions/journal`,'POST',{id:ids.journal,occurredAt:state.date,body:body(ids.imageA)});
  await request(a,`/api/products/${ids.school}/actions/photo`,'POST',{assetId:ids.imageA,role:'progress',present:true});
  school=await request<ProductDetail>(a,'/api/products/'+ids.school);
  if(school.product.status!=='done')await request(a,`/api/products/${ids.school}/actions/complete`,'POST',{requestKey:ids.doneSchool,version:school.product.row_version,schoolCost:null,actual:school.materials.map(m=>({id:m.id,quantity:null,confirmed:false})),additional:[]});
  school=await request<ProductDetail>(a,'/api/products/'+ids.school);assert.equal(school.product.school_cost,null);assert.equal(school.product.status,'done');
  phase='own-flow';
  await request(a,'/api/profile','PATCH',{displayName:'Syntetický pilotní test A',hasWorkshop:true});
  await request(a,'/api/inventory/item','POST',{id:ids.item,name:'Pilotní Ag — testovací zásoba',type:'metal'});
  await request(a,'/api/inventory/purchase','POST',{requestKey:ids.purchase,businessDate:state.date,supplier:'Syntetický test — nikoli skutečný nákup',lines:[{itemId:ids.item,quantity:'10',totalCost:'300'}],attachments:[ids.pdf]});
  let ownResponse=await a.request.get(origin+'/api/products/'+ids.own);
  if(ownResponse.status()===404){await request(a,'/api/products','POST',{id:ids.own,source:'own',procedureId:null,procedureRevision:null,plan:state.ownPlan});ownResponse=await a.request.get(origin+'/api/products/'+ids.own);}
  let own=await ownResponse.json() as ProductDetail;
  if(own.product.status==='planned')await request(a,`/api/products/${ids.own}/actions/start`,'POST',{requestKey:ids.startOwn,version:own.product.row_version,reservations:own.materials.map(m=>({materialId:m.id,itemId:ids.item,quantity:'5',reserveEnabled:true,confirmed:true,cardVersion:1}))});
  own=await request<ProductDetail>(a,'/api/products/'+ids.own);
  if(own.product.status!=='done')await request(a,`/api/products/${ids.own}/actions/complete`,'POST',{requestKey:ids.doneOwn,version:own.product.row_version,expectedRevision:0,reason:'Autorizovaná technická kontrola pilotu',lines:own.materials.map(m=>({materialId:m.id,itemId:ids.item,cardVersion:1,taken:'5',inProduct:'4',returned:'0.5',scrap:'0.5',lost:'0',confirmed:true}))});
  own=await request<ProductDetail>(a,'/api/products/'+ids.own);assert.equal(own.product.material_cost,'120.000000');
  const cards=await request<{id:string;free_quantity:string}[]>(a,'/api/inventory/cards');assert.equal(cards.find(card=>card.id===ids.item)?.free_quantity,'5.500');
  assert.deepEqual((await request<{issues:unknown[]}>(a,'/api/inventory/reconcile')).issues,[]);
  phase='export-and-render';
  const exported=await a.request.get(origin+'/api/export');assert.equal(exported.status(),200);assert(exported.headers()['cache-control'].includes('no-store'));
  const archive=await unpack(await exported.body()),manifest=JSON.parse(archive.get('manifest.json')!.toString()),data=JSON.parse(archive.get('data.json')!.toString());
  assert.equal(manifest.complete,true);assert.equal(data.ownerId,users[0].id);assert(!JSON.stringify(data).includes(users[1].id!));
  const page=await a.newPage();
  for(const width of [1440,375]){await page.setViewportSize({width,height:900});await page.goto(origin+'/documents/'+ids.noteA);await page.waitForFunction(()=>Array.from(document.images).some(img=>img.complete&&img.naturalWidth>0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  phase='restart-persistence';
  await api('heroku',`/apps/${target.appId}/dynos`,'DELETE');
  let ready=false;for(let i=0;i<24;i++){try{if((await a.request.get(origin+'/api/documents/'+ids.noteA,{timeout:3000})).ok()){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert(ready);
  assert.equal((await a.request.get(origin+'/api/assets/'+ids.imageA+'/content')).status(),200);
  phase='refresh-reset-deactivation';
  const sdk=createClient(c.authUrl,c.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});assert(!(await sdk.auth.signInWithPassword({email:users[0].email,password:users[0].password})).error);assert(!(await sdk.auth.refreshSession()).error);await sdk.auth.signOut({scope:'local'});
  const temporary=randomBytes(24).toString('base64url');users[0].temporaryPassword=temporary;await save();await runOperation(ops,{kind:'reset',key:randomUUID(),targetId:users[0].id,reference:'Pilotní ověření resetu staré relace',password:temporary});assert([401,403].includes((await a.request.get(origin+'/api/profile')).status()));
  for(const user of users)await runOperation(ops,{kind:'deactivate',key:randomUUID(),targetId:user.id,reference:'Ukončení autorizovaného syntetického testu'});
  assert([401,403].includes((await b.request.get(origin+'/api/profile')).status()));
  await writeFile('.cloud/smoke-result.json',JSON.stringify({status:'passed',at:new Date().toISOString(),accounts:users.map(u=>u.id),ids,checks:['auth-and-forced-password','secure-cookies','signup-disabled','private-files','school-null-cost','own-120CZK-5.5g','AB-isolation','export-complete','desktop-and-375','restart-persistence','refresh','reset-old-session','deactivation'],retained:'Syntetické záznamy a ledger zachovány; oba účty deaktivované.'},null,2),{mode:0o600});
  console.log('Cloud smoke prošel: skutečný Auth, školní i vlastní cyklus, 120 Kč / 5,5 g, soubory/export, A/B, desktop/375 a restart. Oba syntetické účty deaktivované; ledger se nemazal.');
 }finally{for(const context of contexts)await context.close();await browser.close();await c.migration.end();await c.runtime?.end();}
}
void main().catch(error=>{const code=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:error instanceof Error?error.name:'UNKNOWN';console.error('Cloud smoke nedokončen, fáze:',phase,'kód:',code,'operace:',lastRoute,'— zachovejte soukromý .cloud/smoke-secrets.json pro řízené pokračování; nemazat ledger ani resetovat databázi.');process.exitCode=1;});
