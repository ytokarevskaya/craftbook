import { inventoryDeps,inventoryFailure } from '@/server/inventory';
import { assertOrigin,readJson,json } from '@/server/http';
import { reservationCards } from '@/modules/inventory/reservations';
import { z } from 'zod';
import { reconcile,archiveItem,saveItem,createPurchase,changeStock } from '@/modules/inventory/service';
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){try{assertOrigin(request);const {action}=await params,raw=await readJson(request,1048576),d=await inventoryDeps();if(action==='archive'){const v=z.object({id:z.uuid(),version:z.number().int().positive(),archived:z.boolean()}).strict().parse(raw);await archiveItem(d,v.id,v.version,v.archived);return json({id:v.id});}if(action==='item')return json(await saveItem(d,raw));if(action==='purchase')return json(await createPurchase(d,raw));if(action==='opening'||action==='writeoff'||action==='adjustment')return json(await changeStock(d,action,raw));return json({message:'Operace nebyla nalezena.'},404);}catch(e){return inventoryFailure(e);}}

export async function GET(_request:Request,{params}:{params:Promise<{action:string}>}){try{if((await params).action==='cards')return json(await reservationCards(await inventoryDeps()));if((await params).action!=='reconcile')return json({message:'Operace nebyla nalezena.'},404);return json({issues:await reconcile(await inventoryDeps())});}catch(e){return inventoryFailure(e);}}
