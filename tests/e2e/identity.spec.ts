import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { fixtures } from "../helpers/fixtures";
const origin = "http://127.0.0.1:3100";

test("Přihlášení, přímé API, uložení profilu a mobilní ovládání", async ({ page, browser }) => {
 const f = await fixtures();
 const errors: string[]=[]; page.on('pageerror',error=>errors.push(error.message));
 try {
  const a = await f.create(), b = await f.create(), incomplete = await f.create(false);
  const login = async (user: typeof a) => {
   await page.goto('/login');
   await page.getByLabel('E-mail',{exact:true}).fill(user.email);
   await page.getByLabel('Heslo',{exact:true}).fill(user.password);
   await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();
   await page.waitForURL(origin+'/');
  };
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/settings'); await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/profile')).status()).toBe(401);
  expect((await page.request.patch('/api/profile',{headers:{Origin:origin},data:{displayName:'X',hasWorkshop:true}})).status()).toBe(401);
  const health=await page.request.get('/api/health'); expect(await health.json()).toEqual({status:'ok'}); expect(health.headers()['cache-control']).toBe('no-store');
  await page.setViewportSize({width:375,height:812});
  await page.getByLabel('E-mail',{exact:true}).fill(a.email);
  await page.getByLabel('Heslo',{exact:true}).fill('incorrect-password');
  await page.getByRole('button',{name:'Přihlásit se',exact:true}).click();
  await expect(page.locator('#login-error')).toBeVisible(); await expect(page.locator('#login-error')).toBeFocused(); await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage2-login-375.png'),fullPage:true});
  await login(a);
  for(const path of ['/materials','/materials/purchases','/materials/movements']) { await page.goto(path); await expect(page).toHaveURL(/\/workshop-required$/); }
  await page.goto('/settings');
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('button',{name:'Otevřít menu'}).click();
  await expect(page.getByRole('dialog').getByRole('link',{name:'Materiály',exact:true})).toHaveCount(0);
  for(let i=0;i<12;i++){ await page.keyboard.press('Tab'); expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(page.getByRole('button',{name:'Otevřít menu'})).toBeFocused();
  await page.getByLabel('Zobrazované jméno').fill('Místní dílna A');
  await page.getByRole('switch').check();
  await page.getByRole('button',{name:'Uložit změny'}).click(); await expect(page.getByRole('status')).toHaveText('Nastavení bylo uloženo.');
  await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage2-settings-375.png'),fullPage:true});
  await page.reload();
  await expect(page.getByLabel('Zobrazované jméno')).toHaveValue('Místní dílna A'); await expect(page.getByRole('switch')).toBeChecked();
  await page.setViewportSize({width:1440,height:1000}); await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage2-settings-1440.png'),fullPage:true});
  const profile=await page.request.get('/api/profile'); expect(profile.headers()['cache-control']).toContain('no-store'); expect((await profile.json()).userId).toBe(a.id);
  const spoof=await page.request.patch('/api/profile',{headers:{Origin:origin},data:{displayName:'Napadený B',hasWorkshop:true,userId:b.id,status:'active'}}); expect(spoof.status()).toBe(400);
  const foreignQuery=await page.request.get(`/api/profile?userId=${b.id}`); expect((await foreignQuery.json()).userId).toBe(a.id);
  expect((await page.request.patch('/api/profile',{headers:{Origin:'https://foreign.invalid'},data:{displayName:'X',hasWorkshop:true}})).status()).toBe(403);
  expect((await page.request.post('/api/auth/logout',{headers:{Origin:'https://foreign.invalid'}})).status()).toBe(403);
  expect((await page.request.patch('/api/profile',{headers:{Origin:origin},data:{displayName:'X'.repeat(81),hasWorkshop:true}})).status()).toBe(400);
  const bContext=await browser.newContext();
  try {
   const logged=await bContext.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:b.email,password:b.password}}); expect(logged.status()).toBe(200);
   const bProfile=await bContext.request.get(origin+'/api/profile'); const data=await bProfile.json(); expect(data.userId).toBe(b.id); expect(data.displayName).toBe(''); expect(data.hasWorkshop).toBe(false);
  } finally { await bContext.close(); }
  for(const path of ['/','/documents','/procedures','/products','/materials','/materials/purchases','/materials/movements','/settings']) {
   await page.goto(path); await expect(page).toHaveURL(origin+path); await noOverflow();
  }
  // Refresh through the real SSR proxy: only cookie expiration metadata is made stale.
  // JWT signatures and refresh token remain untouched; these are never logged or saved.
  const cookies=await page.context().cookies();
  const sessionCookie=cookies.find(c=>c.name.includes('-auth-token')&&!c.name.endsWith('.0'));
  expect(sessionCookie).toBeTruthy();
  const session=JSON.parse(Buffer.from(sessionCookie!.value.slice('base64-'.length),'base64url').toString());
  const oldToken=session.access_token; session.expires_at=Math.floor(Date.now()/1000)-10;
  await page.context().addCookies([{...sessionCookie!,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')}]);
  await page.goto('/settings'); await expect(page).toHaveURL(/\/settings$/);
  const refreshed=(await page.context().cookies()).find(c=>c.name===sessionCookie!.name)!;
  const refreshedSession=JSON.parse(Buffer.from(refreshed.value.slice(7),'base64url').toString());
  expect(refreshedSession.access_token !== oldToken).toBe(true);
  // Existing token + refresh must still fail after revoking the original session timestamp.
  await f.migration.query('update app.user_account set sessions_valid_after=clock_timestamp() where auth_user_id=$1',[a.id]);
  refreshedSession.expires_at=Math.floor(Date.now()/1000)-10;
  await page.context().addCookies([{...refreshed,value:'base64-'+Buffer.from(JSON.stringify(refreshedSession)).toString('base64url')}]);
  expect((await page.request.get('/api/profile')).status()).toBe(403);
  await page.goto('/settings'); await expect(page).toHaveURL(/\/account-blocked$/);
  await page.getByRole('button',{name:'Odhlásit se',exact:true}).click(); await expect(page).toHaveURL(/\/login$/);
  await page.setViewportSize({width:1440,height:1000});
  await noOverflow();
  await page.screenshot({path:join(tmpdir(),'craftbook-stage2-login-1440.png'),fullPage:true});
  await login(a); await page.goto('/settings'); await expect(page.getByLabel('Zobrazované jméno')).toHaveValue('Místní dílna A');
  await page.locator('.sidebar').getByRole('button',{name:'Odhlásit se',exact:true}).click(); await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/profile')).status()).toBe(401);
  const missing=await page.request.post('/api/auth/login',{headers:{Origin:origin},data:{email:incomplete.email,password:incomplete.password}}); expect((await missing.json()).redirect).toBe('/account-blocked');
  expect((await page.request.get('/api/profile')).status()).toBe(403);
  expect(errors).toEqual([]);
 } finally { await f.cleanup(); }
});
