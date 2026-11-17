import { cloudTarget } from '../../src/lib/cloud-target';
import { writeFileSync } from 'node:fs';
import { cloudEnvPath,serializeEnv,required,readCloudEnv } from './config';
type Json=Record<string,unknown>;
export async function api(service:'heroku'|'supabase',path:string,method='GET',body?:unknown,env=readCloudEnv()) {
 const base=service==='heroku'?'https://api.heroku.com':'https://api.supabase.com';
 if(!path.startsWith('/')||path.includes('..')||path.includes('?'))throw new Error('INVALID_API_PATH');
 const response=await fetch(base+path,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{
  Authorization:`Bearer ${required(env,service==='heroku'?'HEROKU_API_KEY':'SUPABASE_ACCESS_TOKEN')}`,
  Accept:service==='heroku'?'application/vnd.heroku+json; version=3':'application/json',
  ...(body?{'Content-Type':'application/json'}:{}),
 },...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new Error(`${service.toUpperCase()}_HTTP_${response.status}`);
 if(path.endsWith('/config-vars')){await response.body?.cancel();return null;}
 return response.status===204?null:response.json();
}
export type VerifiedTargets={appId:string;appName:string;organization:string;stack:string};
export async function verifyTargets(env=readCloudEnv()):Promise<VerifiedTargets> {
 let name=env.HEROKU_APP_NAME,id=env.HEROKU_APP_ID;
 if(!name||!id) {
  const apps=await api('heroku','/apps','GET',undefined,env);
  const matches=apps.filter((app:{web_url:string})=>app.web_url&&new URL(app.web_url).origin===cloudTarget.origin);
  if(matches.length!==1)throw new Error('HEROKU_ORIGIN_NOT_UNIQUE_OR_NOT_FOUND');
  name=matches[0].name;id=matches[0].id;
 }
 if(!name||!id)throw new Error('HEROKU_ID_MISSING');
 if(!/^[a-z][a-z0-9-]{2,29}$/.test(name)||! /^[a-f0-9-]{36}$/.test(id))throw new Error('INVALID_HEROKU_ID');
 const [account,app,projects]=await Promise.all([api('heroku','/account','GET',undefined,env),api('heroku',`/apps/${id}`,'GET',undefined,env),api('supabase','/v1/projects','GET',undefined,env)]);
 if(app.id!==id||app.name!==name||app.owner?.id!==account.id||app.team||app.region?.name!=='eu'||new URL(app.web_url).origin!==cloudTarget.origin)throw new Error('HEROKU_TARGET_OR_OWNER_MISMATCH');
 const stack=app.build_stack?.name??app.stack?.name;
 if(!['heroku-22','heroku-24'].includes(stack))throw new Error('CLASSIC_BUILD_STACK_REQUIRED');
 const project=projects.find((p:Json)=>p.id===cloudTarget.projectRef||p.ref===cloudTarget.projectRef);
 if(!project||project.region!=='eu-west-1'||project.status!=='ACTIVE_HEALTHY')throw new Error('SUPABASE_TARGET_MISMATCH');
 const organization=project.organization_slug??project.organization_id;
 if(!organization)throw new Error('SUPABASE_OWNER_MISSING');
 if(!env.HEROKU_APP_NAME||!env.HEROKU_APP_ID){env.HEROKU_APP_NAME=name;env.HEROKU_APP_ID=id;writeFileSync(cloudEnvPath,serializeEnv(env),{mode:0o600});}
 return {appId:id,appName:name,organization,stack};
}
export async function inspectTargets() {
 const env=readCloudEnv(),target=await verifyTargets(env);
 const [formation,addons,buildpacks,auth]=await Promise.all([
  api('heroku',`/apps/${target.appId}/formation`),api('heroku',`/apps/${target.appId}/addons`),
  api('heroku',`/apps/${target.appId}/buildpack-installations`),api('supabase',`/v1/projects/${cloudTarget.projectRef}/config/auth`),
 ]);
 // Deliberately never print entire config/keys or raw Auth/provider settings.
 return {...target,projectRef:cloudTarget.projectRef,formation:formation.map((p:Json)=>({type:p.type,quantity:p.quantity,size:(p.size as Json)?.name??p.size})),
  addonCount:addons.length,buildpacks:buildpacks.map((p:Json)=>(p.buildpack as Json)?.url),
  auth:{signupDisabled:auth.disable_signup===true,anonymousDisabled:auth.external_anonymous_users_enabled===false,siteUrlMatches:auth.site_url===cloudTarget.origin,redirectsEmpty:!auth.uri_allow_list},
  configuredNames:Object.keys(env).filter(name=>!!env[name]),
 };
}
