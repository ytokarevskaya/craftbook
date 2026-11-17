import { z } from 'zod';
import { workDeps,workFailure } from '@/server/workshop';
import { assertOrigin,json,readJson } from '@/server/http';
import { deleteJournal } from '@/modules/workshop/service';
export async function DELETE(r:Request,c:{params:Promise<{id:string;entryId:string}>}){try{assertOrigin(r);const {id,entryId}=await c.params,v=z.object({version:z.number()}).strict().parse(await readJson(r));const d=await workDeps();await deleteJournal(d,id,entryId,v.version);return json({ok:true});}catch(e){return workFailure(e);}}
