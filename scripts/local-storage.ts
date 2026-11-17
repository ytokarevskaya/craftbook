import { appendFileSync,readFileSync } from 'node:fs';
import { localConnections } from './local-common';
async function main(){
const c=localConnections();
try{
 const id='craftbook-private';const found=await c.admin.storage.getBucket(id);
 const options={public:false,fileSizeLimit:10485760,allowedMimeTypes:['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown']};
 const result=found.data?await c.admin.storage.updateBucket(id,options):await c.admin.storage.createBucket(id,options);
 if(result.error)throw new Error('STORAGE_SETUP');
 // Deny every direct anon/JWT operation even if a future permissive policy is added.
 await c.migration.query(`do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='craftbook_private_deny') then
 create policy craftbook_private_deny on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'craftbook-private') with check(bucket_id<>'craftbook-private'); end if; end $$`);
 const env=readFileSync('.env.local','utf8');
 if(!/^STORAGE_SECRET_KEY=/m.test(env))appendFileSync('.env.local',`\n# Server-only Storage adapter, never browser/Auth administration.\nSTORAGE_SECRET_KEY=${process.env.SUPABASE_SECRET_KEY}\n`,{mode:0o600});
 console.log('Lokální soukromý bucket, ochranná politika a serverová konfigurace připraveny. Tajné hodnoty nebyly vypsány.');
}catch{console.error('Příprava Storage selhala. Ověřte lokální stack a konfiguraci.');process.exitCode=1;}finally{await c.migration.end();await c.runtime.end();}

}
void main().catch(()=>{console.error("Lokální operace selhala. Ověřte konfiguraci.");process.exitCode=1;});
