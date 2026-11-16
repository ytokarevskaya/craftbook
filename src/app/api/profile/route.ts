import { currentAccount } from "@/server/account";
import { createAuthClient } from "@/server/supabase";
import { getDb } from "@/server/db";
import { verifyIdentity, updateProfile } from "@/modules/identity/service";
import { assertOrigin, readJson, failure, json } from "@/server/http";
export async function GET() {
  try { return json(await currentAccount()); } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    assertOrigin(request);
    const identity = await verifyIdentity(await createAuthClient());
    return json(await updateProfile(getDb(), identity, await readJson(request)));
  } catch (error) { return failure(error); }
}
