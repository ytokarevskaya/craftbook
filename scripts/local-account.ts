import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { localConnections, provision } from "./local-common";
async function main() {
  if (!process.stdin.isTTY || process.argv.length > 2) throw new Error("Spusťte interaktivně bez argumentů. Heslo nezadávejte do příkazové řádky.");
  const { admin, migration, runtime } = localConnections();
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const email = (await prompt.question("E-mail lokálního vývojového účtu: ")).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Neplatný e-mail.");
    process.stdout.write("Heslo (nejméně 12 znaků, vstup skrytý): "); muted = true;
    const password = await prompt.question(""); muted = false; process.stdout.write("\n");
    if (password.length < 12) throw new Error("Heslo musí mít nejméně 12 znaků.");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Účet se nepodařilo vytvořit; může už existovat. Existující účet ani heslo nebyly změněny.");
    try { await provision(migration, data.user.id, true); }
    catch { console.error(`Identita vytvořena bez přístupu. Auth ID pro lokální provisioning: ${data.user.id}`); throw new Error("Provisioning selhal. Opakujte local:provision pro toto ID; výsledkem bude bezpečně pending účet, jeho aktivace patří provozní nápravě v etapě 3."); }
    console.log("Aktivní lokální vývojový účet připraven. Přihlaste se vlastním zadaným heslem. Toto není produkční onboarding.");
  } finally { prompt.close(); await migration.end(); await runtime.end(); }
}
main().catch(() => { console.error("Vytvoření lokálního účtu se nezdařilo. Ověřte lokální konfiguraci, platný e-mail, délku hesla a zda účet již neexistuje. Existující hesla se nemění."); process.exitCode = 1; });
