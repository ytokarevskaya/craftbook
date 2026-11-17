import { localConnections } from './local-common';
import { cleanupAssets } from '../src/modules/files/cleanup';
import { PrivateStorage } from '../src/modules/files/storage';
if(process.argv.length>3||(process.argv[2]&&!['--apply','--dry-run'].includes(process.argv[2])))throw new Error('Použijte --dry-run nebo --apply.');
async function main(){
const c=localConnections();
try{const result=await cleanupAssets(c.migration,new PrivateStorage(c.admin),process.argv[2]==='--apply');console.log('Lokální údržba (výchozí dry-run), nejvýše 50 objektů:',result);if(result.failed)process.exitCode=1;}
catch{console.error('Lokální údržba selhala; lze ji bezpečně opakovat.');process.exitCode=1;}
finally{await c.migration.end();await c.runtime.end();}

}
void main().catch(()=>{console.error("Lokální operace selhala. Ověřte konfiguraci.");process.exitCode=1;});
