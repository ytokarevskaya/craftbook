import yauzl from 'yauzl';
export function unpack(bytes: Buffer): Promise<Map<string, Buffer>> {
 return new Promise((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, archive) => {
  if (error || !archive) return reject(error);
  const entries = new Map<string, Buffer>(); archive.on('error', reject); archive.on('end', () => resolve(entries));
  archive.on('entry', entry => archive.openReadStream(entry, (error, stream) => {
   if (error || !stream) return reject(error);
   const chunks: Buffer[] = []; stream.on('data', chunk => chunks.push(chunk)); stream.on('error', reject);
   stream.on('end', () => { entries.set(entry.fileName, Buffer.concat(chunks)); archive.readEntry(); });
  })); archive.readEntry();
 }));
}
