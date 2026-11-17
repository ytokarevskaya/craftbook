import { ZodError } from "zod";
import { createAuthClient } from "@/server/supabase";
import { getPool } from "@/server/db";
import { authConfig } from "@/server/config";
import { assertOrigin, readJson, json, failure } from "@/server/http";
import { changePassword, PasswordError } from "@/modules/identity/password-service";
import { OperationConflict } from "@/modules/identity/operation-lock";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const config=authConfig();
    return json(await changePassword({pool:getPool(),auth:await createAuthClient(),authUrl:config.url,publicKey:config.key},await readJson(request)));
  } catch(error) {
    if(error instanceof ZodError) return json({code:'VALIDATION_ERROR',message:'Heslo musí mít alespoň 12 znaků, nejvýše 72 bajtů UTF-8, být jiné než současné a shodovat se s potvrzením.'},400);
    if(error instanceof OperationConflict) return json({code:'CONFLICT',message:'Právě probíhá jiná změna účtu. Zkuste to znovu později.'},409);
    if(error instanceof PasswordError && error.code==='RELOGIN_REQUIRED') return json({code:error.code,message:'Pro změnu hesla se nejprve odhlaste a znovu přihlaste dočasným heslem. Účet zůstává připravený ke změně.'},409);
    if(error instanceof PasswordError) return json({code:error.code,message:error.code==='CURRENT_PASSWORD_INVALID'?'Současné heslo není správné.':`Změnu se nepodařilo bezpečně dokončit. Obraťte se na provozovatele kvůli resetu přístupu. Reference: ${error.operationId ?? 'nedostupná'}.`},error.code==='CURRENT_PASSWORD_INVALID'?400:503);
    return failure(error);
  }
}
