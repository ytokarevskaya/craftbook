import { requireAccount } from '@/server/account';
import { PageHeading } from '@/components/page-heading';
import { NoteEditor } from '@/components/documents/editor';
export default async function Page(){await requireAccount();return <><PageHeading title="Nová poznámka" description="Nápady, zkušenosti a fotografie na jednom místě."/><NoteEditor/></>;}
