import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
export const metadata = { title: "Dokumenty" };
export default function Page() { return <><PageHeading title="Dokumenty" description="Poznámky a podklady pro studium i práci v dílně."/><section className="panel section-empty"><EmptyState icon="document" title="Vaše poznámky budou mít své místo" description="Zde budete pracovat s poznámkami a přílohami PDF, DOCX a Markdown."/></section></>; }
