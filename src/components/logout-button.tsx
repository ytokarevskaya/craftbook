"use client";
import { useState } from "react";
import { Icon } from "./icon";
export function LogoutButton() {
 const [pending, setPending] = useState(false);
 const [error, setError] = useState("");
 return <><button className="nav-link" disabled={pending} onClick={async () => {
   setPending(true); setError("");
   try { const response = await fetch("/api/auth/logout", { method: "POST" });
     if (!response.ok) throw new Error();
     // Discard the previous account’s in-memory Router Cache on logout.
     // eslint-disable-next-line @next/next/no-location-assign-relative-destination
     window.location.assign("/login");
   } catch { setError("Odhlášení se nezdařilo. Zkuste to znovu."); setPending(false); }
 }}><Icon name="logout"/>{pending ? "Odhlašuji…" : "Odhlásit se"}</button>{error && <p className="form-error" role="alert">{error}</p>}</>;
}
