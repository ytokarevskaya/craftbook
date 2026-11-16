import { spawn } from 'node:child_process';
// Fixed local-only operations; never forward arbitrary CLI flags or remote targets.
const operations = {
  start: ['start', '--exclude', 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'],
  stop: ['stop'],
  migrate: ['migration', 'up'],
};
const args = operations[process.argv[2]];
if (!args || process.argv.length !== 3) throw new Error('Použijte start, stop nebo migrate.');
const child = spawn('./node_modules/.bin/supabase', args, { stdio: ['ignore', 'pipe', 'pipe'] });
// CLI start/status can print local credentials; keep both streams out of logs.
let diagnostics = '';
child.stdout.on('data', () => {});
child.stderr.on('data', chunk => { diagnostics += chunk; });
const timer = setInterval(() => console.log('Lokální Supabase: operace stále probíhá…'), 30000);
child.on('close', code => {
  clearInterval(timer);
  if (code) {
    console.error('Lokální Supabase: operace selhala. Ověřte Docker daemon, volné porty 54321/54322 a přístup k registru kontejnerů.');
    // Only whitelist non-sensitive diagnostics, never raw CLI output.
    for (const hint of ['connection refused', 'permission denied', 'port is already allocated', 'no space left', 'timeout', 'unhealthy', 'migration']) {
      if (diagnostics.toLowerCase().includes(hint)) console.error(`Diagnostika: ${hint}`);
    }
  } else console.log('Lokální Supabase: hotovo. Tajné hodnoty nebyly vypsány.');
  process.exitCode = code ?? 1;
});
