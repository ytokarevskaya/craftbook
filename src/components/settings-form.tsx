"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function SettingsForm({ profile }: { profile: { displayName: string; hasWorkshop: boolean; email: string } }) {
 const router = useRouter();
 const [pending, setPending] = useState(false);
 const busy = useRef(false);
 const [message, setMessage] = useState("");
 const [failed, setFailed] = useState(false);
 const status = useRef<HTMLParagraphElement>(null);
 useEffect(() => { if (message && !pending) status.current?.focus(); }, [message, pending]);
 return <form onSubmit={async event => {
  event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true); setMessage("");
  const data = new FormData(event.currentTarget);
  try {
   const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: data.get("displayName"), hasWorkshop: data.has("hasWorkshop") }) });
   const result = await response.json(); setFailed(!response.ok);
   setMessage(response.ok ? "Nastavení bylo uloženo." : result.message);
   if (response.ok) router.refresh();
  } catch { setFailed(true); setMessage("Uložení se nezdařilo. Zkuste to prosím znovu."); }
  busy.current = false; setPending(false);
 }} aria-busy={pending}><section className="panel settings-panel"><h2>Profil</h2><div className="field-row"><label htmlFor="display-name">Zobrazované jméno</label><input id="display-name" name="displayName" autoComplete="nickname" maxLength={80} defaultValue={profile.displayName}/></div><div className="field-row"><label htmlFor="profile-email">E-mail <span className="muted small">(pouze pro čtení)</span></label><input id="profile-email" type="email" readOnly value={profile.email}/></div></section><section className="panel settings-panel"><h2>Moje dílna</h2><div className="workshop-row"><div><label htmlFor="workshop">Mám vlastní dílnu</label><p className="muted small">Zpřístupní sekci Materiály. Evidence zásob bude dostupná v další etapě.</p></div><input id="workshop" name="hasWorkshop" className="switch" type="checkbox" role="switch" defaultChecked={profile.hasWorkshop}/></div></section>{message && <p ref={status} tabIndex={-1} role={failed ? "alert" : "status"} className={failed ? "form-error" : "notice"}>{message}</p>}<div className="field-action"><button className="button primary" disabled={pending}>{pending ? "Ukládám…" : "Uložit změny"}</button></div></form>;
}
