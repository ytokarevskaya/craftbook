import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { MaterialNavigation } from "@/components/material-navigation";
export const metadata = { title: "Materiály" };
export default function MaterialsLayout({children}: {children: React.ReactNode}) {
 return <><PageHeading title="Materiály" description="Zásoby, nákupy a historie vlastních materiálů."/><p className="notice">Náhled struktury. Evidence materiálu bude dostupná pouze s vlastní dílnou. Její nastavení je zatím neaktivní v <Link href="/settings">Nastavení</Link>.</p><MaterialNavigation/>{children}</>;
}
