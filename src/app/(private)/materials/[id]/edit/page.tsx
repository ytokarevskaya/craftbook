import { requireAccount } from '@/server/account';
import { inventoryDeps } from '@/server/inventory';
import { getItem } from '@/modules/inventory/service';
import { ItemForm } from '@/components/inventory/forms';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount(true);const d=await getItem(await inventoryDeps(),(await params).id);return <><h2>Upravit kartu</h2><p>Po prvním pohybu lze opravit název a popis. Pro jinou fyzickou specifikaci založte novou kartu.</p><ItemForm initial={d.item}/></>;}
