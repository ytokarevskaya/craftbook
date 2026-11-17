import { workDeps,workFailure } from '@/server/workshop';
import { assertOrigin,json,readJson } from '@/server/http';
import { listWork,saveProduct } from '@/modules/workshop/service';
export async function GET(r:Request){try{const u=new URL(r.url);return json(await listWork(await workDeps(),'product',u.searchParams.get('q')??'',Number(u.searchParams.get('page')??1),u.searchParams.get('status')??''));}catch(e){return workFailure(e);}}
export async function POST(r:Request){try{assertOrigin(r);return json(await saveProduct(await workDeps(),await readJson(r,1000000)));}catch(e){return workFailure(e);}}
