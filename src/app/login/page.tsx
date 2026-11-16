import { Brand } from "@/components/shell";
import { LoginForm } from "@/components/login-form";
export const metadata = { title: "Přihlášení" };
export default function Login() {
 return <main className="login-page"><div className="login-wrap"><Brand/><section className="panel login-panel" aria-labelledby="login-title"><h1 id="login-title">Přihlášení</h1><p className="muted">Vítejte zpět. Přihlaste se ke své knize.</p><LoginForm/><p className="small muted">Craftbook je soukromá aplikace. Účet vám připraví provozovatel. Pokud se nemůžete přihlásit, obraťte se na něj.</p></section></div></main>;
}
