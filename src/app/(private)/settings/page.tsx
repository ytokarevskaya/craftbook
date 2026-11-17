import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PasswordForm } from "@/components/password-form";
import { SettingsForm } from "@/components/settings-form";
import { requireAccount } from "@/server/account";
export const metadata = { title: "Nastavení" };
export default async function Settings() {
 const profile = await requireAccount();
 return <><PageHeading title="Nastavení" description="Váš profil, vlastní dílna a zabezpečení účtu."/><SettingsForm profile={profile}/><section className="panel settings-panel password-panel"><h2>Zabezpečení</h2><PasswordForm/></section><section className="panel settings-panel"><h2>Vlastní data</h2><p>Stáhněte své záznamy, historii a soukromé přílohy.</p><Link className="button secondary" href="/settings/export">Export vlastních dat</Link></section></>;
}
