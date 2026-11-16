import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { databaseUrl } from "./config";
const globalDb = globalThis as unknown as { craftbookPool?: Pool };
export function getPool() {
  if (!globalDb.craftbookPool) {
    globalDb.craftbookPool = new Pool({ connectionString: databaseUrl(), max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
    // Do not print connection strings or driver errors containing private values.
    globalDb.craftbookPool.on("error", () => console.error("DB_CONNECTION_ERROR"));
  }
  return globalDb.craftbookPool;
}
export function getDb() { return drizzle(getPool()); }
