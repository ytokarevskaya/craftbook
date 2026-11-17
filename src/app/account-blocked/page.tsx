import { redirect } from "next/navigation";
import { Brand } from "@/components/shell";
import { LogoutButton } from "@/components/logout-button";
import { getPool } from "@/server/db";
import { passwordAccess } from "@/modules/identity/password-service";
import { verifyIdentity } from "@/modules/identity/service";
import { createAuthClient } from "@/server/supabase";
export const dynamic = "force-dynamic";
export default async function Blocked() {
 let access;
 try { access=await passwordAccess(getPool(),await verifyIdentity(await createAuthClient())); } catch { redirect("/login"); }
 if(access==="pending")redirect("/change-password");
 if(access==="active")redirect("/");
 return <main className="login-page"><div className="login-wrap"><Brand/><section className="panel login-panel"><h1>Přístup zatím není povolen</h1><p>Účet není úplně připravený, je neaktivní nebo vyžaduje obnovení přístupu. Obraťte se na provozovatele.</p><p className="muted">{access==="expired"?"Platnost dočasného přístupu vypršela. Vyžádejte si nové dočasné heslo od provozovatele.":"Pokud změna hesla nebyla dokončena, požádejte provozovatele o bezpečný reset přístupu."}</p><LogoutButton/></section></div></main>;
}
