import { fileDeps,documentFailure } from '@/server/documents';
import { assertOrigin,json,readJson } from '@/server/http';
import { prepareUpload } from '@/modules/files/service';
export async function POST(r:Request){try{assertOrigin(r);return json(await prepareUpload(await fileDeps(),await readJson(r)));}catch(e){return documentFailure(e);}}
