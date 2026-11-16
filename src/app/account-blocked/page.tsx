import { redirect } from "next/navigation";
import { Brand } from "@/components/shell";
import { LogoutButton } from "@/components/logout-button";
import { verifyIdentity } from "@/modules/identity/service";
import { createAuthClient } from "@/server/supabase";
export const dynamic = "force-dynamic";
export default async function Blocked() {
 try { await verifyIdentity(await createAuthClient()); } catch { redirect("/login"); }
 return <main className="login-page"><div className="login-wrap"><Brand/><section className="panel login-panel"><h1>Přístup zatím není povolen</h1><p>Účet není úplně připravený, je neaktivní nebo vyžaduje obnovení přístupu. Obraťte se na provozovatele.</p><p className="muted">Změna dočasného hesla a reset budou dostupné v etapě 3.</p><LogoutButton/></section></div></main>;
}
