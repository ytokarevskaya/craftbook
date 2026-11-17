import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BUCKET, FileError, fileLimits } from './config';
export class PrivateStorage {
 constructor(private client:SupabaseClient){}
 async uploadPermission(key:string){const r=await this.client.storage.from(BUCKET).createSignedUploadUrl(key,{upsert:false});if(r.error)throw new FileError('STORAGE_FAILED',503);return r.data;}
 async signedDownload(key:string,ttl=fileLimits().downloadTtl){const r=await this.client.storage.from(BUCKET).createSignedUrl(key,ttl);if(r.error)throw new FileError('STORAGE_FAILED',503);return r.data.signedUrl;}
 async bytes(key:string,max:number){
  const url=await this.signedDownload(key);const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok||!r.body)throw new FileError('UPLOAD_MISSING',409);
  if(Number(r.headers.get('content-length')??0)>max)throw new FileError('FILE_LIMIT',413);
  const reader=r.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new FileError('FILE_LIMIT',413);chunks.push(value);}}finally{await reader.cancel();}
  return Buffer.concat(chunks);
 }
 async remove(key:string){const r=await this.client.storage.from(BUCKET).remove([key]);if(r.error)throw new FileError('STORAGE_FAILED',503);}
}
export function privateStorage(){const key=process.env.STORAGE_SECRET_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!key||!url)throw new FileError('STORAGE_CONFIG',503);return new PrivateStorage(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));}
