import { z } from "zod";
import { createAuthClient } from "@/server/supabase";
import { currentAccount } from "@/server/account";
import { assertOrigin, readJson, failure, json } from "@/server/http";
import { AccessError } from "@/modules/identity/errors";
const input = z.object({ email: z.email().max(254), password: z.string().min(1).max(1024) }).strict();
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const credentials = input.safeParse(await readJson(request));
    if (!credentials.success) return json({ message: "Zkontrolujte e-mail a heslo." }, 400);
    const client = await createAuthClient();
    const { error } = await client.auth.signInWithPassword(credentials.data);
    if (error) return json({ message: "Přihlášení se nezdařilo. Zkontrolujte e-mail a heslo a zkuste to znovu." }, 401);
    try { await currentAccount(); }
    catch (error) { if (error instanceof AccessError && error.code === "ACCOUNT_BLOCKED") return json({ redirect: "/account-blocked" }); throw error; }
    // Fixed internal destination: no open redirects from user-controlled return URLs.
    return json({ redirect: "/" });
  } catch (error) { return failure(error); }
}
