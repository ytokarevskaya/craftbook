import 'server-only';
import type { Pool } from 'pg';
import type { PrivateStorage } from './storage';
import { fileLimits } from './config';
// Ops only: callers must validate local targets before constructing the pool.
export async function cleanupAssets(pool:Pool,storage:PrivateStorage,apply=false,batch=50,ownerId?:string){
 if(!Number.isInteger(batch)||batch<1||batch>100)throw new Error('BATCH');
 const rows=(await pool.query<{id:string;storage_key:string}>(`select id,storage_key from app.asset a where
 ($3::uuid is null or owner_id=$3) and upload_expires_at<now()-interval '5 minutes' and unlinked_at<now()-($1*interval '1 hour')
 and not exists(select 1 from app.asset_link l where l.asset_id=a.id)
 order by unlinked_at,id limit $2`,[fileLimits().graceHours,batch,ownerId??null])).rows;
 const result={candidates:rows.length,deleted:0,failed:0};if(!apply)return result;
 for(const row of rows){
  const client=await pool.connect();let marked=false;
  try{await client.query('BEGIN');const a=(await client.query(`select id from app.asset where id=$1 and upload_expires_at<now()-interval '5 minutes' and unlinked_at<now()-($2*interval '1 hour') for update`,[row.id,fileLimits().graceHours])).rows[0];
   if(a&&!(await client.query('select 1 from app.asset_link where asset_id=$1',[row.id])).rowCount){await client.query("update app.asset set state='deleting',updated_at=now() where id=$1",[row.id]);marked=true;}await client.query('COMMIT');
  }catch{await client.query('ROLLBACK');result.failed++;}finally{client.release();}
  if(!marked)continue;
  try{await storage.remove(row.storage_key);await pool.query("delete from app.asset where id=$1 and state='deleting' and not exists(select 1 from app.asset_link where asset_id=$1)",[row.id]);result.deleted++;}catch{result.failed++;}
 }
 return result;
}
