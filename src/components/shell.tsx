"use client";

import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./icon";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Přehled", icon: "home" },
  { href: "/documents", label: "Dokumenty", icon: "document" },
  { href: "/procedures", label: "Pracovní postupy", icon: "layers" },
  { href: "/products", label: "Výrobky", icon: "ring" },
  { href: "/materials", label: "Materiály", icon: "box" },
];
export function Brand() {
  return <div className="brand"><Link href="/" className="wordmark">Craftbook</Link><p>Jedna kniha vládne všem.</p></div>;
}
export function Shell({ children, account }: { children: React.ReactNode; account: { displayName: string; hasWorkshop: boolean } }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  function closeMenu() { dialog.current?.close(); }
  function keepMenuFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const items = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }
  useEffect(() => {
    const media = window.matchMedia("(min-width: 800px)");
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  function navLink(href: string, label: string, icon: IconName) {
    const active = href === "/" ? pathname === href : pathname.startsWith(href);
    return <Link key={href} href={href} className="nav-link" aria-current={active ? "page" : undefined} onClick={closeMenu}><Icon name={icon}/><span>{label}</span></Link>;
  }
  function navigationContent() {
    return <><Brand/><nav aria-label="Hlavní navigace" className="main-nav">{navigation.filter(item => item.href !== "/materials" || account.hasWorkshop).map(item => navLink(item.href, item.label, item.icon))}</nav><div className="sidebar-bottom"><nav aria-label="Účet">{navLink("/settings", "Nastavení", "settings")}</nav><div className="account-preview"><span className="status-dot"/><span>{account.displayName || "Můj účet"}</span></div><LogoutButton/></div></>;
  }
  return <><a className="skip-link" href="#main">Přeskočit na obsah</a><aside className="sidebar">{navigationContent()}</aside><header className="mobile-header"><button className="icon-button" aria-label="Otevřít menu" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => { dialog.current?.showModal(); setMenuOpen(true); }}><Icon name="menu"/></button><Brand/></header><dialog ref={dialog} id="mobile-menu" className="mobile-drawer" aria-label="Navigace" onKeyDown={keepMenuFocus} onClose={() => setMenuOpen(false)} onClick={event => { if(event.target === event.currentTarget) closeMenu(); }}><div className="drawer-content"><button className="icon-button drawer-close" aria-label="Zavřít menu" onClick={closeMenu}><Icon name="close"/></button>{navigationContent()}</div></dialog><div className="workspace"><div className="preview-bar"><span><span className="status-dot"/>Soukromá kniha</span><Link href="/settings">Můj účet</Link></div><main id="main" tabIndex={-1}>{children}</main><footer>Craftbook <span>Vaše místo pro tvorbu</span></footer></div></>;
}
