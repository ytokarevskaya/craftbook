import { inspectTargets } from './api';
void inspectTargets().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{
 const code=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'CLOUD_OPERATION_FAILED';
 console.error(`Cloudová kontrola nedokončena: ${code}. Tajné hodnoty neposílejte do chatu.`);process.exitCode=1;
});
