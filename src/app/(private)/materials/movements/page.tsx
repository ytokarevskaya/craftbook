import { requireAccount } from "@/server/account";
import { EmptyState } from "@/components/empty-state";
export default async function Page() { await requireAccount(true); return <section className="panel section-empty"><EmptyState icon="box" title="Zde bude historie pohybů" description="Příjmy, rezervace a spotřebu budete moci dohledat v historii."/></section>; }
