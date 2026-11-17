import { Brand } from "@/components/shell";
import { LoginForm } from "@/components/login-form";
export const metadata = { title: "Přihlášení" };
export default async function Login({ searchParams }: { searchParams: Promise<{password?:string}> }) {
 const changed=(await searchParams).password==="changed";
 return <main className="login-page"><div className="login-wrap"><Brand/><section className="panel login-panel" aria-labelledby="login-title"><h1 id="login-title">Přihlášení</h1><p className="muted">Vítejte zpět. Přihlaste se ke své knize.</p>{changed&&<p className="notice" role="status">Heslo bylo změněno. Přihlaste se novým heslem.</p>}<LoginForm/><p className="small muted">Craftbook je soukromá aplikace. Účet vám připraví provozovatel. Pokud se nemůžete přihlásit, obraťte se na něj.</p></section></div></main>;
}
