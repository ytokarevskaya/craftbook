import {cloudConnections} from './config';
import {assertCloudOps} from './guard';
import {PrivateStorage} from '../../src/modules/files/storage';
import {cleanupAssets} from '../../src/modules/files/cleanup';
async function main(){
 if(process.argv.length>3||(process.argv[2]&&!['--dry-run','--apply'].includes(process.argv[2])))throw new Error('INVALID_COMMAND');
 const c=cloudConnections();try{
  await assertCloudOps(c.migration,c.authUrl);
  const result=await cleanupAssets(c.migration,new PrivateStorage(c.admin),process.argv[2]==='--apply',50);
  console.log('Ověřená cloudová údržba; výchozí dry-run, nejvýše 50 objektů:',result);
  if(result.failed)process.exitCode=1;
 }finally{await c.migration.end();await c.runtime?.end();}
}
void main().catch(()=>{console.error('Cloudová údržba nedokončena. Nic neresetujte; ověřte projekt a opakujte nejprve --dry-run.');process.exitCode=1;});
