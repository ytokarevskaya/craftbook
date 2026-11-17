import { z } from 'zod';
import { workDeps,workFailure } from '@/server/workshop';
import { assertOrigin,json,readJson } from '@/server/http';
import { startProduct,returnToPlan,setStep,completeProduct,updateActual,createProcedureFromProduct,saveJournal,setPhoto,WorkError } from '@/modules/workshop/service';
export async function POST(r:Request,c:{params:Promise<{id:string;action:string}>}){try{assertOrigin(r);const {id,action}=await c.params,raw=await readJson(r,1000000),d=await workDeps();
 switch(action){case 'start':return json(await startProduct(d,id,raw));case 'return':return json(await returnToPlan(d,id,z.object({version:z.number()}).strict().parse(raw).version));case 'step':return json(await setStep(d,id,raw));case 'complete':return json(await completeProduct(d,id,raw));case 'actual':return json(await updateActual(d,id,raw));case 'save-procedure':return json(await createProcedureFromProduct(d,id,raw));case 'journal':return json(await saveJournal(d,id,raw));case 'photo':return json(await setPhoto(d,id,raw));default:throw new WorkError('NOT_FOUND',404);}
 }catch(e){return workFailure(e);}}
