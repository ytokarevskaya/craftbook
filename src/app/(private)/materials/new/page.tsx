import { requireAccount } from '@/server/account';
import { ItemForm } from '@/components/inventory/forms';
export default async function Page(){await requireAccount(true);return <><h2>Nová karta materiálu</h2><ItemForm/></>;}
