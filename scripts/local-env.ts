import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { assertLocalUrl } from "./local-common";
async function main() {
  if (existsSync(".env.local") || existsSync(".env.ops.local")) throw new Error("Lokální konfigurace již existuje; ponechána beze změny. Nepřepisujte existující přístupy.");
  const raw = execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const status = JSON.parse(raw);
  const authUrl = assertLocalUrl(status.API_URL, "auth");
  const dbUrl = assertLocalUrl(status.DB_URL, "db");
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const secret = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
  if (!key || !secret) throw new Error("CLI neposkytlo potřebné lokální klíče.");
  const password = randomBytes(32).toString("hex");
  const db = new Pool({ connectionString: dbUrl, max: 1 });
  try {
    // Password is generated hex, never an input or log. SQL ALTER ROLE has no bind parameters.
    await db.query(`ALTER ROLE craftbook_runtime PASSWORD '${password}'`);
  } finally { await db.end(); }
  const runtime = new URL(dbUrl); runtime.username = "craftbook_runtime"; runtime.password = password;
  writeFileSync(".env.local", `APP_URL=http://localhost:3000\nNEXT_PUBLIC_SUPABASE_URL=${authUrl}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nDATABASE_URL=${runtime.href}\n`, { mode: 0o600, flag: "wx" });
  writeFileSync(".env.ops.local", `MIGRATION_DATABASE_URL=${dbUrl}\nSUPABASE_SECRET_KEY=${secret}\n`, { mode: 0o600, flag: "wx" });
  console.log("Lokální konfigurace připravena v ignorovaných souborech s právy 600. Provozní klíč není v konfiguraci webového runtime.");
}
main().catch(() => { console.error("Příprava lokální konfigurace selhala. Ověřte běh Supabase a migrace. Existující .env soubory se záměrně nepřepisují."); process.exitCode = 1; });
