"use client";
import { useEffect, useRef, useState } from "react";
export function LoginForm() {
 const [pending, setPending] = useState(false);
 const busy = useRef(false);
 const [error, setError] = useState("");
 const alert = useRef<HTMLParagraphElement>(null);
 useEffect(() => { if (error && !pending) alert.current?.focus(); }, [error, pending]);
 return <form className="login-fields" onSubmit={async event => {
   event.preventDefault(); if (busy.current) return;
   busy.current = true; setPending(true); setError("");
   const data = new FormData(event.currentTarget);
   try {
     const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
     const result = await response.json();
     if (!response.ok) { setError(result.message); }
     else { window.location.assign(result.redirect === "/change-password" ? "/change-password" : result.redirect === "/account-blocked" ? "/account-blocked" : "/"); return; }
   } catch { setError("Služba nyní není dostupná. Zkuste to prosím znovu."); }
   busy.current = false; setPending(false);
 }} aria-busy={pending}>
 <label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} aria-describedby={error ? "login-error" : undefined}/>
 <label htmlFor="password">Heslo</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} aria-describedby={error ? "login-error" : undefined}/>
 {error && <p id="login-error" className="form-error" role="alert" tabIndex={-1} ref={alert}>{error}</p>}
 <button className="button primary" disabled={pending}>{pending ? "Přihlašuji…" : "Přihlásit se"}</button>
 </form>;
}
