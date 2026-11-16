import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
export default function Unavailable() { return <main className="login-page"><section className="panel login-panel"><h1>Služba není dostupná</h1><p>Přístup se nyní nepodařilo ověřit. Zkuste to prosím později.</p><Link href="/">Zkusit znovu</Link><LogoutButton/></section></main>; }
