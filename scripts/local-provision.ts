import { createInterface } from "node:readline/promises";
import { localConnections, provision } from "./local-common";
async function main() {
  const { migration, runtime } = localConnections();
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const id = (await prompt.question("Existující lokální Auth ID: ")).trim();
    const created = await provision(migration, id);
    console.log(created ? "Účet připraven ve stavu pending_password, bez běžného přístupu. Změna hesla bude v etapě 3." : "Účet již existuje. Stav, profil ani heslo nebyly změněny.");
  } finally { prompt.close(); await migration.end(); await runtime.end(); }
}
main().catch(() => { console.error("Provisioning se nezdařil. Ověřte lokální prostředí a Auth ID. Účet bez úplného profilu nemá přístup."); process.exitCode = 1; });
