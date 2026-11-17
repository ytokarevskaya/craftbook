import Link from 'next/link';
import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProduct,proposal } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { PlanForm } from '@/components/workshop/plan-form';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const d=await getProduct(await workDeps(),(await params).id),p=d.product;return <><PageHeading title="Uložit jako pracovní postup" description="Dobrovolný nový vzor. Dokončení ani cenu výrobku tím nezměníte."/>{p.saved_procedure_id?<Link href={`/procedures/${p.saved_procedure_id}`}>Otevřít již uložený postup</Link>:p.status==='done'&&p.created_without_procedure?<><p>Množství vychází ze známé potvrzené vstupní spotřeby; jinak z plánu, jinak zůstává neznámé. Nejde automaticky o čistou hmotnost hotového šperku. Vše můžete upravit. Checkboxy, fotografie, deník ani cena se nepřenášejí.</p><PlanForm mode="from-product" initial={proposal(d)} productId={p.id} version={p.row_version}/></>:<p>Nabídka je dostupná pouze pro dokončený výrobek vytvořený bez vzoru.</p>}</>;}
