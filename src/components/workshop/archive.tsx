'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/components/documents/upload';
import { useState } from 'react';
export function ArchiveProcedure({id,version}:{id:string;version:number}){const router=useRouter(),[error,setError]=useState(''),[busy,setBusy]=useState(false);return <><button disabled={busy} onClick={async()=>{if(!window.confirm('Archivovat postup? Dosavadní výrobky zůstanou zachované.'))return;setBusy(true);try{await api(`/api/procedures/${id}/archive`,{version});router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Archivovat postup</button>{error&&<p role="alert">{error}</p>}</>;}
