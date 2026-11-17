import { requireAccount } from "@/server/account";
import { PageHeading } from "@/components/page-heading";
import { MaterialNavigation } from "@/components/material-navigation";
export const metadata = { title: "Materiály" };
export default async function MaterialsLayout({children}: {children: React.ReactNode}) {
 await requireAccount(true);
 return <><PageHeading title="Materiály" description="Zásoby, nákupy a historie vlastních materiálů."/><MaterialNavigation/>{children}</>;
}
