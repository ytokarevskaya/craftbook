import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
export const metadata = { title: "Výrobky" };
export default function Page() { return <><PageHeading title="Výrobky" description="Plánování, průběh práce a hotové šperky na jednom místě."/><section className="panel section-empty"><EmptyState icon="ring" title="Prostor pro vaši tvorbu" description="Zde budete sledovat výrobky od plánu přes rozpracování až po dokončení."/></section></>; }
