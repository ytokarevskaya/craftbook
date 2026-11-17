import { crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function csv(rows: Record<string, unknown>[]) {
 const columns = [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
 const cell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
 };
 return Buffer.from('\ufeff' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n');
}
// ZIP32 store, ASCII paths only. Bounded caller input; no disk or compression buffers.
export function zip(entries: { path: string; bytes: Buffer }[]) {
 const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
 if (entries.length > 12000 || new Set(entries.map(e => e.path)).size !== entries.length) throw new Error('ZIP_LIMIT');
 for (const entry of entries) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(entry.path) || entry.path.startsWith('/') || entry.path.split('/').some(s => s === '..' || !s)) throw new Error('ZIP_PATH');
  const name = Buffer.from(entry.path), checksum = crc32(entry.bytes);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4);
  h.writeUInt16LE(33, 12); h.writeUInt32LE(checksum, 14); h.writeUInt32LE(entry.bytes.length, 18);
  h.writeUInt32LE(entry.bytes.length, 22); h.writeUInt16LE(name.length, 26);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
  c.writeUInt16LE(33, 14); c.writeUInt32LE(checksum, 16); c.writeUInt32LE(entry.bytes.length, 20);
  c.writeUInt32LE(entry.bytes.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  local.push(h, name, entry.bytes); central.push(c, name); offset += h.length + name.length + entry.bytes.length;
 }
 const directory = Buffer.concat(central), end = Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
 end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
 return Buffer.concat([...local, directory, end]);
}
