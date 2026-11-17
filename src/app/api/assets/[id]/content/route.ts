import { fileDeps,documentFailure } from '@/server/documents';
import { readAsset } from '@/modules/files/service';
export async function GET(_:Request,c:{params:Promise<{id:string}>}){try{
 const {asset,bytes}=await readAsset(await fileDeps(),(await c.params).id);
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':asset.mime,'Content-Length':String(bytes.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`${asset.mime.startsWith('image/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(asset.original_name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`}});
}catch(e){return documentFailure(e);}}
