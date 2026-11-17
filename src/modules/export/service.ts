import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { withAccount } from '../identity/service';
import type { DocumentDeps } from '../documents/service';
import type { PrivateStorage } from '../files/storage';
import { csv, sha256, zip } from './archive';

export class ExportError extends Error {
 constructor(public code: 'BUSY' | 'LIMIT' | 'FILE_UNAVAILABLE' | 'NOT_FOUND' | 'ABORTED', public status = 409) { super(code); }
}
export type ExportDeps = DocumentDeps & { storage: PrivateStorage };
type Row = Record<string, unknown>;
type Asset = Row & { id: string; storage_key: string; original_name: string; mime: string; bytes: number; checksum: string | null; state: string };
const extension: Record<string,string> = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'application/pdf':'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx', 'text/markdown':'md' };
export async function claimExport(d: DocumentDeps) {
 const token = randomUUID();
 const claimed = await withAccount(d.db, d.identity, async tx => (await tx.execute<{ claimed: boolean }>(sql`select app.claim_export(${token}::uuid) as claimed`)).rows[0].claimed);
 if (!claimed) throw new ExportError('BUSY', 429);
 return token;
}
export async function releaseExport(d: DocumentDeps, token: string) {
 // Release remains possible after account deactivation; no reads are granted.
 await d.db.transaction(async tx => {
  await tx.execute(sql`select set_config('app.user_id',${d.identity.userId},true)`);
  await tx.execute(sql`select app.release_export(${token}::uuid)`);
 });
}
export async function exportSnapshot(d: DocumentDeps, token: string) {
 try { return await withAccount(d.db, d.identity, async tx => {
  await tx.execute(sql`set local statement_timeout='8s'`);
  const result = await tx.execute<{ table_name: string; row_json: string | null }>(sql`select * from app.export_records(${token}::uuid)`);
  const tables: Record<string,Row[]> = {};
  for (const row of result.rows) {
   tables[row.table_name] ??= [];
   if (row.row_json !== null) tables[row.table_name].push(JSON.parse(row.row_json));
  }
  const time = (await tx.execute<{ time: string }>(sql`select to_char(transaction_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`)).rows[0].time;
  return { format: 'craftbook-user-export', version: 1, exportedAt: time, ownerId: d.identity.userId, tables };
 }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
 } catch(error) {
  let cause: unknown = error;
  for(let i=0;i<4&&cause instanceof Error;i++,cause=cause.cause) {
   if(cause.message==='EXPORT_LIMIT')throw new ExportError('LIMIT',413);
  }
  throw error;
 }
}
function sanitize(snapshot: Awaited<ReturnType<typeof exportSnapshot>>) {
 return { ...snapshot, tables: Object.fromEntries(Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !['storage_key', 'upload_expires_at'].includes(key))))])) };
}
function assets(snapshot: Awaited<ReturnType<typeof exportSnapshot>>) { return (snapshot.tables.asset ?? []) as Asset[]; }
function metadata(asset: Asset, links: Row[]) {
 return { assetId: asset.id, originalName: asset.original_name, mime: asset.mime, bytes: asset.bytes,
  sha256: asset.checksum, state: asset.state, path: `files/${asset.id}.${extension[asset.mime] ?? 'bin'}`,
  downloadPath: `/api/export/assets/${asset.id}`, uses: links.filter(link => link.asset_id === asset.id) };
}
export async function exportedFile(d: ExportDeps, asset: Asset, signal: AbortSignal) {
 signal.throwIfAborted();
 if (asset.state !== 'ready' || !asset.checksum) throw new ExportError('FILE_UNAVAILABLE');
 await withAccount(d.db, d.identity, async () => {});
 try {
  const bytes = await d.storage.bytes(asset.storage_key, Math.min(asset.bytes, 10485760), signal);
  if (bytes.length !== asset.bytes || sha256(bytes) !== asset.checksum) throw new ExportError('FILE_UNAVAILABLE');
  signal.throwIfAborted(); return bytes;
 } catch { throw new ExportError(signal.aborted ? 'ABORTED' : 'FILE_UNAVAILABLE'); }
}
export async function buildExport(d: ExportDeps, token: string, includeFiles: boolean, signal: AbortSignal) {
 const snapshot = await exportSnapshot(d, token), ownAssets = assets(snapshot);
 const data = Buffer.from(JSON.stringify(sanitize(snapshot), null, 2));
 if (data.length > 16777216) throw new ExportError('LIMIT', 413);
 const files = ownAssets.map(asset => ({ ...metadata(asset, snapshot.tables.asset_link ?? []), included: false, verified: false }));
 const entries = [{ path: 'data.json', bytes: data }];
 if (includeFiles && ownAssets.reduce((sum, a) => sum + a.bytes, 0) > 33554432) throw new ExportError('LIMIT', 413);
 let total = data.length;
 for (const [table, rows] of Object.entries(sanitize(snapshot).tables)) {
  const bytes = csv(rows); total += bytes.length;
  if (total > 25165824) throw new ExportError('LIMIT', 413);
  entries.push({ path: `csv/${table}.csv`, bytes });
 }
 if (includeFiles) for (let i = 0; i < ownAssets.length; i++) {
  if (ownAssets[i].state !== 'ready') continue;
  const bytes = await exportedFile(d, ownAssets[i], signal);
  entries.push({ path: files[i].path, bytes }); files[i].included = true; files[i].verified = true;
 }
 signal.throwIfAborted();
 await withAccount(d.db, d.identity, async () => {});
 const complete = includeFiles && files.every(file => file.included && file.verified);
 const manifest = { format: 'craftbook-export-manifest', version: 1, exportedAt: snapshot.exportedAt, ownerId: snapshot.ownerId,
  complete, mode: includeFiles ? 'data-and-files' : 'data-with-separate-files',
  consistency: 'Databázový snapshot; soubory ověřeny při čtení. Neúspěšné čtení ověřeného souboru ruší celý archiv. Export není provozní záloha ani importní formát.',
  tables: Object.fromEntries(Object.entries(snapshot.tables).map(([name, rows]) => [name, rows.length])), files,
  entries: entries.map(e => ({ path: e.path, bytes: e.bytes.length, sha256: sha256(e.bytes) })) };
 entries.push({ path: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest, null, 2)) });
 return { bytes: zip(entries), complete };
}
export async function listExportFiles(d: DocumentDeps) {
 const token = await claimExport(d);
 try { const snapshot = await exportSnapshot(d, token); return assets(snapshot).map(a => metadata(a, snapshot.tables.asset_link ?? [])); }
 finally { await releaseExport(d, token); }
}
export async function singleExportFile(d: ExportDeps, token: string, id: string, signal: AbortSignal) {
 const snapshot = await exportSnapshot(d, token), asset = assets(snapshot).find(a => a.id === id);
 if (!asset) throw new ExportError('NOT_FOUND', 404);
 const bytes = await exportedFile(d, asset, signal);
 await withAccount(d.db, d.identity, async () => {});
 return { bytes, path: metadata(asset, []).path.split('/').at(-1)! };
}
