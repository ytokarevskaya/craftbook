import { documentDeps,documentFailure } from '@/server/documents';
import { assertOrigin,json,readJson } from '@/server/http';
import { listDocuments,saveDocument } from '@/modules/documents/service';
export async function GET(request:Request){try{const url=new URL(request.url);return json(await listDocuments(await documentDeps(),url.searchParams.get('q')??'',Number(url.searchParams.get('page')??1)));}catch(e){return documentFailure(e);}}
export async function POST(request:Request){try{assertOrigin(request);return json(await saveDocument(await documentDeps(),await readJson(request,270000)));}catch(e){return documentFailure(e);}}
