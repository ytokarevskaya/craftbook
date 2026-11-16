import Link from "next/link";
export default function NotFound() { return <section className="panel not-found"><span className="badge">404</span><h1>Stránka nebyla nalezena</h1><p>Zkontrolujte adresu nebo se vraťte na přehled.</p><Link className="button primary" href="/">Zpět na přehled</Link></section>; }
