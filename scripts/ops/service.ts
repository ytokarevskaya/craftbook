import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Pool, PoolClient } from "pg";
import { accountLock, OperationConflict } from "../../src/modules/identity/operation-lock";
import { passwordValue } from "../../src/modules/identity/password-input";
import { assertLocalUrl } from "../local-common";

export type OpsKind = "create" | "provision" | "reset" | "deactivate";
export type OpsInput = { kind: OpsKind; key: string; reference: string; targetId?: string; email?: string; password?: string };
type Operation = { id: string; target_id: string; kind: string; status: string; phase: string; input_reference: string; operator_reference: string };
export class OpsError extends Error {
  constructor(public readonly code: "AUTH_FAILED" | "DB_FAILED" | "CONFLICT" | "INTERRUPTED", public readonly operationId?: string) { super(code); }
}
export type OpsDependencies = { pool: Pool; admin: SupabaseClient; authUrl: string; publicKey: string; checkpoint?: (point: string) => Promise<void> };
async function transaction<T>(client: PoolClient, run: () => Promise<T>) {
  await client.query("BEGIN");
  try { const result = await run(); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}
export async function runOperation(deps: OpsDependencies, input: OpsInput) {
  assertLocalUrl(deps.authUrl, "auth");
  // Pool and admin are only constructed by localConnections after all target checks.
  if (!/^[0-9a-f-]{36}$/i.test(input.key) || !input.reference.trim() || input.reference.length>120) throw new OpsError("CONFLICT");
  if (input.kind !== "create" && !/^[0-9a-f-]{36}$/i.test(input.targetId ?? "")) throw new OpsError("CONFLICT");
  const email = input.email?.trim().toLowerCase();
  if (input.kind === "create" && (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new OpsError("CONFLICT");
  const inputRef = createHash("sha256").update(JSON.stringify([input.kind,input.kind==="create"?email:input.targetId])).digest("hex");
  await deps.pool.query(`insert into app.account_provision_operation(id,target_id,kind,request_key,operator_reference,input_reference)
    values($1,$2,$3,$1,$4,$5) on conflict(request_key) do nothing`,[input.key,input.targetId ?? randomUUID(),input.kind,input.reference,inputRef]);
  const op = (await deps.pool.query<Operation>("select * from app.account_provision_operation where request_key=$1",[input.key])).rows[0];
  if (op.input_reference!==inputRef || op.kind!==input.kind || op.operator_reference!==input.reference) throw new OpsError("CONFLICT",op.id);
  try {
    return await accountLock(deps.pool,op.target_id,async client=>{
      const current = (await client.query<Operation>("select * from app.account_provision_operation where id=$1",[op.id])).rows[0];
      if (current.status==='superseded') throw new OpsError("CONFLICT",op.id);
      if (current.status==='complete') return { id:op.id,targetId:op.target_id,status:"complete" as const };
      const phase = async (value:string) => { await client.query("update app.account_provision_operation set phase=$2,status='running',error_code=null,updated_at=now() where id=$1 and status<>'superseded'",[op.id,value]); };
      const check = async (point:string) => { await deps.checkpoint?.(point); };
      try {
        if (input.kind==='create') {
          const existing = await deps.admin.auth.admin.getUserById(op.target_id);
          if (!existing.data.user) {
            if (existing.error?.status !== 404) throw new OpsError("AUTH_FAILED",op.id);
            passwordValue.parse(input.password);
            const created = await deps.admin.auth.admin.createUser({id:op.target_id,email,password:input.password,email_confirm:true});
            if (created.error || created.data.user?.id!==op.target_id) throw new OpsError("AUTH_FAILED",op.id);
            await check('after_identity');
          } else if (existing.data.user.email?.toLowerCase()!==email) throw new OpsError("CONFLICT",op.id);
          await phase('identity_created');
        } else {
          const target=await deps.admin.auth.admin.getUserById(op.target_id);
          if (target.error || !target.data.user) throw new OpsError("AUTH_FAILED",op.id);
        }
        if (input.kind==='create' || input.kind==='provision') {
          await transaction(client,async()=>{
            const account=(await client.query("select * from app.user_account where auth_user_id=$1 for update",[op.target_id])).rows[0];
            const profile=(await client.query("select 1 from app.user_profile where user_id=$1",[op.target_id])).rowCount;
            // A complete account is never overwritten or reactivated by provisioning.
            if (!(account && profile)) {
              if (account?.status==='disabled') throw new OpsError("CONFLICT",op.id);
              await client.query("update app.account_provision_operation set status='superseded',updated_at=now() where target_id=$1 and id<>$2 and status in ('running','failed')",[op.target_id,op.id]);
              await client.query(`insert into app.user_account(auth_user_id,status,must_change_password,temp_expires_at,operation_id)
                values($1,'pending_password',true,clock_timestamp()+interval '48 hours',$2)
                on conflict(auth_user_id) do update set status='pending_password',must_change_password=true,temp_expires_at=clock_timestamp()+interval '48 hours',sessions_valid_after=clock_timestamp(),operation_id=$2`,[op.target_id,op.id]);
              await client.query("insert into app.user_profile(user_id) values($1) on conflict do nothing",[op.target_id]);
            }
            await check('before_complete');
            await client.query("update app.account_provision_operation set phase='complete',status='complete',error_code=null,updated_at=now() where id=$1",[op.id]);
          });
        } else {
          if (input.kind==='reset') passwordValue.parse(input.password);
          await transaction(client,async()=>{
            const account=(await client.query("select * from app.user_account where auth_user_id=$1 for update",[op.target_id])).rows[0];
            if (!account || (input.kind==='reset' && account.status==='disabled')) throw new OpsError("CONFLICT",op.id);
            await client.query("update app.account_provision_operation set status='superseded',updated_at=now() where target_id=$1 and id<>$2 and status in ('running','failed')",[op.target_id,op.id]);
            await client.query("update app.user_account set status=$2,sessions_valid_after=clock_timestamp(),operation_id=$3 where auth_user_id=$1",[op.target_id,input.kind==='deactivate'?'disabled':'inactive',op.id]);
            await phase('blocked');
          });
          await check('after_block');
          const changed=await deps.admin.auth.admin.updateUserById(op.target_id,input.kind==='reset'?{password:input.password}:{ban_duration:'876000h',password:randomBytes(32).toString('hex')});
          if (changed.error) throw new OpsError("AUTH_FAILED",op.id);
          await check('after_auth'); await phase('auth_changed');
          if (input.kind==='reset') {
            const auth=createClient(deps.authUrl,deps.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
            const target=await deps.admin.auth.admin.getUserById(op.target_id);
            if (!target.data.user?.email) throw new OpsError("AUTH_FAILED",op.id);
            const signed=await auth.auth.signInWithPassword({email:target.data.user.email,password:input.password!});
            if (signed.error || signed.data.user?.id!==op.target_id || !signed.data.session) throw new OpsError("AUTH_FAILED",op.id);
            const revoked=await deps.admin.auth.admin.signOut(signed.data.session.access_token,'global');
            if (revoked.error) throw new OpsError("AUTH_FAILED",op.id);
          }
          // Deactivation also rotates the password to an unretained random value.
          // Admin password update revokes sessions; ban alone only blocks their use.
          await check('after_revoke'); await phase('sessions_revoked');
          await transaction(client,async()=>{
            await check('before_complete');
            const updated=await client.query(`update app.user_account set status=$3,must_change_password=true,
              temp_expires_at=case when $3='pending_password' then clock_timestamp()+interval '48 hours' else null end,
              sessions_valid_after=clock_timestamp() where auth_user_id=$1 and operation_id=$2
              and status=$4`,[op.target_id,op.id,input.kind==='reset'?'pending_password':'disabled',input.kind==='reset'?'inactive':'disabled']);
            if (updated.rowCount!==1) throw new OpsError("CONFLICT",op.id);
            await client.query("update app.account_provision_operation set status='complete',phase='complete',error_code=null,updated_at=now() where id=$1 and status='running'",[op.id]);
          });
        }
        return { id:op.id,targetId:op.target_id,status:"complete" as const };
      } catch (error) {
        const code=error instanceof OpsError?error.code:"INTERRUPTED";
        await client.query("update app.account_provision_operation set status='failed',error_code=$2,updated_at=now() where id=$1 and status not in ('complete','superseded')",[op.id,code]);
        throw new OpsError(code,op.id);
      }
    });
  } catch (error) {
    if (error instanceof OpsError) throw error;
    if (error instanceof OperationConflict) throw new OpsError("CONFLICT",op.id);
    throw new OpsError("DB_FAILED",op.id);
  }
}
