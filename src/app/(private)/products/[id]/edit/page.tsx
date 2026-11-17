import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProduct,productPlan } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { PlanForm } from '@/components/workshop/plan-form';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const d=await getProduct(await workDeps(),(await params).id),p=d.product;return <><PageHeading title="Upravit pracovní návrh" description="Měníte konkrétní výrobek. Vzor a původní potvrzená kopie zůstávají zachované."/>{p.status==='done'?<p>Dokončený výrobek má kroky pouze pro čtení.</p>:<PlanForm mode="product" source={p.source} initial={productPlan(d)} recordId={p.id} version={p.row_version} procedureId={p.procedure_id} procedureRevision={p.procedure_revision} attachments={d.attachments.filter(a=>a.role==='attachment')}/>}</>;}
