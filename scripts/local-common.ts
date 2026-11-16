import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
export function loadLocalEnv() {
  for (const file of [".env.local", ".env.ops.local"]) if (existsSync(file)) process.loadEnvFile(file);
}
export function assertLocalUrl(value: string | undefined, kind: "auth" | "db" | "app") {
  if (!value) throw new Error("Chybí lokální konfigurace. Spusťte npm run local:env.");
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Nástroj odmítá vzdálený cíl.");
  if (kind === "auth" && (url.protocol !== "http:" || url.port !== "54321" || url.pathname !== "/" || url.username || url.password || url.search)) throw new Error("Neplatný lokální Auth cíl.");
  if (kind === "db" && (!["postgres:", "postgresql:"].includes(url.protocol) || url.port !== "54322" || url.pathname !== "/postgres" || url.search)) throw new Error("Neplatný lokální DB cíl.");
  if (kind === "app" && (url.protocol !== "http:" || url.username || url.password)) throw new Error("Neplatný lokální webový cíl.");
  return value;
}
export function localConnections() {
  loadLocalEnv();
  const authUrl = assertLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "auth");
  const migrationUrl = assertLocalUrl(process.env.MIGRATION_DATABASE_URL, "db");
  const runtimeUrl = assertLocalUrl(process.env.DATABASE_URL, "db");
  if (new URL(runtimeUrl).username !== "craftbook_runtime" || new URL(migrationUrl).username !== "postgres") throw new Error("Neplatné lokální DB role.");
  if (!process.env.SUPABASE_SECRET_KEY) throw new Error("Chybí lokální provozní klíč.");
  const admin = createClient(authUrl, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const migration = new Pool({ connectionString: migrationUrl, max: 1 });
  const runtime = new Pool({ connectionString: runtimeUrl, max: 1 });
  return { admin, migration, runtime, authUrl, publicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! };
}
export async function provision(pool: Pool, userId: string, fixture = false) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Neplatné Auth ID.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT 1 FROM app.user_account WHERE auth_user_id=$1", [userId]);
    if (existing.rowCount) {
      const profile = await client.query("SELECT 1 FROM app.user_profile WHERE user_id=$1", [userId]);
      if (!profile.rowCount) throw new Error("Neúplný účet: chybí profil. Nástroj jej automaticky neaktivuje; náprava provozním postupem etapy 3.");
      await client.query("COMMIT"); return false;
    }
    await client.query(`INSERT INTO app.user_account (auth_user_id,status,must_change_password,temp_expires_at)
      VALUES ($1,$2,$3,CASE WHEN $3 THEN now()+interval '48 hours' ELSE NULL END)`, [userId, fixture ? "active" : "pending_password", !fixture]);
    await client.query("INSERT INTO app.user_profile (user_id) VALUES ($1)", [userId]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
