import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { AccessError } from '../identity/errors';
import { withAccount } from '../identity/service';
import { type DocumentDeps, getDocument } from '../documents/service';
import { uuid } from '../documents/content';
import { FileError } from './config';
import { fileDeclaration,validateFile } from './validate';
import type { PrivateStorage } from './storage';
export type FileDeps=DocumentDeps&{storage:PrivateStorage};
export type AssetRecord={id:string;owner_id:string;storage_key:string;original_name:string;mime:string;bytes:number;state:string;checksum:string|null;upload_expires_at:string};
export async function getAsset(d:DocumentDeps,id:string){uuid.parse(id);return withAccount(d.db,d.identity,async tx=>{
 const row=(await tx.execute<AssetRecord>(sql`select * from app.asset where id=${id} and owner_id=${d.identity.userId}`)).rows[0];if(!row)throw new FileError('NOT_FOUND',404);return row;});}
export async function prepareUpload(d:FileDeps,raw:unknown){
 const v=z.object({name:z.string(),mime:z.string(),bytes:z.number(),documentId:uuid.optional(),workshopOnly:z.boolean().default(false)}).strict().parse(raw);fileDeclaration(v.name,v.mime,v.bytes);
 if(v.documentId)await getDocument(d,v.documentId);
 const id=randomUUID(),key=`${d.identity.userId}/${id}/original`;
 await withAccount(d.db,d.identity,async (tx,profile)=>{if(v.workshopOnly&&!profile.hasWorkshop)throw new AccessError('FORBIDDEN');await tx.execute(sql`insert into app.asset(id,owner_id,storage_key,original_name,mime,bytes,upload_expires_at,workshop_only) values(${id},${d.identity.userId},${key},${v.name},${v.mime},${v.bytes},clock_timestamp()+interval '2 hours 5 minutes',${v.workshopOnly})`);});
 const permission=await d.storage.uploadPermission(key);return {id,key,token:permission.token,url:permission.signedUrl};
}
export async function finalizeUpload(d:FileDeps,id:string){
 const a=await getAsset(d,id);if(a.state==='ready')return {id:a.id};if(a.state!=='pending')throw new FileError('ASSET_UNAVAILABLE',409);
 const buffer=await d.storage.bytes(a.storage_key,a.bytes);const checksum=await validateFile(buffer,a.original_name,a.mime,a.bytes);
 return withAccount(d.db,d.identity,async tx=>{
  const current=(await tx.execute<AssetRecord>(sql`select * from app.asset where id=${id} and owner_id=${d.identity.userId} for update`)).rows[0];
  if(!current||current.state==='deleting')throw new FileError('ASSET_UNAVAILABLE',409);
  if(current.state==='pending')await tx.execute(sql`update app.asset set state='ready',checksum=${checksum},updated_at=clock_timestamp(),unlinked_at=clock_timestamp() where id=${id}`);
  return {id};
 });
}
export async function readAsset(d:FileDeps,id:string){const a=await getAsset(d,id);if(a.state!=='ready')throw new FileError('ASSET_UNAVAILABLE',409);const bytes=await d.storage.bytes(a.storage_key,a.bytes);const current=await getAsset(d,id);if(current.state!=='ready')throw new FileError('ASSET_UNAVAILABLE',409);return {asset:a,bytes};}
