import type { PoolConfig } from 'pg';
import { cloudTarget } from './cloud-target';
export function connectionConfig(value:string,role:'craftbook_runtime'|'postgres',ca?:string):PoolConfig {
 const url=new URL(value);
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.pathname!=='/postgres'||url.hash||url.search||!url.password)throw new Error('INVALID_DB_URL');
 const username=decodeURIComponent(url.username);
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(local) {
  if(username!==role||!['54322','55322','56322'].includes(url.port))throw new Error('INVALID_LOCAL_DB_ROLE');
  return {connectionString:url.href,ssl:false,max:role==='postgres'?2:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000};
 }
 if(url.hostname!==cloudTarget.poolerHost||url.port!=='5432'||username!==`${role}.${cloudTarget.projectRef}`)throw new Error('INVALID_CLOUD_DB_TARGET');
 if(ca&&!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(ca))throw new Error('INVALID_DB_CA');
 // Never let connectionString sslmode/sslrootcert replace the TLS object.
 return {connectionString:url.href,ssl:{rejectUnauthorized:true,servername:cloudTarget.poolerHost,...(ca?{ca}:{})},max:role==='postgres'?2:5,connectionTimeoutMillis:10000,idleTimeoutMillis:10000};
}
export function runtimeConnection(env:Record<string,string|undefined>=process.env) {
 if(!env.DATABASE_URL)throw new Error('DATABASE_CONFIG_MISSING');
 if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new Error('INSECURE_TLS_CONFIG');
 return connectionConfig(env.DATABASE_URL,'craftbook_runtime',env.DATABASE_CA_CERT);
}

export function cloudDatabaseUrl(role:'postgres'|'craftbook_runtime',password:string) {
 const url=new URL(`postgresql://${role}.${cloudTarget.projectRef}@${cloudTarget.poolerHost}:5432/postgres`);
 url.password=encodeURIComponent(password);return url.href;
}
