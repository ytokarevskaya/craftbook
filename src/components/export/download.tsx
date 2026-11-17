'use client';
import { useEffect, useRef, useState } from 'react';
class DownloadError extends Error {}
export function ExportDownload({href,label,primary=false}:{href:string;label:string;primary?:boolean}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null),alert=useRef<HTMLParagraphElement>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(error)alert.current?.focus();},[error]);
 async function download() {
  if(controller.current)return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setMessage('');
  const timer=setTimeout(()=>abort.abort(),96000);
  try {
   const response=await fetch(href,{cache:'no-store',signal:abort.signal});
   if(!response.ok){
    let message='Export se nezdařil. Zkuste jej znovu.';
    try{const result=await response.json();if(typeof result.message==='string')message=result.message;}catch{}
    throw new DownloadError(message);
   }
   const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=response.headers.get('content-disposition')?.match(/filename="([a-zA-Z0-9_.-]+)"/)?.[1]??'craftbook-export.zip';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage(response.headers.get('x-craftbook-export-complete')==='false'?'Stažení připraveno. Archiv není úplný včetně souborů: zkontrolujte manifest a stáhněte dostupné přílohy samostatně.':'Stažení připraveno.');
  } catch(e) {setError(abort.signal.aborted?'Export byl přerušen. Můžete jej opakovat.':e instanceof DownloadError?e.message:'Stažení se nezdařilo. Zkuste jej znovu.');}
  finally {clearTimeout(timer);controller.current=null;setBusy(false);}
 }
 return <div className="export-download" aria-busy={busy}>
  <button className={'button '+(primary?'primary':'secondary')} onClick={download} disabled={busy}>{busy?'Připravuji stažení…':label}</button>
  {busy&&<button className="button secondary" onClick={()=>controller.current?.abort()}>Zrušit export</button>}
  {error&&<p ref={alert} role="alert" tabIndex={-1} className="form-error">{error}</p>}
  {message&&<p role="status" className="muted small">{message}</p>}
 </div>;
}
