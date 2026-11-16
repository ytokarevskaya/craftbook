import { requireAccount } from "@/server/account";
import { EmptyState } from "@/components/empty-state";
export default async function Page() { await requireAccount(true); return <section className="panel section-empty"><EmptyState icon="box" title="Zde bude přehled vašich zásob" description="Volné a rezervované materiály budou přehledně oddělené."/></section>; }
