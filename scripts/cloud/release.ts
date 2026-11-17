import {readFile,writeFile} from 'node:fs/promises';
import {api,verifyTargets} from './api';
async function main() {
 const target=await verifyTargets(),state=JSON.parse(await readFile('.cloud/deploy.json','utf8'));
 if(state.appId!==target.appId||! /^[a-f0-9-]{36}$/.test(state.buildId))throw new Error('BUILD_TARGET_MISMATCH');
 const build=await api('heroku',`/apps/${target.appId}/builds/${state.buildId}`);
 const result={...state,status:build.status,releaseId:build.release?.id??null};
 if(result.releaseId){const release=await api('heroku',`/apps/${target.appId}/releases/${result.releaseId}`);Object.assign(result,{releaseVersion:release.version,releaseStatus:release.status});}
 await writeFile('.cloud/deploy.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));
 if(!['pending','succeeded'].includes(build.status))process.exitCode=1;
}
void main().catch(()=>{console.error('Stav releasu nelze ověřit. Nevypisujte Config Vars ani podepsané URL.');process.exitCode=1;});
