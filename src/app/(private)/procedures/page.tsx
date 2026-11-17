import Link from 'next/link';
import { requireAccount } from '@/server/account';
import { PageHeading } from '@/components/page-heading';
import { WorkList } from '@/components/workshop/list';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){await requireAccount();const s=await searchParams;return <><PageHeading title="Pracovní postupy" description="Vaše vzory, textové kroky a materiálové požadavky."/><Link className="primary-button" href="/procedures/new">Nový pracovní postup</Link><WorkList kind="procedure" q={s.q} page={Math.max(1,Math.floor(Number(s.page)||1))}/></>;}
