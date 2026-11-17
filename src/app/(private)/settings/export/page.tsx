import Link from 'next/link';
import { ExportDownload } from '@/components/export/download';
import { PageHeading } from '@/components/page-heading';
import { requireAccount } from '@/server/account';
import { documentDeps } from '@/server/documents';
import { listExportFiles } from '@/modules/export/service';
export const metadata = { title: 'Export vlastních dat' };
export default async function ExportPage() {
 await requireAccount();
 let files: Awaited<ReturnType<typeof listExportFiles>> = [], unavailable = false;
 try { files = await listExportFiles(await documentDeps()); } catch { unavailable = true; }
 return <><PageHeading title="Export vlastních dat" description="Vaše záznamy, historie, přílohy a fotografie v přenositelném formátu."/>
  <section className="panel settings-panel export-panel"><h2>Stažení dat</h2>
   <p>Archiv obsahuje JSON, tabulkové přehledy CSV a manifest s vazbami a kontrolními součty. Zahrnuje i archivované záznamy a historická data vlastní dílny po jejím vypnutí. Neobsahuje hesla a neslouží k automatickému importu.</p>
   <ExportDownload href="/api/export" label="Stáhnout vše včetně příloh" primary/>
   <p>Limit příloh v jednom archivu je 32 MiB. Při překročení limitu stáhněte záznamy a všechny dostupné soubory níže samostatně. Při chybě se zobrazí vysvětlení a můžete export opakovat.</p>
   <ExportDownload href="/api/export?files=separate" label="Stáhnout záznamy JSON a CSV"/>
   <p>Ověřený soubor, který při exportu chybí nebo má jiný kontrolní součet, zruší celé stažení. Neověřené soubory jsou v manifestu označené a archiv se neoznačí jako úplný. Současně může běžet jeden export; další lze spustit po jeho skončení, nejpozději za dvě minuty.</p>
  </section>
  <section className="panel settings-panel export-panel"><h2>Samostatné přílohy a fotografie</h2>
   {unavailable ? <p role="alert">Seznam souborů nyní nelze načíst. Zkuste stránku znovu později.</p> : files.length ? <ul>{files.map(file => <li key={file.assetId}>
    {file.state === 'ready' ? <ExportDownload href={file.downloadPath} label={file.originalName}/> : <span>{file.originalName} — neověřený nebo odstraňovaný soubor</span>}
    <span className="muted small"> ({file.bytes} B; {file.assetId})</span>
   </li>)}</ul> : <p>Nemáte žádné přílohy.</p>}
  </section><p><Link href="/settings">Zpět do Nastavení</Link></p></>;
}
