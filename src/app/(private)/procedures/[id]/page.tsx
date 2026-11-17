import Link from 'next/link';
import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProcedure } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { PlanRead } from '@/components/workshop/plan-read';
import { ArchiveProcedure } from '@/components/workshop/archive';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const p=await getProcedure(await workDeps(),(await params).id);return <><PageHeading title={p.title} description={`Pracovní postup · revize ${p.revision_counter}${p.archived_at?' · archivovaný':''}`}/><div className="document-actions">{!p.archived_at&&<><Link href={`/products/new?procedure=${p.id}`}>Založit výrobek</Link><Link href={`/procedures/${p.id}/edit`}>Upravit postup</Link><ArchiveProcedure id={p.id} version={p.revision_counter}/></>}<Link href="/procedures">Všechny postupy</Link></div><section className="panel document-form"><PlanRead plan={p.plan}/></section></>;}
