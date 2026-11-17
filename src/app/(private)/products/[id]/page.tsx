import { listReservations,reservationCards } from '@/modules/inventory/reservations';
import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProduct } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { ProductView } from '@/components/workshop/product-view';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const detail=await getProduct(await workDeps(),(await params).id);const own=detail.product.source==='own',cards=own?await reservationCards(await workDeps()):[],reservations=own?(await listReservations(await workDeps())).filter(r=>r.product_id===detail.product.id):[];return <><PageHeading title={detail.product.title} description={own?"Vlastní materiál · rezervace a skutečná spotřeba":"Jeden výrobek nebo logický celek · školní materiál"}/><ProductView detail={detail} cards={cards} reservations={reservations}/></>;}
