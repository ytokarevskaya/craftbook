import 'server-only';
import { createHash,randomUUID } from 'node:crypto';
import { sql,type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { settleOwn,settlementHistoryTx } from '../inventory/settlements';
import { requireWorkshopTx,operationTx } from '../inventory/service';
import { applyReservations } from '../inventory/reservations';
import { withAccount } from '../identity/service';
import type { DocumentDeps } from '../documents/service';
import { uuid,validateBody,type NoteBody } from '../documents/content';
import { fileLimits } from '../files/config';
import { procedureInput,productInput,commandInput,planInput,actualInput,materialInput,money,progress,type Plan } from './input';
export type WorkDeps=DocumentDeps;
type Tx=Parameters<Parameters<typeof withAccount>[2]>[0];
export class WorkError extends Error{constructor(public code:string,public status=400){super(code);}}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const notFound=()=>new WorkError('NOT_FOUND',404);
const conflict=()=>new WorkError('CONFLICT',409);
async function query<T extends Record<string,unknown>>(tx:Tx,statement:SQL){return (await tx.execute<T>(statement)).rows;}
export type Attachment={asset_id:string;original_name:string;mime:string;role:string};
export type Procedure={id:string;title:string;description:string;revision_counter:number;archived_at:string|null;creation_hash:string;plan:Plan;attachments:Attachment[]};
export type Step={id:string;text:string;position:number;is_completed:boolean;completed_at:string|null;row_version:number};
export type Material={id:string;specification:string;type:'metal'|'stone'|'component';unit:'g'|'ks';planned_quantity:string|null;actual_quantity:string|null;actual_confirmed:boolean;position:number;requirements_json:Record<string,string>;inventory_item_id:string|null;reserve_enabled:boolean;card_snapshot:Record<string,string>|null};
export type Product={id:string;title:string;description:string;source:'school'|'own';status:'planned'|'in_progress'|'done';created_without_procedure:boolean;procedure_id:string|null;procedure_revision:number|null;saved_procedure_id:string|null;row_version:number;school_cost:string|null;started_at:string|null;completed_at:string|null;creation_hash:string;start_key:string|null;start_hash:string|null;complete_key:string|null;complete_hash:string|null;saved_procedure_key:string|null;saved_procedure_hash:string|null;current_settlement_id:string|null;material_cost:string|null;known_material_cost:string|null;cost_status:string|null;archived_at:string|null};
export type Snapshot={id:string;content_json:Plan;source_id:string|null;source_revision:number|null};
export type Journal={id:string;product_id:string;occurred_at:string;body_json:NoteBody;row_version:number;creation_hash:string};
async function lockAssets(tx:Tx,ids:string[],imageOnly=false){for(const id of [...new Set(ids)].sort()){
 const [a]=await query<{state:string;mime:string}>(tx,sql`select state,mime from app.asset where id=${id} for update`);if(!a||a.state!=='ready'||(imageOnly&&!a.mime.startsWith('image/')))throw new WorkError('ASSET_UNAVAILABLE');
}}
async function links(tx:Tx,target:'procedure_id'|'product_id'|'journal_entry_id'|'snapshot_id',id:string){return query<Attachment>(tx,sql`select l.asset_id,l.role,a.original_name,a.mime from app.asset_link l join app.asset a on a.id=l.asset_id where ${sql`l.${sql.identifier(target)}`}=${id} order by l.position,l.asset_id`);}
async function replaceLinks(tx:Tx,owner:string,target:'procedure_id'|'product_id'|'journal_entry_id',id:string,ids:string[],role:string){
 await lockAssets(tx,ids,role==='image');
 await tx.execute(sql`update app.asset set unlinked_at=clock_timestamp() where id in(select asset_id from app.asset_link where ${sql.identifier(target)}=${id} and role=${role})`);
 await tx.execute(sql`delete from app.asset_link where ${sql.identifier(target)}=${id} and role=${role}`);
 for(const [position,asset] of ids.entries())await tx.execute(sql`insert into app.asset_link(owner_id,${sql.identifier(target)},asset_id,role,position) values(${owner},${id},${asset},${role},${position})`);
}
async function procedureTx(tx:Tx,id:string,lock=false):Promise<Procedure>{
 const [p]=await query<Omit<Procedure,'plan'|'attachments'>>(tx,sql`select * from app.procedure where id=${id} ${lock?sql`for update`:sql``}`);if(!p)throw notFound();
 const steps=await query<{id:string;text:string}>(tx,sql`select id,text from app.procedure_step where procedure_id=${id} order by position`);
 const materials=await query<Plan['materials'][number]>(tx,sql`select id,specification,type,unit,quantity,requirements_json as requirements from app.procedure_material where procedure_id=${id} order by position`);
 const attachments=await links(tx,'procedure_id',id);return {...p,attachments,plan:{title:p.title,description:p.description,steps,materials,attachments:attachments.map(a=>a.asset_id)}};
}
async function writeProcedure(tx:Tx,owner:string,id:string,plan:Plan,creationHash:string,existing=false){
 if(existing){await tx.execute(sql`update app.procedure set title=${plan.title},description=${plan.description},revision_counter=revision_counter+1,updated_at=clock_timestamp() where id=${id}`);await tx.execute(sql`delete from app.procedure_step where procedure_id=${id}`);await tx.execute(sql`delete from app.procedure_material where procedure_id=${id}`);}
 else await tx.execute(sql`insert into app.procedure(id,owner_id,title,description,creation_hash) values(${id},${owner},${plan.title},${plan.description},${creationHash})`);
 for(const [position,s] of plan.steps.entries())await tx.execute(sql`insert into app.procedure_step(id,owner_id,procedure_id,position,text) values(${randomUUID()},${owner},${id},${position},${s.text})`);
 for(const [position,m] of plan.materials.entries())await tx.execute(sql`insert into app.procedure_material(id,owner_id,procedure_id,position,specification,type,unit,quantity,requirements_json) values(${randomUUID()},${owner},${id},${position},${m.specification},${m.type},${m.unit},${m.quantity},${JSON.stringify(m.requirements??{})}::jsonb)`);
 await replaceLinks(tx,owner,'procedure_id',id,plan.attachments,'attachment');
}
export async function saveProcedure(d:WorkDeps,raw:unknown){const v=procedureInput.parse(raw),digest=hash(v.plan);return withAccount(d.db,d.identity,async tx=>{
 await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`procedure:${v.id}`},0))`);
 const [old]=await query<{revision_counter:number;creation_hash:string;archived_at:string|null}>(tx,sql`select * from app.procedure where id=${v.id} for update`);
 if(old&&!v.version){if(old.creation_hash===digest)return {id:v.id};throw conflict();}
 if(v.version&&(!old||old.revision_counter!==v.version))throw conflict();if(old?.archived_at)throw new WorkError('ARCHIVED',409);
 await writeProcedure(tx,d.identity.userId,v.id,v.plan,digest,!!old);return {id:v.id};});}
export async function getProcedure(d:WorkDeps,id:string){uuid.parse(id);return withAccount(d.db,d.identity,tx=>procedureTx(tx,id));}
export async function archiveProcedure(d:WorkDeps,id:string,version:number){uuid.parse(id);z.number().int().positive().parse(version);return withAccount(d.db,d.identity,async tx=>{const p=await procedureTx(tx,id,true);if(p.archived_at)return;if(p.revision_counter!==version)throw conflict();await tx.execute(sql`update app.procedure set archived_at=clock_timestamp(),revision_counter=revision_counter+1,updated_at=clock_timestamp() where id=${id}`);});}
export async function listWork(d:WorkDeps,kind:'procedure'|'product',q='',page=1,status='',includeArchived=false){
 z.string().max(180).parse(q);z.number().int().min(1).max(10000).parse(page);if(status&&!['planned','in_progress','done'].includes(status))throw new WorkError('VALIDATION');
 return withAccount(d.db,d.identity,async tx=>{const table=sql`app.${sql.identifier(kind)}`;const search='%'+q.replace(/[\\%_]/g,'\\$&')+'%';const where=sql`owner_id=${d.identity.userId} and title ilike ${search} ${kind==='procedure'?sql`and archived_at is null`:status?sql`and status=${status}`:sql``} ${kind==='product'&&!includeArchived?sql`and archived_at is null`:sql``}`;
 const [count]=await query<{count:number}>(tx,sql`select count(*)::int as count from ${table} where ${where}`);
 const items=await query<{id:string;title:string;updated_at:string;status?:Product['status'];archived_at?:string|null}>(tx,sql`select id,title,updated_at ${kind==='product'?sql`,status,archived_at`:sql``} from ${table} where ${where} order by updated_at desc,id desc limit 20 offset ${(page-1)*20}`);return {items,total:count.count,page};});}
async function productTx(tx:Tx,id:string,lock=false){const [p]=await query<Product>(tx,sql`select * from app.product where id=${id} ${lock?sql`for update`:sql``}`);if(!p)throw notFound();return p;}
async function productParts(tx:Tx,id:string){const steps=await query<Step>(tx,sql`select * from app.product_step where product_id=${id} order by position`),materials=await query<Material>(tx,sql`select * from app.product_material where product_id=${id} order by position`);return {steps,materials};}
export async function getProduct(d:WorkDeps,id:string){uuid.parse(id);return withAccount(d.db,d.identity,async tx=>{
 const product=await productTx(tx,id),parts=await productParts(tx,id),[snapshot]=await query<Snapshot>(tx,sql`select * from app.product_procedure_snapshot where product_id=${id}`);
 const procedure=product.procedure_id?await procedureTx(tx,product.procedure_id):null;
 const journal=await query<Journal>(tx,sql`select *,occurred_at::text from app.journal_entry where product_id=${id} order by app.journal_entry.occurred_at,created_at,id`);for(const j of journal)validateBody(j.body_json,fileLimits().contentBytes);
 return {product,...parts,settlements:product.source==='own'?await settlementHistoryTx(tx,id):[],snapshot:snapshot??null,procedure,journal,attachments:await links(tx,'product_id',id),progress:progress(parts.steps)};});}
export type ProductDetail=Awaited<ReturnType<typeof getProduct>>;
export function productPlan(detail:ProductDetail):Plan{return {title:detail.product.title,description:detail.product.description,steps:detail.steps.map(s=>({id:s.id,text:s.text})),materials:detail.materials.map(m=>({id:m.id,specification:m.specification,type:m.type,unit:m.unit,quantity:m.planned_quantity,requirements:m.requirements_json})),attachments:detail.attachments.filter(a=>a.role==='attachment').map(a=>a.asset_id)};}
async function writeWorkingPlan(tx:Tx,owner:string,id:string,plan:Plan,existing:boolean){
 const previous=existing?await productParts(tx,id):{steps:[],materials:[]};
 await tx.execute(sql`delete from app.product_step where product_id=${id}`);await tx.execute(sql`delete from app.product_material where product_id=${id}`);
 for(const [position,s] of plan.steps.entries()){const old=previous.steps.find(a=>a.id===s.id);await tx.execute(sql`insert into app.product_step(id,owner_id,product_id,position,text,is_completed,completed_at,row_version) values(${existing?s.id:randomUUID()},${owner},${id},${position},${s.text},${old?.is_completed??false},${old?.completed_at??null},${(old?.row_version??0)+1})`);}
 for(const [position,m] of plan.materials.entries()){const old=previous.materials.find(a=>a.id===m.id);if(old&&(old.type!==m.type||old.unit!==m.unit)&&old.actual_confirmed)throw new WorkError('MATERIAL_UNIT');await tx.execute(sql`insert into app.product_material(id,owner_id,product_id,position,specification,type,unit,planned_quantity,actual_quantity,actual_confirmed,requirements_json) values(${existing?m.id:randomUUID()},${owner},${id},${position},${m.specification},${m.type},${m.unit},${m.quantity},${old?.actual_quantity??null},${old?.actual_confirmed??false},${JSON.stringify(m.requirements??{})}::jsonb)`);}
 await replaceLinks(tx,owner,'product_id',id,plan.attachments,'attachment');
}
export async function saveProduct(d:WorkDeps,raw:unknown){const v=productInput.parse(raw),digest=hash(v);return withAccount(d.db,d.identity,async tx=>{
 if(v.source==='own')await requireWorkshopTx(tx,d.identity.userId);
 await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`product:${v.id}`},0))`);const [old]=await query<Product>(tx,sql`select * from app.product where id=${v.id} for update`);
 if(old&&!v.version){if(old.creation_hash===digest)return {id:v.id};throw conflict();}
 if(old){if(old.row_version!==v.version||old.procedure_id!==v.procedureId||old.source!==v.source)throw conflict();if(old.archived_at)throw new WorkError('ARCHIVED_PRODUCT',409);if(old.status==='done')throw new WorkError('DONE',409);
 await tx.execute(sql`update app.product set title=${v.plan.title},description=${v.plan.description},row_version=row_version+1,updated_at=clock_timestamp() where id=${v.id}`);
 }else{if(v.version)throw conflict();if(v.procedureId){const p=await procedureTx(tx,v.procedureId,true);if(p.archived_at)throw new WorkError('ARCHIVED',409);if(p.revision_counter!==v.procedureRevision)throw new WorkError('PROCEDURE_CHANGED',409);}else if(v.procedureRevision!==null)throw new WorkError('VALIDATION');
 await tx.execute(sql`insert into app.product(id,owner_id,title,description,source,created_without_procedure,procedure_id,procedure_revision,creation_hash) values(${v.id},${d.identity.userId},${v.plan.title},${v.plan.description},${v.source},${!v.procedureId},${v.procedureId},${v.procedureRevision},${digest})`);}
 if(old?.source==='own')await writeOwnWorkingPlan(tx,d.identity.userId,v.id,v.plan);else await writeWorkingPlan(tx,d.identity.userId,v.id,v.plan,!!old);return {id:v.id};});}
export async function startProduct(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);const v=commandInput.parse(raw);v.reservations?.sort((a,b)=>a.materialId.localeCompare(b.materialId));const digest=hash(v);return withAccount(d.db,d.identity,async tx=>{
 const info=await productTx(tx,id);if(info.source==='own')await requireWorkshopTx(tx,d.identity.userId);
 const p=await productTx(tx,id,true);
 const execute=async(op?:string)=>{if(p.start_key===v.requestKey){if(p.start_hash!==digest)throw conflict();return {id};}
 if(p.status!=='planned'||p.row_version!==v.version)throw conflict();
 const [existing]=await query<Snapshot>(tx,sql`select * from app.product_procedure_snapshot where product_id=${id}`);
 if(p.archived_at)throw new WorkError('ARCHIVED_PRODUCT',409);
 if(p.source==='own'){await applyReservations(tx,d.identity.userId,id,v.reservations??[],op!,!existing);}else if(v.reservations)throw new WorkError('STATE',409);
 if(!existing){if(p.procedure_id){const procedure=await procedureTx(tx,p.procedure_id,true);if(procedure.revision_counter!==v.expectedProcedureRevision)throw new WorkError('PROCEDURE_CHANGED',409);}
 const parts=await productParts(tx,id),attachments=(await links(tx,'product_id',id)).filter(a=>a.role==='attachment');
 const plan:Plan={title:p.title,description:p.description,steps:parts.steps.map(s=>({id:s.id,text:s.text})),materials:parts.materials.map(m=>({id:m.id,specification:m.specification,type:m.type,unit:m.unit,quantity:m.planned_quantity,requirements:m.requirements_json})),attachments:attachments.map(a=>a.asset_id)};
 const confirmedPlan={...plan,...(p.source==='own'?{inventoryMappings:(await productParts(tx,id)).materials.map(m=>({materialId:m.id,itemId:m.inventory_item_id,reserveEnabled:m.reserve_enabled,reservedQuantity:m.reserve_enabled?v.reservations?.find(t=>t.materialId===m.id)?.quantity??null:null,card:m.card_snapshot}))}:{})};
 await lockAssets(tx,plan.attachments);const snapshotId=randomUUID();await tx.execute(sql`insert into app.product_procedure_snapshot(id,owner_id,product_id,source_id,source_revision,schema_version,content_json) values(${snapshotId},${d.identity.userId},${id},${p.procedure_id},${p.procedure_id?v.expectedProcedureRevision:null},1,${JSON.stringify(confirmedPlan)}::jsonb)`);
 for(const [position,asset] of plan.attachments.entries())await tx.execute(sql`insert into app.asset_link(owner_id,snapshot_id,asset_id,role,position) values(${d.identity.userId},${snapshotId},${asset},'snapshot',${position})`);
 }
 await tx.execute(sql`update app.product set status='in_progress',started_at=coalesce(started_at,clock_timestamp()),start_key=${v.requestKey},start_hash=${digest},row_version=row_version+1,updated_at=clock_timestamp() where id=${id}`);return {id};};
 if(p.source==='own'){await operationTx(tx,d.identity.userId,'own_start',v.requestKey,{productId:id,...v},async op=>{await execute(op);},id);return {id};}return execute();});}
export async function returnToPlan(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);if((await getProduct(d,id)).product.source==='own')return settleOwn(d,id,'return',raw);const version=typeof raw==='number'?raw:z.object({version:z.number()}).strict().parse(raw).version;z.number().int().positive().parse(version);return withAccount(d.db,d.identity,async tx=>{const p=await productTx(tx,id,true);if(p.source!=='school'||p.row_version!==version||p.status!=='in_progress')throw conflict();await tx.execute(sql`update app.product set status='planned',row_version=row_version+1,updated_at=clock_timestamp() where id=${id}`);return {id};});}
export async function setStep(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);const v=z.object({stepId:uuid,completed:z.boolean(),version:z.number().int().positive()}).strict().parse(raw);return withAccount(d.db,d.identity,async tx=>{
 const p=await productTx(tx,id,true);if(p.status!=='in_progress')throw new WorkError('STATE',409);const [s]=await query<Step>(tx,sql`select * from app.product_step where id=${v.stepId} and product_id=${id} for update`);if(!s)throw notFound();if(s.is_completed===v.completed)return {id};if(s.row_version!==v.version)throw conflict();
 await tx.execute(sql`update app.product_step set is_completed=${v.completed},completed_at=case when ${v.completed} then clock_timestamp() else null end,row_version=row_version+1 where id=${v.stepId}`);await tx.execute(sql`update app.product set row_version=row_version+1,updated_at=clock_timestamp() where id=${id}`);return {id};});}
const completion=z.object({requestKey:uuid,version:z.number().int().positive(),schoolCost:money,actual:actualInput,additional:z.array(materialInput).max(200).default([])}).strict();
async function setActual(tx:Tx,id:string,actual:z.infer<typeof actualInput>){if(new Set(actual.map(m=>m.id)).size!==actual.length)throw new WorkError('VALIDATION');for(const m of actual){const [row]=await query<Material>(tx,sql`select * from app.product_material where id=${m.id} and product_id=${id}`);if(!row)throw notFound();if((!m.confirmed&&m.quantity!==null)||(row.unit==='ks'&&m.quantity?.includes('.')))throw new WorkError('VALIDATION');await tx.execute(sql`update app.product_material set actual_quantity=${m.quantity},actual_confirmed=${m.confirmed} where id=${m.id} and product_id=${id}`);}}
async function addActualMaterials(tx:Tx,id:string,additional:Plan['materials']){
 const [{count,position}]=await query<{count:number;position:number}>(tx,sql`select count(*)::int as count,coalesce(max(position),-1)::int as position from app.product_material where product_id=${id}`);
 if(count+additional.length>200||new Set(additional.map(m=>m.id)).size!==additional.length)throw new WorkError('VALIDATION');
 for(const [i,m] of additional.entries())await tx.execute(sql`insert into app.product_material(id,owner_id,product_id,position,specification,type,unit,planned_quantity,actual_quantity,actual_confirmed,requirements_json) values(${m.id},(select owner_id from app.product where id=${id}),${id},${position+i+1},${m.specification},${m.type},${m.unit},null,${m.quantity},${m.quantity!==null},'{}'::jsonb)`);
}
export async function completeProduct(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);if((await getProduct(d,id)).product.source==='own')return settleOwn(d,id,'complete',raw);const v=completion.parse(raw),digest=hash(v);return withAccount(d.db,d.identity,async tx=>{const p=await productTx(tx,id,true);if(p.complete_key===v.requestKey){if(p.complete_hash!==digest)throw conflict();return {id};}if(p.source!=='school'||p.status!=='in_progress'||p.row_version!==v.version)throw conflict();await setActual(tx,id,v.actual);await addActualMaterials(tx,id,v.additional);await tx.execute(sql`update app.product set status='done',school_cost=${v.schoolCost},completed_at=clock_timestamp(),complete_key=${v.requestKey},complete_hash=${digest},row_version=row_version+1,updated_at=clock_timestamp() where id=${id}`);return {id};});}
export async function updateActual(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);const v=completion.omit({requestKey:true}).parse(raw);return withAccount(d.db,d.identity,async tx=>{const p=await productTx(tx,id,true);if(p.source!=='school')throw new WorkError('STATE',409);if(p.row_version!==v.version)throw conflict();await setActual(tx,id,v.actual);await addActualMaterials(tx,id,v.additional);await tx.execute(sql`update app.product set school_cost=${v.schoolCost},row_version=row_version+1,updated_at=clock_timestamp() where id=${id}`);return {id};});}
export function proposal(detail:ProductDetail):Plan{const plan=productPlan(detail);return {...plan,attachments:[],materials:plan.materials.map(m=>{const actual=detail.materials.find(a=>a.id===m.id),original=detail.snapshot?.content_json.materials.find(a=>a.id===m.id);return {...m,quantity:actual?.actual_confirmed&&actual.actual_quantity!==null?actual.actual_quantity:(original?original.quantity:m.quantity)};})};}
export async function createProcedureFromProduct(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);const v=z.object({requestKey:uuid,version:z.number().int().positive(),plan:planInput}).strict().parse(raw);if(v.plan.attachments.length)throw new WorkError('VALIDATION');const digest=hash(v);return withAccount(d.db,d.identity,async tx=>{
 const p=await productTx(tx,id,true);if(!p.created_without_procedure||p.status!=='done')throw new WorkError('STATE',409);
 if(p.saved_procedure_id){if(p.saved_procedure_key!==v.requestKey||p.saved_procedure_hash!==digest)throw new WorkError('PROCEDURE_SAVED',409);return {id:p.saved_procedure_id};}
 if(p.row_version!==v.version)throw conflict();const procedureId=randomUUID();await writeProcedure(tx,d.identity.userId,procedureId,v.plan,hash(v.plan));await tx.execute(sql`update app.product set saved_procedure_id=${procedureId},saved_procedure_key=${v.requestKey},saved_procedure_hash=${digest},row_version=row_version+1 where id=${id}`);return {id:procedureId};});}
const journalInput=z.object({id:uuid,version:z.number().int().positive().optional(),occurredAt:z.iso.date(),body:z.unknown()}).strict();
export async function saveJournal(d:WorkDeps,productId:string,raw:unknown){uuid.parse(productId);const v=journalInput.parse(raw);let validated;try{validated=validateBody(v.body,fileLimits().contentBytes);}catch{throw new WorkError('INVALID_CONTENT');}const digest=hash([productId,v.occurredAt,validated.body]);return withAccount(d.db,d.identity,async tx=>{
 await productTx(tx,productId,true);const [old]=await query<Journal>(tx,sql`select * from app.journal_entry where id=${v.id} and product_id=${productId} for update`);
 if(old&&!v.version){if(old.creation_hash===digest)return {id:v.id};throw conflict();}if(v.version&&(!old||old.row_version!==v.version))throw conflict();
 if(old)await tx.execute(sql`update app.journal_entry set occurred_at=${v.occurredAt},body_json=${JSON.stringify(validated.body)}::jsonb,row_version=row_version+1,updated_at=clock_timestamp() where id=${v.id} and product_id=${productId}`);
 else await tx.execute(sql`insert into app.journal_entry(id,owner_id,product_id,occurred_at,body_json,creation_hash) values(${v.id},${d.identity.userId},${productId},${v.occurredAt},${JSON.stringify(validated.body)}::jsonb,${digest})`);
 await replaceLinks(tx,d.identity.userId,'journal_entry_id',v.id,validated.assets,'image');return {id:v.id};});}
export async function deleteJournal(d:WorkDeps,productId:string,id:string,version:number){uuid.parse(productId);uuid.parse(id);z.number().int().positive().parse(version);return withAccount(d.db,d.identity,async tx=>{await productTx(tx,productId,true);const [old]=await query<Journal>(tx,sql`select * from app.journal_entry where id=${id} and product_id=${productId} for update`);if(!old)return;if(old.row_version!==version)throw conflict();await replaceLinks(tx,d.identity.userId,'journal_entry_id',id,[],'image');await tx.execute(sql`delete from app.journal_entry where id=${id} and product_id=${productId}`);});}
export async function setPhoto(d:WorkDeps,productId:string,raw:unknown){uuid.parse(productId);const v=z.object({assetId:uuid,role:z.enum(['progress','finished']),present:z.boolean()}).strict().parse(raw);return withAccount(d.db,d.identity,async tx=>{await productTx(tx,productId,true);await lockAssets(tx,[v.assetId],true);
 if(v.present)await tx.execute(sql`insert into app.asset_link(owner_id,product_id,asset_id,role,position) values(${d.identity.userId},${productId},${v.assetId},${v.role},0) on conflict do nothing`);
 else{await tx.execute(sql`update app.asset set unlinked_at=clock_timestamp() where id=${v.assetId}`);await tx.execute(sql`delete from app.asset_link where product_id=${productId} and asset_id=${v.assetId} and role=${v.role}`);}return {id:productId};});}

async function writeOwnWorkingPlan(tx:Tx,owner:string,id:string,plan:Plan){
 const previous=await productParts(tx,id);for(const m of previous.materials){const next=plan.materials.find(n=>n.id===m.id);if(!next){const [used]=await query<{used:boolean}>(tx,sql`select exists(select 1 from app.reservation where product_material_id=${m.id}) or exists(select 1 from app.settlement_line where product_material_id=${m.id}) as used`);if(used.used)throw new WorkError('MATERIAL_HISTORY',409);}else if(m.inventory_item_id&&(next.type!==m.type||next.unit!==m.unit||(['alloy','fineness','form','profile','dimensions'] as const).some(k=>next.requirements?.[k]!==m.requirements_json[k])))throw new WorkError('MATERIAL_UNIT',409);}
 await tx.execute(sql`delete from app.product_step where product_id=${id}`);for(const [position,s] of plan.steps.entries()){const old=previous.steps.find(p=>p.id===s.id);await tx.execute(sql`insert into app.product_step(id,owner_id,product_id,position,text,is_completed,completed_at,row_version) values(${s.id},${owner},${id},${position},${s.text},${old?.is_completed??false},${old?.completed_at??null},${(old?.row_version??0)+1})`);}
 await tx.execute(sql`update app.product_material set position=position+1000 where product_id=${id}`);
 for(const old of previous.materials)if(!plan.materials.some(m=>m.id===old.id))await tx.execute(sql`delete from app.product_material where id=${old.id} and product_id=${id}`);
 for(const [position,m] of plan.materials.entries()){if(previous.materials.some(p=>p.id===m.id))await tx.execute(sql`update app.product_material set position=${position},specification=${m.specification},type=${m.type},unit=${m.unit},planned_quantity=${m.quantity},requirements_json=${JSON.stringify(m.requirements??{})}::jsonb where id=${m.id} and product_id=${id}`);else await tx.execute(sql`insert into app.product_material(id,owner_id,product_id,position,specification,type,unit,planned_quantity,requirements_json) values(${m.id},${owner},${id},${position},${m.specification},${m.type},${m.unit},${m.quantity},${JSON.stringify(m.requirements??{})}::jsonb)`);}
 await replaceLinks(tx,owner,'product_id',id,plan.attachments,'attachment');
}
export async function archiveProduct(d:WorkDeps,id:string,raw:unknown){uuid.parse(id);const v=z.object({version:z.number().int().positive(),archived:z.boolean()}).strict().parse(raw);return withAccount(d.db,d.identity,async tx=>{const info=await productTx(tx,id);if(info.source==='own')await requireWorkshopTx(tx,d.identity.userId);const p=await productTx(tx,id,true);if(p.row_version!==v.version)throw conflict();await tx.execute(sql`update app.product set archived_at=${v.archived?sql`clock_timestamp()`:sql`null`},row_version=row_version+1,updated_at=clock_timestamp() where id=${id}`);return {id};});}
