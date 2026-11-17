import 'server-only';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { withAccount,type VerifiedIdentity } from '../identity/service';
import { titleInput,uuid,validateBody,type NoteBody } from './content';
import { fileLimits } from '../files/config';
export class DocumentError extends Error{constructor(public code:string,public status=400){super(code);}}
export type DocumentRecord={id:string;title:string;kind:'note'|'file';body_json:NoteBody|null;row_version:number;updated_at:string;asset_id?:string;original_name?:string;mime?:string;bytes?:number};
export type DocumentDeps={db:NodePgDatabase;identity:VerifiedIdentity};
export async function listDocuments(d:DocumentDeps,query='',page=1,size=20){
 const q=z.string().max(180).parse(query).replace(/[\\%_]/g,'\\$&');z.number().int().min(1).max(10000).parse(page);z.number().int().min(1).max(20).parse(size);
 return withAccount(d.db,d.identity,async tx=>{const filter=sql`owner_id=${d.identity.userId} and title ilike ${'%'+q+'%'}`;
 const count=await tx.execute<{count:number}>(sql`select count(*)::int as count from app.document where ${filter}`);
 const rows=await tx.execute<DocumentRecord>(sql`select id,title,kind,row_version,updated_at from app.document where ${filter} order by updated_at desc,id desc limit ${size} offset ${(page-1)*size}`);
 return {items:rows.rows,total:count.rows[0].count,page};});
}
export async function getDocument(d:DocumentDeps,id:string){uuid.parse(id);return withAccount(d.db,d.identity,async tx=>{
 const r=await tx.execute<DocumentRecord>(sql`select d.*,l.asset_id,a.original_name,a.mime,a.bytes from app.document d left join app.asset_link l on l.document_id=d.id and l.role='main' left join app.asset a on a.id=l.asset_id where d.id=${id} and d.owner_id=${d.identity.userId}`);
 const row=r.rows[0];if(!row)throw new DocumentError('NOT_FOUND',404);if(row.kind==='note')validateBody(row.body_json,fileLimits().contentBytes);return row;});}
const input=z.object({id:uuid,title:titleInput,kind:z.enum(['note','file']),body:z.unknown().optional(),assetId:uuid.optional(),version:z.number().int().positive().optional()}).strict();
export async function saveDocument(d:DocumentDeps,raw:unknown){
 const v=input.parse(raw);let body:NoteBody|null=null,images:string[]=[];
 if(v.kind==='note'){if(v.assetId)throw new DocumentError('INVALID_CONTENT');try{const result=validateBody(v.body,fileLimits().contentBytes);body=result.body;images=result.assets;}catch{throw new DocumentError('INVALID_CONTENT');}}
 else if(!v.assetId||v.body!==undefined)throw new DocumentError('INVALID_CONTENT');
 const hash=createHash('sha256').update(JSON.stringify([v.title,v.kind,body,v.assetId])).digest('hex');
 return withAccount(d.db,d.identity,async tx=>{
  // Serialize creates with the same id as well as updates; no network inside.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`document:${v.id}`},0))`);
  const old=(await tx.execute<{row_version:number;creation_hash:string;kind:string}>(sql`select row_version,creation_hash,kind from app.document where id=${v.id} and owner_id=${d.identity.userId} for update`)).rows[0];
  if(old&&!v.version){if(old.creation_hash===hash)return {id:v.id,version:old.row_version};throw new DocumentError('CONFLICT',409);}
  if(v.version&&(!old||old.row_version!==v.version||old.kind!==v.kind))throw new DocumentError('CONFLICT',409);
  const ids=[...new Set(v.kind==='file'?[v.assetId!]:images)].sort();
  for(const id of ids){const a=(await tx.execute<{state:string;mime:string}>(sql`select state,mime from app.asset where id=${id} and owner_id=${d.identity.userId} for update`)).rows[0];if(!a||a.state!=='ready'||(v.kind==='file')===a.mime.startsWith('image/'))throw new DocumentError('ASSET_UNAVAILABLE');}
  if(old){await tx.execute(sql`update app.document set title=${v.title},body_json=${body===null?null:JSON.stringify(body)}::jsonb,row_version=row_version+1,updated_at=clock_timestamp() where id=${v.id} and owner_id=${d.identity.userId}`);
   await tx.execute(sql`update app.asset set unlinked_at=clock_timestamp() where id in(select asset_id from app.asset_link where document_id=${v.id})`);
   await tx.execute(sql`delete from app.asset_link where document_id=${v.id}`);
  }else await tx.execute(sql`insert into app.document(id,owner_id,title,kind,body_json,creation_hash) values(${v.id},${d.identity.userId},${v.title},${v.kind},${body===null?null:JSON.stringify(body)}::jsonb,${hash})`);
  for(const [position,id] of ids.entries())await tx.execute(sql`insert into app.asset_link(owner_id,document_id,asset_id,role,position) values(${d.identity.userId},${v.id},${id},${v.kind==='file'?'main':'image'},${position})`);
  return {id:v.id,version:(old?.row_version??0)+1};
 });
}
export async function deleteDocument(d:DocumentDeps,id:string,version:number){uuid.parse(id);z.number().int().positive().parse(version);return withAccount(d.db,d.identity,async tx=>{
 const old=(await tx.execute<{row_version:number}>(sql`select row_version from app.document where id=${id} and owner_id=${d.identity.userId} for update`)).rows[0];if(!old)return;if(old.row_version!==version)throw new DocumentError('CONFLICT',409);
 await tx.execute(sql`update app.asset set unlinked_at=clock_timestamp() where id in(select asset_id from app.asset_link where document_id=${id})`);
 await tx.execute(sql`delete from app.document where id=${id} and owner_id=${d.identity.userId}`);
 });}
