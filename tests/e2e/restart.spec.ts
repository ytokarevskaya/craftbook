import { test,expect } from '@playwright/test';
import { spawn,type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fixtures } from '../helpers/fixtures';
test('Dokument zůstane uložený po skutečném restartu procesu Next',async({browser})=>{
 const f=await fixtures(),a=await f.create();let server:ChildProcess|undefined;const origin='http://127.0.0.1:3102';
 async function start(){server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3102'],{env:{...process.env,APP_URL:origin,NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Testovací web se nespustil.');try{if((await fetch(origin+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Web není dostupný.');}
 async function stop(){if(server&&server.exitCode===null){const ended=new Promise<void>(r=>server!.once('exit',()=>r()));server.kill('SIGTERM');await ended;}server=undefined;}
 const context=await browser.newContext();const page=await context.newPage();
 try{await start();await page.goto(origin+'/login');await page.getByLabel('E-mail',{exact:true}).fill(a.email);await page.getByLabel('Heslo',{exact:true}).fill(a.password);await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();await expect(page).toHaveURL(origin+'/');
 const bytes=Buffer.from('%PDF-1.4\n%%EOF');const prep=await page.request.post(origin+'/api/assets/prepare',{headers:{Origin:origin},data:{name:'restart.pdf',mime:'application/pdf',bytes:bytes.length}});expect(prep.ok()).toBe(true);const asset=await prep.json();const upload=await fetch(asset.url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:new Uint8Array(bytes)});expect(upload.ok).toBe(true);expect((await page.request.post(origin+'/api/assets/'+asset.id+'/finalize',{headers:{Origin:origin}})).ok()).toBe(true);
 const attachment=randomUUID();expect((await page.request.post(origin+'/api/documents',{headers:{Origin:origin},data:{id:attachment,title:'PDF přes restart',kind:'file',assetId:asset.id}})).ok()).toBe(true);
 const id=randomUUID();const result=await page.request.post(origin+'/api/documents',{headers:{Origin:origin},data:{id,title:'Přetrvá restart',kind:'note',body:{version:1,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Trvalý obsah'}]}]}}}});expect(result.ok()).toBe(true);
 await stop();await start();await page.goto(origin+'/documents/'+id);await expect(page.locator('.note-content')).toContainText('Trvalý obsah');const file=await page.request.get(origin+'/api/assets/'+asset.id+'/content');expect(file.ok()).toBe(true);expect(await file.body()).toEqual(bytes);await page.goto(origin+'/documents/'+attachment);await expect(page.getByRole('link',{name:'Stáhnout soubor'})).toBeVisible();
 }finally{await context.close();await stop();await f.cleanup();}
});
