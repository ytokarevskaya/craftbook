import type { Pool } from 'pg';
import { cloudTarget } from '../../src/lib/cloud-target';
import { verifyTargets } from './api';
import { assertMigrationRole,migrationState } from './migrations';
export async function assertCloudOps(pool:Pool,authUrl:string) {
 if(authUrl!==cloudTarget.authUrl)throw new Error('CLOUD_AUTH_TARGET_MISMATCH');
 await verifyTargets();
 const client=await pool.connect();try {
  await assertMigrationRole(client);
  const state=await migrationState(client);if(!state.history.length||state.pending.length)throw new Error('MIGRATIONS_PENDING');
 }finally{client.release();}
}
