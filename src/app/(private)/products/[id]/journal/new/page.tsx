import { requireAccount } from '@/server/account';
import { workDeps } from '@/server/workshop';
import { getProduct } from '@/modules/workshop/service';
import { PageHeading } from '@/components/page-heading';
import { NoteEditor } from '@/components/documents/editor';
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAccount();const {id}=await params;await getProduct(await workDeps(),id);return <><PageHeading title="Nový zápis do deníku" description="Zkušenosti, chyby i zpětná vazba — také po dokončení."/><NoteEditor journal={{productId:id,occurredAt:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague'}).format(new Date())}}/></>;}
