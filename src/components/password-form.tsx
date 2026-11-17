"use client";
import { useEffect, useRef, useState } from "react";
export function PasswordForm({ mandatory=false }: { mandatory?: boolean }) {
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const busy=useRef(false);
  const message=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(error&&!pending)message.current?.focus();},[error,pending]);
  return <form className="login-fields" aria-busy={pending} onSubmit={async event=>{
    event.preventDefault(); if(busy.current)return;
    const form=event.currentTarget;
    const values=new FormData(form);
    busy.current=true; setPending(true); setError("");
    try {
      const response=await fetch('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        newPassword:values.get('newPassword'),confirmation:values.get('confirmation'),
        ...(!mandatory?{currentPassword:values.get('currentPassword')}:{})
      })});
      const data=await response.json();
      if(response.ok){
        form.reset();
        // A new document discards all cached data from the invalidated account session.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/login?password=changed');return;
      }
      setError(data.message || 'Změna hesla se nezdařila.');
    } catch { setError('Služba nyní není dostupná. Pokud už změna začala, obraťte se na provozovatele kvůli bezpečné obnově přístupu.'); }
    form.reset(); busy.current=false; setPending(false);
  }}>
    <p id="password-rules" className="muted">Použijte alespoň 12 znaků, nejvýše 72 bajtů UTF-8 (znaky s diakritikou mohou zabrat více bajtů). Po změně budete odhlášeni ze všech zařízení a přihlásíte se novým heslem.</p>
    {!mandatory&&<><label htmlFor="current-password">Současné heslo</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024}/></>}
    <label htmlFor="new-password">Nové heslo</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} aria-describedby="password-rules"/>
    <label htmlFor="confirm-password">Potvrzení nového hesla</label><input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72}/>
    {error&&<p ref={message} role="alert" tabIndex={-1} className="form-error">{error}</p>}
    <button className="button primary" disabled={pending}>{pending?'Měním heslo…':'Změnit heslo'}</button>
  </form>;
}
