import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {fixtures} from '../helpers/fixtures';
import {unpack} from '../helpers/archive';
for(const width of [1440,375])test(`Export vlastních dat, A/B, soubory a chyby (${width} px)`,async({browser})=>{
 const f=await fixtures(),a=await f.create(),b=await f.create(),origin='http://127.0.0.1:3100';
 const contexts=await Promise.all([a,b].map(()=>browser.newContext({viewport:{width,height:900}})));
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 const content=Buffer.from('# Česká příloha\nŽluťoučký kůň');
 try {
  for(const [i,u] of [a,b].entries()) {
   const page=pages[i];await page.goto('/login');await page.getByLabel('E-mail',{exact:true}).fill(u.email);await page.getByLabel('Heslo',{exact:true}).fill(u.password);await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();await expect(page).toHaveURL(origin+'/');
  }
  async function upload(index:number) {
   const page=pages[index],prep=await page.request.post('/api/assets/prepare',{headers:{Origin:origin},data:{name:'Stejný český název.md',mime:'text/markdown',bytes:content.length}});expect(prep.ok()).toBe(true);
   const p=await prep.json();expect((await fetch(p.url,{method:'PUT',headers:{'Content-Type':'text/markdown'},body:new Uint8Array(content)})).ok).toBe(true);
   expect((await page.request.post('/api/assets/'+p.id+'/finalize',{headers:{Origin:origin}})).ok()).toBe(true);
   const doc=randomUUID();expect((await page.request.post('/api/documents',{headers:{Origin:origin},data:{id:doc,title:'=nebezpečný český název',kind:'file',assetId:p.id}})).ok()).toBe(true);return p.id as string;
  }
  const mine=[await upload(0),await upload(0)],foreign=await upload(1),page=pages[0];
  await page.goto('/settings');await page.getByRole('link',{name:'Export vlastních dat',exact:true}).click();await expect(page).toHaveURL(origin+'/settings/export');
  await expect(page.getByRole('button',{name:'Stejný český název.md',exact:true})).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===375)await page.screenshot({path:'/private/tmp/craftbook-export-375.png',fullPage:true});
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
  const browserDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Stáhnout vše včetně příloh',exact:true}).click();
  expect((await browserDownload).suggestedFilename()).toBe('craftbook-export.zip');
  await expect(page.getByRole('status')).toHaveText('Stažení připraveno.');
  const archive=await page.request.get('/api/export?ownerId='+b.id);expect(archive.status()).toBe(200);expect(archive.headers()['cache-control']).toContain('no-store');
  const entries=await unpack(await archive.body()),data=JSON.parse(entries.get('data.json')!.toString());
  expect(data.ownerId).toBe(a.id);expect(data.tables.asset.map((r:{id:string})=>r.id).sort()).toEqual(mine.sort());expect(JSON.stringify(data)).not.toContain(b.id);
  expect(JSON.parse(entries.get('manifest.json')!.toString()).complete).toBe(true);
  expect((await page.request.get('/api/export/assets/'+foreign)).status()).toBe(404);
  const file=await page.request.get('/api/export/assets/'+mine[0]);expect(file.status()).toBe(200);expect(await file.body()).toEqual(content);
  const key=(await f.migration.query('select storage_key from app.asset where id=$1',[mine[0]])).rows[0].storage_key;
  expect((await f.admin.storage.from('craftbook-private').remove([key])).error).toBeNull();
  await page.getByRole('button',{name:'Stáhnout vše včetně příloh',exact:true}).click();
  await expect(page.locator('.export-download').getByRole('alert')).toContainText('Soubor chybí');
  await expect(page.locator('.export-download').getByRole('alert')).toBeFocused();
  const failed=await page.request.get('/api/export');expect(failed.status()).toBe(409);expect((await failed.json()).code).toBe('FILE_UNAVAILABLE');
  const partial=await page.request.get('/api/export?files=separate');expect(partial.status()).toBe(200);expect(partial.headers()['x-craftbook-export-complete']).toBe('false');
  expect((await f.admin.storage.from('craftbook-private').upload(key,content,{contentType:'text/markdown'})).error).toBeNull();
  // Client disconnect before consuming the archive must release its singleton lease.
  await page.evaluate(async()=>{const controller=new AbortController();const r=await fetch('/api/export',{signal:controller.signal});await r.body?.getReader().cancel();controller.abort();});
  await expect.poll(async()=>Number((await f.migration.query('select count(*) n from app.export_lease where expires_at>now()')).rows[0].n)).toBe(0);
  await f.migration.query("update app.user_account set sessions_valid_after=now()+interval '1 second' where auth_user_id=$1",[a.id]);
  expect((await page.request.get('/api/export')).status()).toBe(403);
 } finally {for(const c of contexts)await c.close();await f.cleanup();}
});
