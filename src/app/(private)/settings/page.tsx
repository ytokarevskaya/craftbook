import { PageHeading } from "@/components/page-heading";
import { SettingsForm } from "@/components/settings-form";
import { requireAccount } from "@/server/account";
export const metadata = { title: "Nastavení" };
export default async function Settings() {
 const profile = await requireAccount();
 return <><PageHeading title="Nastavení" description="Váš profil, vlastní dílna a zabezpečení účtu."/><SettingsForm profile={profile}/><section className="panel settings-panel password-panel"><h2>Zabezpečení</h2><p className="muted">Změna a obnova hesla budou dostupné v etapě 3. Pokud potřebujete pomoc s přístupem, obraťte se na provozovatele.</p><button className="button primary" disabled>Změnit heslo</button></section></>;
}
