/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation clears private router cache after mutation. */
'use client';
import { useState } from 'react';
import { api } from './upload';
export function DeleteDocument({id,version}:{id:string;version:number}){const [error,setError]=useState('');const [busy,setBusy]=useState(false);return <><button disabled={busy} onClick={async()=>{if(!window.confirm('Opravdu smazat dokument? Tuto akci nelze vrátit.'))return;setBusy(true);try{await api(`/api/documents/${id}`,{version},'DELETE');window.location.assign('/documents');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Smazat dokument</button>{error&&<p role="alert">{error}</p>}</>;}
