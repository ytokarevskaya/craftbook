import Link from 'next/link';
import { requireAccount } from '@/server/account';
import { PageHeading } from '@/components/page-heading';
import { WorkList } from '@/components/workshop/list';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;page?:string;status?:string}>}){await requireAccount();const s=await searchParams;return <><PageHeading title="Výrobky" description="Školní tvorba od plánu přes deník až k hotovému šperku."/><div className="document-actions"><Link href="/procedures">Z pracovního postupu</Link><Link className="primary-button" href="/products/new">Bez pracovního postupu</Link></div><p>V této etapě pracujete se školním materiálem. Vlastní skladová výroba bude dostupná později.</p><WorkList kind="product" q={s.q} page={Math.max(1,Math.floor(Number(s.page)||1))} status={s.status}/></>;}
