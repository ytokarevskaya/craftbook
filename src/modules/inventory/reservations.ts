import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DocumentDeps } from '../documents/service';
import { reservationTargets,type ReservationTarget } from './reservation-input';
import { withInventory,operationTx,rows,item,balance,movement,physical,snapshot,InventoryError,type Tx,type Item,type Balance } from './service';
import { zero,units,fixed,withdraw,type Amounts,scales,components } from './decimal';
export type Reservation={id:string;sequence:string;product_id:string;product_material_id:string;item_id:string;quantity:string;known_quantity:string;unknown_quantity:string;known_value:string;remaining_quantity:string;remaining_known_quantity:string;remaining_unknown_quantity:string;remaining_known_value:string;status:string;card_snapshot:Record<string,string>};
type M={id:string;type:string;unit:string;planned_quantity:string|null;requirements_json:Record<string,string>;inventory_item_id:string|null};
function negateFree(a:Amounts){const b=zero();for(const k of components.filter(k=>k.startsWith('free_')))b[k]=fixed(-units(a[k],scales[k]),scales[k]);return b;}
function transfer(a:Amounts){const b={...a};for(const suffix of ['quantity','known_quantity','unknown_quantity','known_value'] as const)b[`reserved_${suffix}`]=fixed(-units(a[`free_${suffix}`],scales[`free_${suffix}`]),scales[`free_${suffix}`]);return b;}
function remaining(r:Reservation):Amounts{return {...zero(),free_quantity:r.remaining_quantity,free_known_quantity:r.remaining_known_quantity,free_unknown_quantity:r.remaining_unknown_quantity,free_known_value:r.remaining_known_value};}
export async function applyReservations(tx:Tx,owner:string,productId:string,targets:ReservationTarget[],op:string,starting=false){
 const materials=await rows<M>(tx,sql`select * from app.product_material where product_id=${productId} order by id for update`);
 if(materials.length!==targets.length||targets.some(t=>!materials.some(m=>m.id===t.materialId)))throw new InventoryError('INVALID_MAPPING',400);
 const parts=await rows<Reservation>(tx,sql`select * from app.reservation where product_id=${productId} order by sequence desc for update`);
 const ids=[...new Set([...targets.flatMap(t=>t.itemId?[t.itemId]:[]),...parts.filter(r=>units(r.remaining_quantity,3)>0n).map(r=>r.item_id)])].sort(),cards=new Map<string,Item>(),balances=new Map<string,Balance>();
 for(const id of ids){cards.set(id,await item(tx,id));balances.set(id,await balance(tx,id));}
 const pending:{t:ReservationTarget;m:M;increase:bigint}[]=[];
 for(const t of targets){const m=materials.find(m=>m.id===t.materialId)!;
  if(t.reserveEnabled&&(t.itemId===null||t.quantity===null||units(t.quantity,3)<=0n))throw new InventoryError('INVALID_MAPPING',400);
  if(t.quantity!==null&&m.unit==='ks'&&units(t.quantity,3)%1000n!==0n)throw new InventoryError('WHOLE_PIECES',400);
  if(t.itemId){const card=cards.get(t.itemId)!;if(card.archived_at&&(starting||m.inventory_item_id!==t.itemId))throw new InventoryError('ARCHIVED');if(card.type!==m.type||card.unit!==m.unit)throw new InventoryError('INCOMPATIBLE_MATERIAL',400);if(!t.confirmed||t.cardVersion!==card.row_version)throw new InventoryError('MAPPING_CONFIRMATION');for(const k of ['alloy','fineness','form','profile','dimensions'] as const)if(m.requirements_json[k]&&m.requirements_json[k]!==card[k])throw new InventoryError('INCOMPATIBLE_MATERIAL',400);if(t.quantity!==null)physical(card,t.quantity);}
  const active=parts.filter(r=>r.product_material_id===m.id&&units(r.remaining_quantity,3)>0n),sameCard=active.every(r=>r.item_id===t.itemId),desired=t.reserveEnabled&&t.quantity!==null?units(t.quantity,3):0n,current=active.reduce((n,r)=>n+units(r.remaining_quantity,3),0n);
  let release=sameCard?(current>desired?current-desired:0n):current;
  for(const r of active){if(release===0n)break;const available=units(r.remaining_quantity,3),amount=release<available?release:available,q=fixed(amount,3),out=withdraw(remaining(r),q),back=negateFree(out),delta=transfer(back);await movement(tx,cards.get(r.item_id)!,balances.get(r.item_id)!,delta,op,'release','Uvolnění rezervace',null,null,r.id,productId);
   const next={quantity:fixed(available-amount,3),known:fixed(units(r.remaining_known_quantity,15)+units(out.free_known_quantity,15),15),unknown:fixed(units(r.remaining_unknown_quantity,15)+units(out.free_unknown_quantity,15),15),value:fixed(units(r.remaining_known_value,6)+units(out.free_known_value,6),6)};
   await tx.execute(sql`update app.reservation set remaining_quantity=${next.quantity},remaining_known_quantity=${next.known},remaining_unknown_quantity=${next.unknown},remaining_known_value=${next.value},status=${available===amount?'released':'active'},updated_at=clock_timestamp() where id=${r.id}`);release-=amount;
  }
  pending.push({t,m,increase:desired-(sameCard?(current<desired?current:desired):0n)});
 }
 for(const {t,m,increase} of pending){
  if(increase>0n){const card=cards.get(t.itemId!)!;if(card.archived_at)throw new InventoryError('ARCHIVED');const b=balances.get(card.id)!,q=fixed(increase,3);let out:Amounts;try{out=withdraw(b,q);}catch{throw new InventoryError('STOCK_SHORTAGE');}const amount=negateFree(out),id=randomUUID(),snap=JSON.stringify(snapshot(card));await tx.execute(sql`insert into app.reservation(id,owner_id,product_id,product_material_id,item_id,operation_id,quantity,known_quantity,unknown_quantity,known_value,remaining_quantity,remaining_known_quantity,remaining_unknown_quantity,remaining_known_value,status,card_snapshot) values(${id},${owner},${productId},${m.id},${card.id},${op},${q},${amount.free_known_quantity},${amount.free_unknown_quantity},${amount.free_known_value},${q},${amount.free_known_quantity},${amount.free_unknown_quantity},${amount.free_known_value},'active',${snap}::jsonb)`);await movement(tx,card,b,transfer(out),op,'reserve','Rezervace pro výrobek',null,null,id,productId);}
  await tx.execute(sql`update app.product_material set inventory_item_id=${t.itemId},reserve_enabled=${t.reserveEnabled},card_snapshot=${t.itemId?JSON.stringify(snapshot(cards.get(t.itemId)!)):null}::jsonb where id=${m.id} and product_id=${productId}`);
 }
}
const updateInput=z.object({requestKey:z.uuid(),version:z.number().int().positive(),targets:reservationTargets}).strict();
export async function updateReservations(d:DocumentDeps,productId:string,raw:unknown){z.uuid().parse(productId);const v=updateInput.parse(raw);v.targets.sort((a,b)=>a.materialId.localeCompare(b.materialId));return withInventory(d,async tx=>{const [p]=await rows<{source:string;status:string;row_version:number;archived_at:string|null}>(tx,sql`select * from app.product where id=${productId} for update`);if(!p)throw new InventoryError('NOT_FOUND',404);if(p.archived_at)throw new InventoryError('ARCHIVED_PRODUCT');if(p.source!=='own'||p.status!=='in_progress')throw new InventoryError('STATE');return operationTx(tx,d.identity.userId,'reservations',v.requestKey,{productId,...v},async op=>{if(p.row_version!==v.version)throw new InventoryError('CONFLICT');await applyReservations(tx,d.identity.userId,productId,v.targets,op);await tx.execute(sql`update app.product set row_version=row_version+1,updated_at=clock_timestamp() where id=${productId}`);});});}
export async function listReservations(d:DocumentDeps,itemId?:string){if(itemId)z.uuid().parse(itemId);return withInventory(d,tx=>rows<Reservation&{title:string}>(tx,sql`select r.*,p.title from app.reservation r join app.product p on p.id=r.product_id where r.status='active' ${itemId?sql`and r.item_id=${itemId}`:sql``} order by r.sequence`));}

export async function reservationCards(d:DocumentDeps){return withInventory(d,tx=>rows<Item&{free_quantity:string}>(tx,sql`select i.*,b.free_quantity from app.inventory_item i join app.inventory_balance b on b.item_id=i.id order by i.name,i.id`));}
