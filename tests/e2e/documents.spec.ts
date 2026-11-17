import { test,expect } from '@playwright/test';
import { fixtures } from '../helpers/fixtures';
import sharp from 'sharp';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const origin='http://127.0.0.1:3100';
test('Etapa 4: poznámka s obrázkem, PDF, konflikt, nové přihlášení a mobil',async({page,browser})=>{
 const f=await fixtures();const a=await f.create();
 try{
 const login=async()=>{await page.goto('/login');await page.getByLabel('E-mail',{exact:true}).fill(a.email);await page.getByLabel('Heslo',{exact:true}).fill(a.password);await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();await expect(page).toHaveURL(origin+'/');};
 await login();await page.setViewportSize({width:375,height:812});await page.goto('/documents');await page.getByRole('link',{name:'Nová poznámka',exact:true}).click();
 await page.getByLabel('Název poznámky').fill('Zlatnický zápis');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Odstavec',exact:true})).toBeFocused();const editor=page.getByRole('textbox',{name:'Obsah poznámky'});await editor.fill('Příprava materiálu a zkušenosti.');
 let lostResponse=false;await page.route('**/api/assets/*/finalize',async route=>{if(!lostResponse){lostResponse=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 const img=await sharp({create:{width:120,height:80,channels:3,background:'#355e50'}}).png().toBuffer();await page.getByLabel('Vložit obrázek').setInputFiles({name:'pokus.png',mimeType:'image/png',buffer:img});await expect(page.locator('.document-form [role=alert]')).toContainText('Spojení se přerušilo');await page.getByRole('button',{name:'Opakovat ověření obrázku'}).click();await expect(page.getByRole('status')).toContainText('Obrázek ověřen');
 await expect(editor.locator('img')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:join(tmpdir(),'craftbook-stage4-editor-375.png'),fullPage:true});await page.getByRole('button',{name:'Uložit poznámku',exact:true}).click();await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+$/);const noteUrl=page.url();
 await expect(page.locator('.note-content')).toContainText('Příprava materiálu');await expect(page.locator('.note-content img')).toBeVisible();await page.reload();await expect(page.locator('.note-content img')).toBeVisible();
 const doc=await (await page.request.get('/api/documents/'+noteUrl.split('/').pop())).json();expect(JSON.stringify(doc.body_json)).not.toContain('http');expect(doc.body_json.doc.content.some((n:{type:string})=>n.type==='assetImage')).toBe(true);
 // Authenticated content endpoint has explicit private-cache and download headers.
 const imageUrl=await page.locator('.note-content img').getAttribute('src');const delivered=await page.request.get(imageUrl!);expect(delivered.headers()['cache-control']).toBe('private, no-store');expect(delivered.headers()['x-content-type-options']).toBe('nosniff');
 await page.getByRole('link',{name:'Upravit poznámku'}).click();await page.getByLabel('Název poznámky').fill('Rozepsáno');page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'Zpět bez uložení'}).click();await expect(page.getByLabel('Název poznámky')).toHaveValue('Rozepsáno');
 const conflict=await page.request.post('/api/documents',{headers:{Origin:origin},data:{id:doc.id,title:'Novější verze',kind:'note',body:doc.body_json,version:doc.row_version}});expect(conflict.ok()).toBe(true);
 await page.getByRole('button',{name:'Uložit poznámku',exact:true}).click();await expect(page.locator('.document-form [role=alert]')).toContainText('jiné záložce');await expect(page.locator('.document-form [role=alert]')).toBeFocused();await expect(page.getByLabel('Název poznámky')).toHaveValue('Rozepsáno');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Načíst aktuální verzi'}).click();await expect(page.getByLabel('Název poznámky')).toHaveValue('Novější verze');
 // Clipboard HTML is normalized, including removal of external images and scripts.
 await page.getByRole('textbox',{name:'Obsah poznámky'}).evaluate(el=>{const data=new DataTransfer();data.setData('text/html','<p><strong>Bezpečný text</strong><script>window.hacked=true</script><a href="javascript:alert(1)">odkaz</a><img src="https://foreign.invalid/x" onerror="window.hacked=true"></p>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 expect(await page.evaluate(()=>('hacked' in window))).toBe(false);expect(await page.locator('.tiptap img[src^="https:"]').count()).toBe(0);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:join(tmpdir(),'craftbook-stage4-editor-1440.png'),fullPage:true});await page.getByRole('button',{name:'Uložit poznámku',exact:true}).click();await expect(page).toHaveURL(noteUrl);
 await page.getByRole('button',{name:'Odhlásit se',exact:true}).click();await expect(page).toHaveURL(origin+'/login');await login();await page.goto(noteUrl);await expect(page.locator('.note-content img')).toBeVisible();
 // New browser context, no application memory, same persisted note.
 const second=await browser.newContext({storageState:await page.context().storageState()});const fresh=await second.newPage();await fresh.goto(noteUrl);await expect(fresh.locator('.note-content img')).toBeVisible();await second.close();
 await page.setViewportSize({width:375,height:812});await page.goto('/documents/upload');await page.getByLabel('Název dokumentu').fill('Podklad PDF');await page.getByLabel('Soubor PDF, DOCX nebo MD').setInputFiles({name:'podklad.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF')});await expect(page.getByRole('status')).toContainText('Soubor byl ověřen');await page.getByRole('button',{name:'Uložit dokument',exact:true}).click();await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+$/);
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Stáhnout soubor'}).click();expect((await download).suggestedFilename()).toBe('podklad.pdf');
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:join(tmpdir(),'craftbook-stage4-file-375.png'),fullPage:true});
 await page.getByRole('link',{name:'Upravit název'}).click();await page.getByLabel('Název dokumentu').fill('Přejmenovaný podklad');await page.getByRole('button',{name:'Uložit dokument',exact:true}).click();await expect(page.getByRole('heading',{name:'Přejmenovaný podklad'})).toBeVisible();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Smazat dokument',exact:true}).click();await expect(page).toHaveURL(origin+'/documents');
 await page.getByLabel('Hledat podle názvu').fill('nenalezeno');await page.getByRole('button',{name:'Hledat',exact:true}).click();await expect(page.getByRole('heading',{name:'Žádné odpovídající dokumenty'})).toBeVisible();
 await page.goto('/documents/upload');await page.getByLabel('Soubor PDF, DOCX nebo MD').setInputFiles({name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('not pdf')});await expect(page.locator('.document-form [role=alert]')).toBeFocused();await expect(page.getByRole('button',{name:'Opakovat ověření'})).toBeVisible();
 }finally{await page.close({runBeforeUnload:false});await f.cleanup();}
});
