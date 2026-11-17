import { requireAccount } from '@/server/account';
import { PageHeading } from '@/components/page-heading';
import { PlanForm } from '@/components/workshop/plan-form';
export default async function Page(){await requireAccount();return <><PageHeading title="Nový pracovní postup" description="Kroky i množství mohou zůstat neúplné."/><PlanForm mode="procedure"/></>;}
