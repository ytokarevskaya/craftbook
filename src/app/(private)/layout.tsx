import { Shell } from "@/components/shell";
import { requireAccount } from "@/server/account";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
 const account = await requireAccount();
 return <Shell account={account}>{children}</Shell>;
}
