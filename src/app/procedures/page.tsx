import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
export const metadata = { title: "Pracovní postupy" };
export default function Page() { return <><PageHeading title="Pracovní postupy" description="Od prvního nápadu k postupu, ke kterému se můžete vrátit."/><section className="panel section-empty"><EmptyState icon="layers" title="Každý postup začíná prvním krokem" description="Zde budou vaše textové kroky, seznamy materiálů a přílohy."/></section></>; }
