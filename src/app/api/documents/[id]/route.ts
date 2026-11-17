import { z } from 'zod';
import { documentDeps,documentFailure } from '@/server/documents';
import { assertOrigin,json,readJson } from '@/server/http';
import { getDocument,deleteDocument } from '@/modules/documents/service';
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,c:Context){try{return json(await getDocument(await documentDeps(),(await c.params).id));}catch(e){return documentFailure(e);}}
export async function DELETE(r:Request,c:Context){try{assertOrigin(r);const v=z.object({version:z.number()}).strict().parse(await readJson(r));await deleteDocument(await documentDeps(),(await c.params).id,v.version);return json({ok:true});}catch(e){return documentFailure(e);}}
