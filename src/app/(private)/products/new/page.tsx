import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProcedure } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { PlanForm } from '@/components/workshop/plan-form';
export default async function Page({searchParams}:{searchParams:Promise<{procedure?:string}>}){const account=await requireAccount();const s=await searchParams,p=s.procedure?await getProcedure(await workDeps(),s.procedure):null;return <><PageHeading title={p?'Výrobek z pracovního postupu':'Výrobek bez pracovního postupu'} description="Návrh můžete upravit; původní vzor se nezmění."/>{p?.archived_at?<p>Archivovaný postup nelze použít pro nový výrobek.</p>:<PlanForm mode="product" allowOwn={account.hasWorkshop} initial={p?.plan} procedureId={p?.id} procedureRevision={p?.revision_counter} attachments={p?.attachments}/>}</>;}
