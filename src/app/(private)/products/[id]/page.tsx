import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProduct } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { ProductView } from '@/components/workshop/product-view';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const detail=await getProduct(await workDeps(),(await params).id);return <><PageHeading title={detail.product.title} description="Jeden výrobek nebo logický celek · školní materiál"/><ProductView detail={detail}/></>;}
