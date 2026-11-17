import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { localConnections } from "./local-common";
import { runOperation, OpsError, type OpsKind } from "./ops/service";

async function main() {
  const command=process.argv[2];
  if (process.argv.length!==3 || !['create','provision','reset','deactivate','resume','status'].includes(command)) throw new Error("INVALID_COMMAND");
  if (!process.stdin.isTTY) throw new Error("TTY_REQUIRED");
  const connections=localConnections();
  let muted=false;
  const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding);done();}});
  const prompt=createInterface({input:process.stdin,output,terminal:true});
  const ask=async(text:string)=>(await prompt.question(text)).trim();
  try {
    console.log("Prostředí: lokální Craftbook (Auth 54321, DB 54322). Vzdálené cíle jsou zakázané.");
    if(command==='status') {
      const target=await ask("Auth ID (prázdné = posledních 20 operací): ");
      if (target && !/^[0-9a-f-]{36}$/i.test(target)) throw new Error("INVALID_ID");
      const rows=await connections.migration.query(`select id,target_id,kind,status,phase,operator_reference,error_code from app.account_provision_operation
        where ($1::uuid is null or target_id=$1) order by created_at desc limit 20`,[target||null]);
      console.table(rows.rows); return;
    }
    let kind=command as OpsKind;
    let key: string=randomUUID(); let reference=""; let targetId:string|undefined;
    if(command==='resume') {
      key=await ask("ID nedokončené operace: ");
      if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("INVALID_ID");
      const op=(await connections.migration.query("select * from app.account_provision_operation where id=$1",[key])).rows[0];
      if(!op || op.kind==='password') throw new Error("SELF_CHANGE_REQUIRES_RESET");
      if(op.status==='complete'){console.log("Operace už byla dokončena. Nic se nemění.");return;}
      if(op.status==='superseded') throw new Error("STALE_OPERATION");
      kind=op.kind; reference=op.operator_reference; if(kind!=='create') targetId=op.target_id;
    } else {
      reference=await ask("Provozní reference (stručný důvod, bez hesel): ");
      if(kind!=='create') targetId=await ask("Cílové Auth ID: ");
    }
    let email:string|undefined;
    if(kind==='create') email=await ask("E-mail nového účtu (u pokračování stejný jako původně): ");
    if(targetId) {
      const target=await connections.admin.auth.admin.getUserById(targetId);
      if(target.error || !target.data.user) throw new Error("TARGET_NOT_FOUND");
      console.log(`Cíl: ${targetId} (${target.data.user.email ?? 'bez e-mailu'}), operace: ${kind}`);
    } else console.log(`Nový účet: ${email}, operace: ${kind}`);
    console.log(`ID operace pro dohledání a pokračování: ${key}`);
    if(await ask("Potvrďte cílový účet a operaci slovem PROVÉST: ")!=='PROVÉST'){console.log("Zrušeno beze změny.");return;}
    let password:string|undefined;
    if(kind==='create'||kind==='reset') {
      process.stdout.write("Dočasné heslo (min. 12 znaků, max. 72 bajtů UTF-8; skrytý vstup): ");
      muted=true; password=await prompt.question(""); muted=false; process.stdout.write("\n");
      process.stdout.write("Potvrzení dočasného hesla (skrytý vstup): ");
      muted=true; const confirmation=await prompt.question(""); muted=false; process.stdout.write("\n");
      if(password!==confirmation) throw new Error("PASSWORD_MISMATCH");
    }
    const result=await runOperation({pool:connections.migration,admin:connections.admin,authUrl:connections.authUrl,publicKey:connections.publicKey},{kind,key,reference,targetId,email,password});
    console.log(`Dokončeno. Auth ID: ${result.targetId}. Operace: ${result.id}.`);
    if(kind==='create'||kind==='reset'||kind==='provision') console.log("Dočasné heslo předejte osobně. Nový účet vyžaduje změnu hesla do 48 hodin; existující úplný účet provisioning nemění.");
  } finally { prompt.close(); await connections.migration.end(); await connections.runtime.end(); }
}
main().catch(error=>{
  if(error instanceof OpsError) console.error(`Operace nedokončena: ${error.code}. ID: ${error.operationId ?? 'nezaloženo'}. Použijte ops:status a provozní návod.`);
  else console.error("Operace nebyla dokončena. Ověřte lokální prostředí, cílové ID, referenci a zadání hesla. Nedokončenou vlastní změnu napravte explicitním ops:reset; zastaralou operaci neopakujte.");
  process.exitCode=1;
});
