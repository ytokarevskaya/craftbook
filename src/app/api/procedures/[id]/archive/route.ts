import { z } from 'zod';
import { workDeps,workFailure } from '@/server/workshop';
import { assertOrigin,json,readJson } from '@/server/http';
import { archiveProcedure } from '@/modules/workshop/service';
export async function POST(r:Request,c:{params:Promise<{id:string}>}){try{assertOrigin(r);const v=z.object({version:z.number()}).strict().parse(await readJson(r));await archiveProcedure(await workDeps(),(await c.params).id,v.version);return json({ok:true});}catch(e){return workFailure(e);}}
