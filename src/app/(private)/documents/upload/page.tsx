import { requireAccount } from '@/server/account';
import { PageHeading } from '@/components/page-heading';
import { FileForm } from '@/components/documents/file-form';
export default async function Page(){await requireAccount();return <><PageHeading title="Nahrát dokument" description="Soukromé přílohy PDF, DOCX a Markdown."/><FileForm/></>;}
