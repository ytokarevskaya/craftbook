import Link from 'next/link';
import { requireAccount } from '@/server/account';
import { inventoryDeps } from '@/server/inventory';
import { listPurchases } from '@/modules/inventory/service';
import { formatMoney } from '@/modules/inventory/decimal';
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){await requireAccount(true);const page=Number((await searchParams).page??1),rows=await listPurchases(await inventoryDeps(),page);return <><h2>Nákupy</h2><Link className="primary-button" href="/materials/purchases/new">Nový nákup</Link>{rows.map(p=><article className="panel document-form" key={String(p.id)}><h3><Link href={'/materials/purchases/'+p.id}>{String(p.supplier)}</Link></h3><p>{String(p.business_date)} · {p.incomplete?'Neúplná cena, známá část: ':''}{formatMoney(String(p.known_cost??'0'))}</p></article>)}{!rows.length&&<p>Zatím žádné nákupy.</p>}<nav aria-label="Stránkování">{page>1&&<Link href={'?page='+(page-1)}>Předchozí</Link>}{rows.length===20&&<Link href={'?page='+(page+1)}>Další</Link>}</nav></>;}
