import type { Pool, PoolClient } from "pg";
export class OperationConflict extends Error { constructor() { super("CONFLICT"); } }
export async function accountLock<T>(pool: Pool, targetId: string, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  const key = `craftbook-account:${targetId}`;
  let locked = false;
  let destroy = false;
  try {
    locked = (await client.query("select pg_try_advisory_lock(hashtextextended($1,0)) as locked", [key])).rows[0].locked;
    if (!locked) throw new OperationConflict();
    return await run(client);
  } finally {
    try { if (locked) await client.query("select pg_advisory_unlock(hashtextextended($1,0))", [key]); }
    catch { destroy = true; }
    client.release(destroy);
  }
}
