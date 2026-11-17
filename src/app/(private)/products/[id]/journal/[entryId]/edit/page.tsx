import { notFound } from 'next/navigation';
import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProduct } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { NoteEditor } from '@/components/documents/editor';
export default async function Page({params}:{params:Promise<{id:string;entryId:string}>}){await requireAccount();const {id,entryId}=await params,d=await getProduct(await workDeps(),id),j=d.journal.find(a=>a.id===entryId);if(!j)notFound();return <><PageHeading title="Upravit zápis v deníku" description="Změna zápisu nemění původní plán ani dokončení výrobku."/><NoteEditor initial={{id:j.id,title:'',body:j.body_json,version:j.row_version}} journal={{productId:id,occurredAt:j.occurred_at}}/></>;}
