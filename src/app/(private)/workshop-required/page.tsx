import Link from "next/link";
import { requireAccount } from "@/server/account";
export default async function WorkshopRequired() { await requireAccount(); return <section className="panel not-found"><h1>Materiály vyžadují vlastní dílnu</h1><p>Vlastní dílnu můžete zapnout v nastavení svého účtu.</p><Link href="/settings">Otevřít nastavení</Link></section>; }
