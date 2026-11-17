import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { localConnections } from './local-common';
import { backup, restore, verifyBackup } from './recovery/backup';
import { createEnvironment, startEnvironment, connectEnvironment, assertRecoveryEnvironment } from './recovery/environment';
async function main() {
 const [mode,...args]=process.argv.slice(2);
 const options=new Map<string,string>();
 for(let i=0;i<args.length;i++) {
  const flag=args[i];if(!['--output','--backup','--workdir','--maintenance-confirmed'].includes(flag)||options.has(flag))throw new Error('INVALID_ARGS');
  options.set(flag,flag==='--maintenance-confirmed'?'true':args[++i]);
 }
 if(mode==='backup'&&options.size===2&&options.has('--output')&&options.has('--maintenance-confirmed')) {
  const c=localConnections();
  try {await backup({...c,projectId:'craftbook-local'},resolve(options.get('--output')!),true);console.log('Lokální záloha dokončena. Citlivá data ukládejte chráněně mimo Git.');}
  finally {await c.migration.end();await c.runtime.end();}
 } else if(mode==='verify'&&options.size===1&&options.has('--backup')) {
  await verifyBackup(resolve(options.get('--backup')!));console.log('Manifest a kontrolní součty prošly. Toto samo není test obnovy.');
 } else if(mode==='restore'&&options.has('--backup')&&options.size<3) {
  const path=resolve(options.get('--backup')!);await verifyBackup(path);
  let workdir=options.get('--workdir');
  if(!workdir){const root='/private/tmp/craftbook-recovery-'+randomUUID();await mkdir(root,{mode:0o700});workdir=await createEnvironment(root,'target');}
  await assertMarkerOrStart(workdir);
  const e=await connectEnvironment(workdir);
  try {
   await restore(e,path);
   const env=[`APP_URL=http://127.0.0.1:3104`,`DATABASE_URL=${e.runtimeUrl}`,`NEXT_PUBLIC_SUPABASE_URL=${e.authUrl}`,`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${e.publicKey}`,`STORAGE_SECRET_KEY=${e.secretKey}`].join('\n')+'\n';
   await writeFile(workdir+'/.env.runtime',env,{mode:0o600,flag:'wx'});
   console.log(`Obnova dokončena, přístup zůstává blokovaný do řízeného resetu. Izolovaný cíl: ${workdir}`);
   console.log('Chráněná runtime konfigurace je v cílovém .env.runtime. Nezaměňujte za běžnou konfiguraci.');
  } finally {await e.migration.end();await e.runtime.end();}
 } else throw new Error('INVALID_ARGS');
}
async function assertMarkerOrStart(workdir:string) {
 // start only a marked target; never accept the ordinary local project.
 const {environmentMarker}=await import('./recovery/environment');await environmentMarker(workdir,true);
 try {await assertRecoveryEnvironment(workdir,undefined,true);}
 catch {const e=await startEnvironment(workdir);await e.migration.end();await e.runtime.end();}
}
void main().catch(()=>{console.error('Operace nedokončena. Ověřte lokální cíl, úplnost zálohy a návod .docs/backup-and-restore.md. Selhaný cíl nepřepisujte; použijte nový izolovaný cíl.');process.exitCode=1;});
