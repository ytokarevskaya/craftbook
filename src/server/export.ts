import 'server-only';
import { fileDeps } from './documents';
import { failure, json } from './http';
import { buildExport, claimExport, ExportError, releaseExport, singleExportFile } from '@/modules/export/service';
export async function exportResponse(request: Request, fileId?: string) {
 let release: (() => Promise<void>) | undefined;
 try {
  const d = await fileDeps(), token = await claimExport(d);
  let released = false;
  release = async () => { if (!released) { released = true; await releaseExport(d, token); } };
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(95000)]);
  const result = fileId ? await singleExportFile(d, token, fileId, signal) : await buildExport(d, token, new URL(request.url).searchParams.get('files') !== 'separate', signal);
  let bytes: Buffer | undefined = result.bytes, offset = 0;
  const close = async () => { bytes = undefined; await release!().catch(() => {}); };
  let onAbort: () => void;
  const stream = new ReadableStream<Uint8Array>({
   start(controller) {
    onAbort = () => { controller.error(new Error('EXPORT_ABORTED')); void close(); };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
   },
   async pull(controller) {
    if (!bytes) return;
    if (offset === bytes.length) { signal.removeEventListener('abort', onAbort); controller.close(); await close(); return; }
    const end = Math.min(bytes.length, offset + 65536);
    controller.enqueue(new Uint8Array(bytes.subarray(offset, end))); offset = end;
   },
   async cancel() { signal.removeEventListener('abort', onAbort); await close(); },
  });
  return new Response(stream, { headers: {
   'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
   'Content-Type': fileId ? 'application/octet-stream' : 'application/zip',
   'Content-Disposition': `attachment; filename="${'path' in result ? result.path : 'craftbook-export.zip'}"`,
   'X-Craftbook-Export-Complete': 'complete' in result ? String(result.complete) : 'true',
  } });
 } catch (error) {
  await release?.().catch(() => {});
  if (error instanceof ExportError) {
   const messages = { BUSY: 'Právě probíhá jiný export. Zkuste to za dvě minuty.', LIMIT: 'Export překračuje limit. Stáhněte záznamy a přílohy samostatně. Pokud limit překračují samotné záznamy, obraťte se na provozovatele.', FILE_UNAVAILABLE: 'Soubor chybí, není ověřený nebo se změnil. Úplný archiv nebyl vytvořen. Opakujte export; při opakované chybě kontaktujte provozovatele.', NOT_FOUND: 'Soubor nebyl nalezen.', ABORTED: 'Export byl přerušen. Zkuste jej znovu.' };
   return json({ code: error.code, message: messages[error.code] }, error.status);
  }
  return failure(error);
 }
}
