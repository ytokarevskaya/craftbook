import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { userProfiles } from "./schema";
import { AccessError } from "./errors";

const identitySchema = z.object({ userId: z.uuid(), sessionId: z.uuid(), email: z.email() });
// This value is constructed only after Auth verification; never from request parameters.
export type VerifiedIdentity = z.infer<typeof identitySchema>;
export async function verifyIdentity(client: SupabaseClient): Promise<VerifiedIdentity> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new AccessError("UNAUTHORIZED");
  const { data, error } = await client.auth.getClaims();
  if (error || !data || data.claims.sub !== userData.user.id) throw new AccessError("UNAUTHORIZED");
  const identity = identitySchema.safeParse({ userId: userData.user.id, sessionId: data.claims.session_id, email: userData.user.email });
  if (!identity.success) throw new AccessError("UNAUTHORIZED");
  return identity.data;
}
type Transaction = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];
export async function withAccount<T>(db: NodePgDatabase, identity: VerifiedIdentity, operation: (tx: Transaction, profile: typeof userProfiles.$inferSelect) => Promise<T>, config?: Parameters<NodePgDatabase["transaction"]>[1]) {
  identitySchema.parse(identity);
  return db.transaction(async tx => {
    await tx.execute(sql`select set_config('app.user_id', ${identity.userId}, true), set_config('app.session_id', ${identity.sessionId}, true)`);
    const state = await tx.execute<{ allowed: boolean }>(sql`select app.account_is_active() as allowed`);
    if (!state.rows[0]?.allowed) throw new AccessError("ACCOUNT_BLOCKED");
    const [profile] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, identity.userId));
    if (!profile) throw new AccessError("ACCOUNT_BLOCKED");
    return operation(tx, profile);
  }, config);
}
export const profileInput = z.object({ displayName: z.string().trim().max(80).refine(value => !/[\u0000-\u001f\u007f]/.test(value)), hasWorkshop: z.boolean() }).strict();
export async function updateProfile(db: NodePgDatabase, identity: VerifiedIdentity, input: unknown) {
  const values = profileInput.parse(input);
  return withAccount(db, identity, async tx => {
    const [profile] = await tx.update(userProfiles).set(values).where(eq(userProfiles.userId, identity.userId)).returning();
    if (!profile) throw new AccessError("ACCOUNT_BLOCKED");
    return profile;
  });
}
