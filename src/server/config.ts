import "server-only";
import { z } from "zod";
export function authConfig() {
  return z.object({
    url: z.url(), key: z.string().min(1), appUrl: z.url(),
  }).parse({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, appUrl: process.env.APP_URL });
}
export function databaseUrl() {
  const url = z.url().parse(process.env.DATABASE_URL);
  const parsed = new URL(url);
  if (decodeURIComponent(parsed.username) !== "craftbook_runtime") throw new Error("Neplatná runtime konfigurace.");
  return url;
}
