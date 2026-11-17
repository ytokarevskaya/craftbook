import { readFileSync, statSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { cloudTarget } from '../../src/lib/cloud-target';
import { connectionConfig } from '../../src/lib/database-config';
export const cloudEnvPath='.env.ops.cloud.local';
export function readCloudEnv() {
 if(!existsSync(cloudEnvPath))throw new Error('CLOUD_CONFIG_MISSING');
 if((statSync(cloudEnvPath).mode&0o077)!==0)throw new Error('CLOUD_CONFIG_PERMISSIONS');
 const env:Record<string,string>={};
 for(const [name,value] of Object.entries(parseEnv(readFileSync(cloudEnvPath,'utf8'))))if(typeof value==='string')env[name]=value;
 if(env.SUPABASE_PROJECT_REF!==cloudTarget.projectRef||env.NEXT_PUBLIC_SUPABASE_URL!==cloudTarget.authUrl||env.APP_URL!==cloudTarget.origin)throw new Error('CLOUD_TARGET_MISMATCH');
 return env;
}
export function required(env:Record<string,string>,name:string) {const value=env[name];if(!value)throw new Error(`MISSING_${name}`);return value;}
export function cloudConnections() {
 const env=readCloudEnv();
 const admin=createClient(cloudTarget.authUrl,required(env,'SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 const migration=new Pool(connectionConfig(required(env,'MIGRATION_DATABASE_URL'),'postgres',env.DATABASE_CA_CERT));
 const runtime=env.DATABASE_URL?new Pool(connectionConfig(env.DATABASE_URL,'craftbook_runtime',env.DATABASE_CA_CERT)):undefined;
 for(const pool of [migration,runtime])pool?.on('error',()=>console.error('CLOUD_DB_CONNECTION_ERROR'));
 return {env,admin,migration,runtime,authUrl:cloudTarget.authUrl,publicKey:required(env,'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')};
}
export function serializeEnv(env:Record<string,string>) {
 return Object.entries(env).map(([name,value])=>{
  if(!/^[A-Z][A-Z0-9_]*$/.test(name)||value.includes('\0')||value.includes('"')||value.includes('\\'))throw new Error('INVALID_ENV_VALUE');
  return `${name}="${value}"`;
 }).join('\n')+'\n';
}
