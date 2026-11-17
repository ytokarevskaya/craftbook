import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { runtimeConnection } from "@/lib/database-config";
const globalDb = globalThis as unknown as { craftbookPool?: Pool };
export function getPool() {
  if (!globalDb.craftbookPool) {
    globalDb.craftbookPool = new Pool(runtimeConnection());
    // Do not print connection strings or driver errors containing private values.
    globalDb.craftbookPool.on("error", () => console.error("DB_CONNECTION_ERROR"));
  }
  return globalDb.craftbookPool;
}
export function getDb() { return drizzle(getPool()); }
