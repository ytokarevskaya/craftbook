import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProcedure } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { PlanForm } from '@/components/workshop/plan-form';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const p=await getProcedure(await workDeps(),(await params).id);return <><PageHeading title="Upravit pracovní postup" description="Změna vzoru nepřepíše zahájené výrobky."/>{p.archived_at?<p>Archivovaný postup je pouze pro čtení.</p>:<PlanForm mode="procedure" initial={p.plan} recordId={p.id} version={p.revision_counter} attachments={p.attachments}/>}</>;}
