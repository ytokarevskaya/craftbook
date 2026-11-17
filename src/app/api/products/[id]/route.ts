import { workDeps,workFailure } from '@/server/workshop';
import { json } from '@/server/http';
import { getProduct } from '@/modules/workshop/service';
export async function GET(_:Request,c:{params:Promise<{id:string}>}){try{return json(await getProduct(await workDeps(),(await c.params).id));}catch(e){return workFailure(e);}}
