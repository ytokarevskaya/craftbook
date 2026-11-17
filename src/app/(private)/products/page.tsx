import Link from 'next/link';
import { requireAccount } from '@/server/account';
import { PageHeading } from '@/components/page-heading';
import { WorkList } from '@/components/workshop/list';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;page?:string;status?:string;archived?:string}>}){await requireAccount();const s=await searchParams;return <><PageHeading title="Výrobky" description="Tvorba od plánu přes deník až k hotovému šperku."/><div className="document-actions"><Link href="/procedures">Z pracovního postupu</Link><Link className="primary-button" href="/products/new">Bez pracovního postupu</Link></div><p>Školní materiál nemění sklad. S vlastní dílnou můžete zvolit vlastní zásoby a potvrzenou spotřebu.</p><WorkList kind="product" q={s.q} page={Math.max(1,Math.floor(Number(s.page)||1))} status={s.status} includeArchived={s.archived==='1'}/></>;}
