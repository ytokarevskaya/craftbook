import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAccount } from '@/server/account';
import { documentDeps } from '@/server/documents';
import { getDocument,DocumentError } from '@/modules/documents/service';
import { PageHeading } from '@/components/page-heading';
import { NoteRenderer } from '@/components/documents/renderer';
import { DeleteDocument } from '@/components/documents/delete-button';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const {id}=await params;let d;try{d=await getDocument(await documentDeps(),id);}catch(e){if(e instanceof DocumentError&&e.status===404)notFound();throw e;}
 return <><PageHeading title={d.title} description={d.kind==='note'?'Poznámka':'Nahraný dokument'}/><div className="document-actions"><Link href={`/documents/${id}/edit`}>{d.kind==='note'?'Upravit poznámku':'Upravit název'}</Link><DeleteDocument id={id} version={d.row_version}/><Link href="/documents">Všechny dokumenty</Link></div><section className="panel document-form">{d.kind==='note'?<NoteRenderer body={d.body_json}/>:<><p>{d.original_name}</p><p className="muted">{d.mime} · {Math.ceil((d.bytes??0)/1024)} KiB</p><a className="primary-button" href={`/api/assets/${d.asset_id}/content`}>Stáhnout soubor</a></>}</section></>;
}
