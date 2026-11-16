import { createAuthClient } from "@/server/supabase";
import { assertOrigin, failure, json } from "@/server/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const client = await createAuthClient();
    // Logout remains available to blocked and incomplete accounts.
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return json({ message: "Odhlášení se nezdařilo. Zkuste to znovu." }, 503);
    return json({ redirect: "/login" });
  } catch (error) { return failure(error); }
}
