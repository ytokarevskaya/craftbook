"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function MaterialNavigation() {
 const pathname = usePathname();
 return <nav className="tabs" aria-label="Materiály">{[["/materials", "Zásoby"], ["/materials/purchases", "Nákupy"], ["/materials/movements", "Pohyby"]].map(([href,label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>;
}
