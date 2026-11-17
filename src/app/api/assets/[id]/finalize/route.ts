import { fileDeps,documentFailure } from '@/server/documents';
import { assertOrigin,json } from '@/server/http';
import { finalizeUpload } from '@/modules/files/service';
export async function POST(r:Request,c:{params:Promise<{id:string}>}){try{assertOrigin(r);return json(await finalizeUpload(await fileDeps(),(await c.params).id));}catch(e){return documentFailure(e);}}
