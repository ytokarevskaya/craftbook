import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { writeFileSync } from 'node:fs';
import { cloudDatabaseUrl } from '../../src/lib/database-config';
import { cloudTarget } from '../../src/lib/cloud-target';
import { readCloudEnv,cloudEnvPath,serializeEnv } from './config';
async function main() {
 if(!process.stdin.isTTY)throw new Error('TTY_REQUIRED');
 const env=readCloudEnv();let muted=false;
 const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding);done();}});
 const prompt=createInterface({input:process.stdin,output,terminal:true});
 const ask=async(label:string,secret=false)=>{process.stdout.write(label+': ');muted=secret;try{return(await prompt.question('')).trim();}finally{muted=false;if(secret)process.stdout.write('\n');}};
 try {
  console.log(`Cíl: ${cloudTarget.projectRef}; ${cloudTarget.origin}. Prázdný vstup zachová existující hodnotu.`);
  for(const [name,label,secret] of [
   ['HEROKU_APP_NAME','Přesný Heroku App name',false],['HEROKU_APP_ID','Heroku App ID (UUID ze Settings)',false],
   ['HEROKU_API_KEY','Heroku Account API key (skrytý vstup)',true],
   ['SUPABASE_ACCESS_TOKEN','Supabase osobní Management token (skrytý vstup)',true],
   ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','Publishable API key cílového projektu',true],
   ['SUPABASE_SECRET_KEY','Secret API key cílového projektu (skrytý vstup)',true],
  ] as const) {const value=await ask(label,secret);if(value)env[name]=value;}
  const password=await ask('DB heslo postgres cílového projektu (skrytý vstup)',true);
  if(password)env.MIGRATION_DATABASE_URL=cloudDatabaseUrl('postgres',password);
  writeFileSync(cloudEnvPath,serializeEnv(env),{mode:0o600});
  console.log('Oddělená cloudová konfigurace uložena. Lokální .env.local/.env.ops.local zůstaly zachované.');
 } finally {prompt.close();}
}
void main().catch(()=>{console.error('Cloudové údaje nebyly připraveny. Ověřte chráněný soubor a interaktivní terminál.');process.exitCode=1;});
