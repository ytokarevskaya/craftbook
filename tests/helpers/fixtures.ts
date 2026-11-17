import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localConnections, provision } from "../../scripts/local-common";
export async function fixtures() {
  const connections = localConnections();
  const ids: string[] = [];
  async function create(ready = true) {
    const email = `craftbook-test-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString("base64url");
    const { data, error } = await connections.admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Vytvoření izolované testovací identity selhalo.");
    const id = data.user.id; ids.push(id);
    if (ready) await provision(connections.migration, id, true);
    const auth = createClient(connections.authUrl, connections.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return { id, email, password, auth };
  }
  async function cleanup() {
    // Only IDs created during this test run; never delete by email pattern or reset DB.
    for (const id of ids) {
      const { error } = await connections.admin.auth.admin.deleteUser(id);
      if (error && error.status!==404) throw new Error("Úklid vlastní testovací identity selhal.");
      await connections.migration.query("delete from app.account_provision_operation where target_id=$1",[id]);
    }
    await connections.runtime.end(); await connections.migration.end();
  }
  return { ...connections, create, cleanup, track: (id:string) => { ids.push(id); } };
}
