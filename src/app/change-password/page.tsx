import { redirect } from "next/navigation";
import { Brand } from "@/components/shell";
import { PasswordForm } from "@/components/password-form";
import { LogoutButton } from "@/components/logout-button";
import { verifyIdentity } from "@/modules/identity/service";
import { passwordAccess } from "@/modules/identity/password-service";
import { getPool } from "@/server/db";
import { createAuthClient } from "@/server/supabase";
export const dynamic="force-dynamic";
export default async function ChangePassword() {
  let access;
  try { access=await passwordAccess(getPool(),await verifyIdentity(await createAuthClient())); }
  catch { redirect('/login'); }
  if(access==='active')redirect('/settings');
  if(access!=='pending')redirect('/account-blocked');
  return <main className="login-page"><div className="login-wrap"><Brand/><section className="panel login-panel"><h1>Změňte dočasné heslo</h1><p>Než otevřete svou knihu, nastavte si vlastní heslo.</p><PasswordForm mandatory/><LogoutButton/></section></div></main>;
}
