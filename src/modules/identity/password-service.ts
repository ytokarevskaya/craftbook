import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Pool, PoolClient } from "pg";
import { accountLock } from "./operation-lock";
import { verifyIdentity, type VerifiedIdentity } from "./service";
import { AccessError } from "./errors";
import { passwordInput } from "./password-input";

export class PasswordError extends Error {
  constructor(public readonly code: "CURRENT_PASSWORD_INVALID" | "RELOGIN_REQUIRED" | "PASSWORD_FAILED", public readonly operationId?: string) { super(code); }
}
export async function identityTransaction<T>(client: PoolClient, identity: VerifiedIdentity, run:()=>Promise<T>) {
  await client.query("BEGIN");
  try {
    await client.query("select set_config('app.user_id',$1,true),set_config('app.session_id',$2,true)",[identity.userId,identity.sessionId]);
    const result=await run(); await client.query("COMMIT"); return result;
  } catch(error) { await client.query("ROLLBACK"); throw error; }
}
export async function passwordAccess(pool: Pool, identity: VerifiedIdentity):Promise<"active"|"pending"|"expired"|"blocked"> {
  const client=await pool.connect();
  try { return await identityTransaction(client,identity,async()=> (await client.query("select app.password_access() as access")).rows[0].access); }
  finally { client.release(); }
}
export async function changePassword(deps: { pool: Pool; auth: SupabaseClient; authUrl: string; publicKey: string; checkpoint?: (point:string)=>Promise<void> }, raw: unknown) {
  const input=passwordInput.parse(raw);
  const identity=await verifyIdentity(deps.auth);
  return accountLock(deps.pool,identity.userId,async client=>{
    const access=await identityTransaction(client,identity,async()=> (await client.query("select app.password_access() as access")).rows[0].access);
    if (!['active','pending'].includes(access)) throw new AccessError("ACCOUNT_BLOCKED");
    if (access==='pending') {
      // Auth secure password change requires a recent login. Leave the account
      // pending and ask for a fresh login before starting any durable mutation.
      const recent=await identityTransaction(client,identity,async()=>
        (await client.query("select app.current_session_started_at() > clock_timestamp()-interval '23 hours' as recent")).rows[0].recent);
      if (!recent) throw new PasswordError("RELOGIN_REQUIRED");
    }
    let auth=deps.auth;
    if (access==='active') {
      if (!input.currentPassword) throw new PasswordError("CURRENT_PASSWORD_INVALID");
      auth=createClient(deps.authUrl,deps.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const result=await auth.auth.signInWithPassword({email:identity.email,password:input.currentPassword});
      if (result.error || result.data.user?.id!==identity.userId) throw new PasswordError("CURRENT_PASSWORD_INVALID");
    }
    const key=randomUUID(); let begun=false;
    try {
      await identityTransaction(client,identity,()=>client.query("select app.begin_password_change($1)",[key])); begun=true;
      await deps.checkpoint?.('after_block');
      const result=await auth.auth.updateUser({password:input.newPassword,...(input.currentPassword?{current_password:input.currentPassword}:{})});
      if (result.error) throw new PasswordError("PASSWORD_FAILED",key);
      await deps.checkpoint?.('after_auth');
      await identityTransaction(client,identity,()=>client.query("select app.advance_password_change($1,'auth_changed')",[key]));
      const revoked=await auth.auth.signOut({scope:'global'});
      if (revoked.error) throw new PasswordError("PASSWORD_FAILED",key);
      await deps.checkpoint?.('after_revoke');
      await identityTransaction(client,identity,()=>client.query("select app.advance_password_change($1,'complete')",[key]));
      // Cookie client may differ from the isolated reauthentication client.
      await deps.auth.auth.signOut({scope:'local'});
      return { redirect:"/login?password=changed" };
    } catch {
      if (begun) {
        try { await identityTransaction(client,identity,()=>client.query("select app.advance_password_change($1,'failed')",[key])); }
        catch { /* Durable blocked state remains; no unsafe activation on uncertain outcome. */ }
      }
      throw new PasswordError("PASSWORD_FAILED",key);
    } finally {
      // Best effort removal of the isolated reauthentication session on all paths.
      if (auth!==deps.auth) await auth.auth.signOut({scope:'local'}).catch(()=>{});
    }
  });
}
