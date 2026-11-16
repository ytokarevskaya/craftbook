import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase";
import { getDb } from "./db";
import { verifyIdentity, withAccount } from "@/modules/identity/service";
import { AccessError } from "@/modules/identity/errors";
export async function currentAccount() {
  const identity = await verifyIdentity(await createAuthClient());
  return withAccount(getDb(), identity, async (_tx, profile) => ({ ...profile, email: identity.email }));
}
export async function requireAccount(workshop = false) {
  let account;
  try { account = await currentAccount(); }
  catch (error) {
    if (error instanceof AccessError) redirect(error.code === "UNAUTHORIZED" ? "/login" : "/account-blocked");
    redirect("/unavailable");
  }
  if (workshop && !account.hasWorkshop) redirect("/workshop-required");
  return account;
}
