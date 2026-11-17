import 'server-only';
import { ZodError } from 'zod';
import { getDb } from './db';
import { createAuthClient } from './supabase';
import { verifyIdentity } from '@/modules/identity/service';
import { privateStorage } from '@/modules/files/storage';
import { FileError } from '@/modules/files/config';
import { DocumentError } from '@/modules/documents/service';
import { failure,json } from './http';
export async function documentDeps(){return {db:getDb(),identity:await verifyIdentity(await createAuthClient())};}
export async function fileDeps(){return {...await documentDeps(),storage:privateStorage()};}
export function documentFailure(error:unknown){
 if(error instanceof DocumentError||error instanceof FileError){const messages:Record<string,string>={CONFLICT:'Dokument mezitím změnil někdo v jiné záložce. Vaše rozepsaná verze zůstala zachována. Můžete načíst aktuální verzi.',NOT_FOUND:'Dokument nebo soubor nebyl nalezen.',INVALID_CONTENT:'Obsah poznámky není platný nebo překračuje povolený limit.',INVALID_FILE:'Soubor neodpovídá podporovanému formátu. Použijte PDF, DOCX, UTF-8 MD nebo obrázek JPEG, PNG či WebP.',FILE_LIMIT:'Soubor překračuje povolenou velikost.',ASSET_UNAVAILABLE:'Soubor ještě není ověřený, byl odstraněn nebo k němu nemáte přístup.',UPLOAD_MISSING:'Nahrávání není dokončené. Zkuste ověření znovu.'};return json({code:error.code,message:messages[error.code]??'Úložiště není dostupné. Zkuste operaci znovu.'},error.status);}
 if(error instanceof ZodError||error instanceof SyntaxError)return json({code:'VALIDATION_ERROR',message:'Zkontrolujte název a obsah dokumentu. Název může mít nejvýše 180 znaků.'},400);
 return failure(error);
}
