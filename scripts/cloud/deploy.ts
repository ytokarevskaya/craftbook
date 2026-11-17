import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {api,verifyTargets} from './api';
import {command} from '../recovery/environment';
async function main() {
 if(process.argv.length!==3||! /^[a-f0-9]{40}$/.test(process.argv[2]))throw new Error('EXACT_COMMIT_REQUIRED');
 const sha=process.argv[2],head=(await command('git',['rev-parse','HEAD'])).toString().trim();
 if(head!==sha||(await command('git',['status','--porcelain'])).length)throw new Error('COMMIT_OR_WORKTREE_MISMATCH');
 const target=await verifyTargets();
 const archive=await command('git',['archive','--format=tar.gz',sha]);
 const source=await api('heroku','/sources','POST');
 for(const value of [source.source_blob?.put_url,source.source_blob?.get_url]) {
  const url=new URL(value);if(url.protocol!=='https:'||!url.hostname.endsWith('.amazonaws.com'))throw new Error('INVALID_HEROKU_SOURCE_URL');
 }
 const upload=await fetch(source.source_blob.put_url,{method:'PUT',body:new Uint8Array(archive),redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':''}});
 if(!upload.ok)throw new Error('SOURCE_UPLOAD_FAILED');
 const build=await api('heroku',`/apps/${target.appId}/builds`,'POST',{source_blob:{url:source.source_blob.get_url,version:sha,checksum:'SHA256:'+createHash('sha256').update(archive).digest('hex')}});
 await mkdir('.cloud',{mode:0o700,recursive:true});
 await writeFile('.cloud/deploy.json',JSON.stringify({appId:target.appId,appName:target.appName,commit:sha,buildId:build.id,status:build.status},null,2),{mode:0o600});
 console.log(JSON.stringify({app:target.appName,commit:sha,buildId:build.id,status:build.status}));
}
void main().catch(error=>{const code=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'DEPLOY_FAILED';console.error('Nasazení nedokončeno:',code);process.exitCode=1;});
