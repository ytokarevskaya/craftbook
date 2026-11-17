import { cloudTarget } from '../../src/lib/cloud-target';
import { api,verifyTargets } from './api';
import { readCloudEnv,required,cloudConnections } from './config';
import { verifyRuntime } from './provision';
import { backup,verifyBackup } from '../recovery/backup';
import { dumpDatabase } from './dump';
export async function configureAuth() {
 const target=await verifyTargets();
 console.log(`Ověřeno: ${target.appName}; Auth ${cloudTarget.projectRef}.`);
 const before=await api('supabase',`/v1/projects/${cloudTarget.projectRef}/config/auth`);
 const patch:Record<string,unknown>={disable_signup:true,external_anonymous_users_enabled:false,external_email_enabled:true,
  site_url:cloudTarget.origin,uri_allow_list:'',password_min_length:12,refresh_token_rotation_enabled:true,
  security_refresh_token_reuse_interval:10,security_update_password_require_reauthentication:true,
  security_manual_linking_enabled:false};
 for(const name of Object.keys(before))if(/^external_.+_enabled$/.test(name)&&name!=='external_email_enabled')patch[name]=false;
 await api('supabase',`/v1/projects/${cloudTarget.projectRef}/config/auth`,'PATCH',patch);
 const after=await api('supabase',`/v1/projects/${cloudTarget.projectRef}/config/auth`);
 if(Object.entries(patch).some(([k,v])=>after[k]!==v))throw new Error('AUTH_CONFIGURATION_NOT_CONFIRMED');
 console.log('Auth: uzavřená registrace, e-mail/heslo, přesný HTTPS origin, žádné callback wildcardy ani nové SMTP.');
}
export async function configureHeroku() {
 const env=readCloudEnv(),target=await verifyTargets(env);await verifyRuntime();
 const addons=await api('heroku',`/apps/${target.appId}/addons`);if(addons.length)throw new Error('UNEXPECTED_ADDONS');
 const packs=await api('heroku',`/apps/${target.appId}/buildpack-installations`);
 if(packs.length&&!(packs.length===1&&['heroku/nodejs','urn:buildpack:heroku/nodejs','https://github.com/heroku/heroku-buildpack-nodejs'].includes(packs[0].buildpack?.name??packs[0].buildpack?.url)))throw new Error('UNKNOWN_BUILDPACK');
 if(!packs.length)await api('heroku',`/apps/${target.appId}/buildpack-installations`,'PUT',{updates:[{buildpack:'heroku/nodejs'}]});
 const vars={APP_URL:cloudTarget.origin,NEXT_PUBLIC_SUPABASE_URL:cloudTarget.authUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:required(env,'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  DATABASE_URL:required(env,'DATABASE_URL'),DATABASE_CA_CERT:env.DATABASE_CA_CERT||null,STORAGE_SECRET_KEY:required(env,'SUPABASE_SECRET_KEY'),
  MIGRATION_DATABASE_URL:null,SUPABASE_SECRET_KEY:null,NODE_TLS_REJECT_UNAUTHORIZED:null,
  NEXT_TELEMETRY_DISABLED:'1',FILE_IMAGE_BYTES:'5242880',FILE_DOCUMENT_BYTES:'10485760',NOTE_CONTENT_BYTES:'262144',FILE_DOWNLOAD_TTL:'60',FILE_GRACE_HOURS:'24'};
 await api('heroku',`/apps/${target.appId}/config-vars`,'PATCH',vars);
 console.log('Heroku Config Vars připraveny; změněné názvy:',Object.keys(vars).join(', '));
}
export async function ecoWeb() {
 const target=await verifyTargets(),sizes=await api('heroku',`/apps/${target.appId}/available-dyno-sizes`);
 const eco=sizes.find((size:{name:string})=>String(size.name).toLowerCase()==='eco');if(!eco)throw new Error('ECO_NOT_AVAILABLE_NO_PLAN_CHANGE');
 const formation=await api('heroku',`/apps/${target.appId}/formation`);
 if(formation.some((p:{type:string;quantity:number})=>p.type!=='web'&&p.quantity>0))throw new Error('UNEXPECTED_WORKER');
 await api('heroku',`/apps/${target.appId}/formation/web`,'PATCH',{quantity:1,dyno_size:{id:eco.id}});
 console.log('Cílová aplikace: jeden Eco web. Jiné aplikace ani předplatné nebyly změněny.');
}
export async function cloudBackup(path:string,maintenanceConfirmed:boolean) {
 const c=cloudConnections();try {
  const target=await verifyTargets(c.env),formation=await api('heroku',`/apps/${target.appId}/formation`);
  if(!maintenanceConfirmed||formation.some((p:{quantity:number})=>p.quantity>0))throw new Error('BACKUP_REQUIRES_STOPPED_WEB_AND_MAINTENANCE');
  const manifest=await backup({admin:c.admin,migration:c.migration,projectId:cloudTarget.projectRef,
   dump:()=>dumpDatabase(required(c.env,'MIGRATION_DATABASE_URL'),true,c.env.DATABASE_CA_CERT)},path,true);
  await verifyBackup(path);console.log('Pilotní záloha a kontrolní součty ověřeny. Verze schématu:',manifest.versions.schema);
 } finally {await c.migration.end();await c.runtime?.end();}
}
export async function advisors() {
 await verifyTargets();const report=await api('supabase',`/v1/projects/${cloudTarget.projectRef}/advisors/security`);
 const lints=Array.isArray(report.lints)?report.lints:[];
 console.log('Security advisors:',lints.map((item:{name:string;level:string})=>({name:item.name,level:item.level})));
 if(lints.some((item:{level:string})=>item.level==='ERROR'))throw new Error('SECURITY_ADVISOR_ERRORS');
}
export async function enforceSsl() {
 const c=cloudConnections();try {
  const target=await verifyTargets(c.env),formation=await api('heroku',`/apps/${target.appId}/formation`);
  if(formation.some((p:{quantity:number})=>p.quantity>0))throw new Error('SSL_CHANGE_REQUIRES_STOPPED_WEB');
  const role=(await c.migration.query('select current_user as role,current_database() as db')).rows[0];
  if(role.role!=='postgres'||role.db!=='postgres')throw new Error('INVALID_MIGRATION_ROLE');
  const status=await api('supabase',`/v1/projects/${cloudTarget.projectRef}/ssl-enforcement`);
  if(!status.currentConfig?.database)await api('supabase',`/v1/projects/${cloudTarget.projectRef}/ssl-enforcement`,'PUT',{requestedConfig:{database:true}});
  console.log('SSL enforcement požadováno pro jediný ověřený projekt. Může následovat krátký restart DB; před migrací se znovu ověří TLS.');
 }finally{await c.migration.end();await c.runtime?.end();}
}
