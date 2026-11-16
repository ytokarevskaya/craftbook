import Link from "next/link";
import { Brand } from "@/components/shell";
export const metadata = { title: "Přihlášení" };
export default function Login() {
 return <main className="login-page"><div className="login-wrap"><Brand/><section className="panel login-panel" aria-labelledby="login-title"><span className="badge">Lokální náhled · bez přihlášení</span><h1 id="login-title">Přihlášení</h1><p id="login-note" className="muted">Přihlášení zatím není zapojené. Pole i tlačítko jsou neaktivní; žádné údaje se neodesílají ani neukládají.</p><div className="login-fields" aria-describedby="login-note"><label htmlFor="email">E-mail</label><input id="email" type="email" disabled autoComplete="off"/><label htmlFor="password">Heslo</label><input id="password" type="password" disabled autoComplete="off"/><button className="button primary" disabled>Přihlásit se</button></div><p className="small muted">Craftbook je soukromá aplikace. Účty budou vytvářené provozovatelem; veřejná registrace není dostupná.</p></section><Link className="back-link" href="/">← Zpět na náhled rozhraní</Link></div></main>;
}
