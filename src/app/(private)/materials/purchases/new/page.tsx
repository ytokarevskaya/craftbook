import { requireAccount } from '@/server/account';
import { inventoryDeps } from '@/server/inventory';
import { withInventory } from '@/modules/inventory/service';
import { sql } from 'drizzle-orm';
import { PurchaseForm } from '@/components/inventory/purchase-form';
export default async function Page(){await requireAccount(true);const items=await withInventory(await inventoryDeps(),async tx=>(await tx.execute<{id:string;name:string;unit:string}>(sql`select id,name,unit from app.inventory_item where archived_at is null order by name,id`)).rows);return <><h2>Nový nákup</h2>{items.length?<PurchaseForm items={items}/>:<p>Nejprve založte materiálovou kartu v Zásobách.</p>}</>;}
