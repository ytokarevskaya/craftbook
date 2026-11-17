import { requireAccount } from '@/server/account';
import { documentDeps } from '@/server/documents';
import { getDocument } from '@/modules/documents/service';
import { PageHeading } from '@/components/page-heading';
import { NoteEditor } from '@/components/documents/editor';
import { FileForm } from '@/components/documents/file-form';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const d=await getDocument(await documentDeps(),(await params).id);return <><PageHeading description="Změny se uloží až po potvrzení." title={d.kind==='note'?'Upravit poznámku':'Upravit název dokumentu'}/>{d.kind==='note'?<NoteEditor initial={{id:d.id,title:d.title,body:d.body_json!,version:d.row_version}}/>:<FileForm initial={{id:d.id,title:d.title,assetId:d.asset_id!,version:d.row_version}}/>}</>;}
