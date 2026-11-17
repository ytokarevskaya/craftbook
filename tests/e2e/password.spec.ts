import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fixtures } from "../helpers/fixtures";
import { runOperation } from "../../scripts/ops/service";
const origin='http://127.0.0.1:3100';
const secret=()=>randomBytes(24).toString('base64url');
test('Etapa 3: první heslo, nastavení, reset a expirace na desktopu i 375 px',async({page})=>{
 const f=await fixtures();
 const deps={pool:f.migration,admin:f.admin,authUrl:f.authUrl,publicKey:f.publicKey};
 try {
  const a=await f.create(false),b=await f.create();
  await runOperation(deps,{kind:'provision',key:randomUUID(),targetId:a.id,reference:'e2e'});
  const signin=async(pwd:string)=>{
   await page.goto('/login');await page.getByLabel('E-mail',{exact:true}).fill(a.email);await page.getByLabel('Heslo',{exact:true}).fill(pwd);
   await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();
  };
  const fill=async(pwd:string,confirmation=pwd)=>{
   await page.getByLabel('Nové heslo',{exact:true}).fill(pwd);await page.getByLabel('Potvrzení nového hesla',{exact:true}).fill(confirmation);
  };
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:375,height:812});
  await signin(a.password);await expect(page).toHaveURL(/\/change-password$/);
  expect((await page.request.get('/api/profile')).status()).toBe(403);
  expect((await page.request.patch('/api/profile',{headers:{Origin:origin},data:{displayName:'not allowed',hasWorkshop:true}})).status()).toBe(403);
  await page.goto('/settings');await expect(page).toHaveURL(/\/change-password$/);
  const next=secret();await fill(next,secret());await page.getByRole('button',{name:'Změnit heslo',exact:true}).click();
  await expect(page.locator('form [role=alert]')).toBeFocused();await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage3-password-375.png'),fullPage:true});
  const spoof=await page.request.post('/api/auth/password',{headers:{Origin:origin},data:{newPassword:next,confirmation:next,targetId:b.id}});expect(spoof.status()).toBe(400);
  expect((await page.request.post('/api/auth/password',{headers:{Origin:'https://foreign.invalid'},data:{newPassword:next,confirmation:next}})).status()).toBe(403);
  await fill(next);await page.getByRole('button',{name:'Změnit heslo',exact:true}).click();
  await expect(page).toHaveURL(/\/login\?password=changed$/);await expect(page.getByRole('status')).toContainText('Heslo bylo změněno');
  expect((await page.request.get('/api/profile')).status()).toBe(401);
  await signin(next);await expect(page).toHaveURL(origin+'/');
  await page.goto('/settings');
  const newer=secret();await page.getByLabel('Současné heslo',{exact:true}).fill('wrong-password');await fill(newer);
  await page.getByRole('button',{name:'Změnit heslo',exact:true}).click();
  await expect(page.locator('form [role=alert]')).toHaveText('Současné heslo není správné.');await expect(page.locator('form [role=alert]')).toBeFocused();await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage3-settings-375.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage3-settings-1440.png'),fullPage:true});
  await page.getByLabel('Současné heslo',{exact:true}).fill(next);await fill(newer);await page.getByRole('button',{name:'Změnit heslo',exact:true}).click();
  await expect(page).toHaveURL(/\/login\?password=changed$/);
  await signin(newer);await expect(page).toHaveURL(origin+'/');
  const temp=secret();await runOperation(deps,{kind:'reset',key:randomUUID(),targetId:a.id,reference:'e2e-reset',password:temp});
  expect([401,403]).toContain((await page.request.get('/api/profile')).status()); // Access tokens may outlive the revoked Auth session; application still denies them.
  await signin(temp);await expect(page).toHaveURL(/\/change-password$/);await noOverflow();
  await page.getByLabel('Nové heslo',{exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByLabel('Potvrzení nového hesla',{exact:true})).toBeFocused();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage3-password-1440.png'),fullPage:true});
  await f.migration.query("update app.user_account set temp_expires_at=now()-interval '1 second' where auth_user_id=$1",[a.id]);
  await page.reload();await expect(page).toHaveURL(/\/account-blocked$/);await expect(page.getByText(/Platnost dočasného přístupu vypršela/)).toBeVisible();
  expect((await page.request.post('/api/auth/password',{headers:{Origin:origin},data:{newPassword:secret(),confirmation:secret()}})).status()).toBe(400);
  const final=secret();expect((await page.request.post('/api/auth/password',{headers:{Origin:origin},data:{newPassword:final,confirmation:final}})).status()).toBe(403);
  await page.getByRole('button',{name:'Odhlásit se',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
 } finally {await f.cleanup();}
});
