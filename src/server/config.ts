import "server-only";
import { z } from "zod";
export function authConfig() {
  const env = process.env; // Server runtime lookup; a restored local target uses its own Auth.
  return z.object({
    url: z.url(), key: z.string().min(1), appUrl: z.url(),
  }).parse({ url: Reflect.get(env, 'NEXT_PUBLIC_SUPABASE_URL'), key: Reflect.get(env, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), appUrl: process.env.APP_URL });
}
