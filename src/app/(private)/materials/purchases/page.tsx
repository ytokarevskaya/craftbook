import { requireAccount } from "@/server/account";
import { EmptyState } from "@/components/empty-state";
export default async function Page() { await requireAccount(true); return <section className="panel section-empty"><EmptyState icon="box" title="Zde budou vaše nákupy" description="Nákupy propojí materiály s jejich pořizovací cenou a přílohami."/></section>; }
