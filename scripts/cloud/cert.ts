import { readFileSync,writeFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { readCloudEnv,serializeEnv,cloudEnvPath } from './config';
try {
 if(process.argv.length!==3)throw new Error('CERT_PATH_REQUIRED');
 const pem=readFileSync(process.argv[2],'utf8'),cert=new X509Certificate(pem);
 if(!cert.ca||!cert.subject.includes('Supabase')||Date.parse(cert.validTo)<Date.now())throw new Error('INVALID_CA');
 const env=readCloudEnv();env.DATABASE_CA_CERT=pem;writeFileSync(cloudEnvPath,serializeEnv(env),{mode:0o600});
 console.log('Veřejný CA certifikát uložen do chráněné cloudové konfigurace. SHA-256:',cert.fingerprint256);
} catch {console.error('CA nebyla nastavena. Použijte PEM certifikát stažený z cílového Supabase Dashboard → Database → Settings → SSL Configuration.');process.exitCode=1;}
