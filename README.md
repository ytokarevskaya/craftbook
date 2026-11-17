# Craftbook

Jedna kniha vládne všem.

Soukromá aplikace pro studenty zlatnictví a vlastní dílnu. Etapa 4 přidává dokumenty, WYSIWYG poznámky s obrázky a soukromé přílohy PDF/DOCX/MD. Účty, hesla a provozní správa z etap 2–3 zůstávají zachované. Postupy, výrobky a materiály čekají na další etapy.

## První lokální spuštění

Vyžaduje Node 24.x (`nvm use`, ověřeno 24.16.0), npm, běžící Docker Desktop a volné porty 54321/54322. Supabase CLI je verzovaná vývojová závislost, globální instalace není nutná.

```sh
npm ci
docker version
docker info
npm run local:start
npm run db:migrate
npm run local:env
npm run local:storage
npm run ops:create
npm run dev
```

Otevřete **http://localhost:3000/login** a přihlaste se vlastním lokálním účtem. `APP_URL` musí odpovídat originu prohlížeče; nemíchejte localhost a 127.0.0.1. Při změně portu nastavte i APP_URL.

`local:start` stáhne potřebné Docker obrazy a spustí projekt `craftbook-local` s PostgreSQL 17, Auth a lokálním API. Nepřipojuje cloud, neposílá SMTP, spouští soukromé Storage; Studio nespouští. Výstup CLI s přihlašovacími údaji se nezobrazuje. První stažení může chvíli trvat. Při chybě daemonu spusťte Docker Desktop, počkejte na běžící Engine a zopakujte `docker info`; při chybě stahování ověřte síť a volné místo.

`local:env` jednorázově načte lokální CLI status, vygeneruje heslo runtime DB role a zapíše ignorované soubory s právy 600:

- `.env.local`: APP_URL, veřejná Supabase URL/klíč a omezený DATABASE_URL.
- `.env.ops.local`: migrační DB přístup a privilegovaný lokální Auth klíč. Next tento soubor nenačítá.

`local:storage` připraví soukromý bucket/politiku a doplní pouze serverový Storage klíč do `.env.local`; nevypisuje jej a nepřepisuje existující klíč.

Existující konfiguraci skript `local:env` odmítne přepsat. Pro běžný další start jej neopakujte. Pokud existuje jen jeden z obou souborů po neúplném prvním nastavení, zachovejte jej a dokončete konfiguraci cíleně; nemažte DB ani funkční konfiguraci. Nezapisujte tajemství do Git, reportů nebo argumentů shellu. Při chybějící konfiguraci aplikace přístup odmítne, nepoužije falešný backend.

## Lokální účty

`npm run ops:create` interaktivně vytvoří účet s dočasným heslem, povinnou změnou do 48 hodin a vypnutou vlastní dílnou. Heslo se zadává skrytě, ne argumentem shellu. Po přihlášení uživatel nastaví vlastní heslo a znovu se přihlásí.

- `npm run ops:provision`: doplnění konkrétního existujícího Auth ID; úplný účet/profil nepřepisuje. `local:provision` je alias.
- `npm run ops:reset`: nové dočasné heslo a zrušení starých relací.
- `npm run ops:deactivate`: blokace účtu i Auth, zrušení relací, zachování dat.
- `npm run ops:status` a `npm run ops:resume`: dohledání a obnova přerušených operací.

Podrobný postup, Dashboard a náprava selhání: [provozní návod](docs/account-operations.md). Příkazy zobrazují cílové prostředí a účet, vyžadují potvrzení a odmítají vzdálené cíle. Pro již připravené prostředí neopakujte `local:env`.

`npm run local:account` zůstává výhradně vývojovou fixture: vytváří aktivní lokální účet bez povinné změny. Pro ověření skutečného prvního přihlášení použijte `ops:create`.

## Dokumenty a soukromé soubory

Při přechodu z etapy 3 jednou spusťte `npm run local:stop`, `npm run local:start`, `npm run db:migrate` a `npm run local:storage`. Data zůstávají zachovaná.

V Dokumentech lze vytvořit poznámku s formátováním a obrázky, nahrát PDF/DOCX/MD, hledat názvy, stránkovat, upravovat a mazat. Poznámky mají explicitní Uložit, ochranu neuložených změn a konfliktu dvou editací. Soukromá data jsou uložená na serveru; sekce funguje i bez vlastní dílny. Přehled zobrazuje skutečné poslední dokumenty.

Obrázky se optimalizují na nejvýše 2000 px / 5 MiB, přílohy mají limit 10 MiB. Údržba: `npm run files:cleanup` je dry-run, `npm run files:cleanup -- --apply` uklidí nejvýše 50 starých souborů bez reference. Fyzické mazání je odložené nejméně 24 hodin a respektuje platnost upload oprávnění.

Podrobnosti, konfigurace, lifecycle a ruční scénář: [Soubory a údržba](docs/files-and-maintenance.md). Validace souborů není antivirus; HEIC, SVG a HTML nejsou podporované.

## Běžný start a zastavení

```sh
npm run local:start
npm run db:migrate
npm run dev
```

Web zastavte Ctrl+C. Potom:

```sh
npm run local:stop
```

Zastavení zachová lokální data v Docker volumes. Nepoužívejte `--no-backup`, `db reset` ani mazání volumes. Skripty nepředávají uživatelské argumenty do CLI. Není použit `supabase link`, remote migrace, Heroku ani nasazení.

## Migrace a oddělení dat

Jedinou autoritou je SQL řetězec `supabase/migrations`, aplikovaný Supabase CLI 3.2.0. `npm run db:migrate` volá `supabase migration up`; v této verzi je výchozí cíl lokální a skript nepřipouští `--remote`. Při prvním startu CLI aplikuje migrace rovněž. Opakovaný příkaz aplikuje jen nové soubory, data neresetuje. Nevytvářejte paralelní historii přes Drizzle Kit push/migrate. Drizzle model v `src/modules/identity/schema.ts` slouží typovaným dotazům; změny modelu musí doprovázet SQL migrace.

Schéma `app` není v Data API. Role `craftbook_runtime` není vlastník, superuser, BYPASSRLS ani člen jiné role. Může číst vlastní stav účtu, upravovat jen `display_name`/`has_workshop` vlastního profilu a pracovat s vlastními dokumenty a assety pod RLS. Runtime nemá přímé zápisy do `UserAccount` ani evidence operací. Vlastní změna hesla používá úzké SECURITY DEFINER funkce svázané s ověřeným účtem, původní relací a aktuální operací.

Každá operace ověří Auth identitu i token, vytvoří transakci a nastaví lokální user/session kontext. RLS i služba kontrolují stav účtu a původní relaci; po COMMIT i ROLLBACK kontext zmizí. `sessions_valid_after` se porovnává s původním `auth.sessions.created_at`, nikoli s novým JWT `iat`. Refresh původní relaci neomladí. Úzká SECURITY DEFINER funkce zpřístupňuje jen čas vlastní aktuální relace, nemá uživatelské argumenty a používá prázdný search_path. Podrobnosti v [docs/decisions.md](docs/decisions.md).

Cookies jsou HttpOnly, SameSite=Lax a na HTTPS Secure. Proxy obnovuje relaci, ale každá privátní stránka a API kontrolují přístup samostatně. Mutace vyžadují přesný Origin, profil přijímá striktní JSON bez cizího ID či chráněných příznaků. Osobní odpovědi nejsou sdíleně cachované. Chybějící účet/profil, inactive/disabled/pending_password, povinná změna, expirace a neplatná či zneplatněná relace jsou odmítnuté.

## Kontroly

S běžícím lokálním Supabase a připravenými `.env.local` / `.env.ops.local`:

```sh
npm run lint
npm run typecheck
npm run build
npm run test:integration
npm run test:e2e
```

Integrační testy běží nad skutečným Auth a PostgreSQL s omezeným runtime připojením. Vytvářejí náhodné izolované účty a uklízejí pouze UUID založená konkrétním během; nesahají na ručně vytvořené účty. Migrační spojení používají jen pro přípravu a změny testovacích stavů. `--conditions=react-server` umožňuje v Node testovat stejné server-only služby jako v Next.js.

E2E používá Playwright a již nainstalovaný Google Chrome, spustí vlastní produkční web na 127.0.0.1:3100 a nastaví odpovídající APP_URL. Proto je nejprve potřeba build a volný port 3100. Testuje desktop a 375 px, přihlášení, chyby a fokus, nastavení, přímé požadavky, CSRF, izolaci A/B, refresh cookies a odhlášení. Trace/video jsou vypnuté kvůli přihlašovacím údajům. Nejde o testy cloudu ani nasazení.

Ručně vyzkoušejte změnu jména a vlastní dílny v `/settings`, reload a nové přihlášení. Bez dílny se Materiály nezobrazují a přímé `/materials`, `/materials/purchases`, `/materials/movements` neposkytnou obsah. S dílnou uvidíte pravdivé prázdné stránky. E-mail je jen pro čtení. Změna hesla v Nastavení vyžaduje současné heslo a odhlásí všechna zařízení. E2E také ověřuje povinnou změnu, expiraci a reset.

`/api/health` zůstává veřejné a vrací přesně `{"status":"ok"}` s `Cache-Control: no-store`; neověřuje DB ani Auth. Produkční lokální běh: `npm run build`, `npm run start`; `next start` respektuje prostředím předané PORT (budoucí Heroku).

## Struktura a hranice etapy

- `src/app/(private)`: chráněné stránky při zachování původních URL a vizuálního shellu.
- `src/app/api/auth`, `src/app/api/profile`: samostatně ověřované HTTP operace.
- `src/modules/identity`: Drizzle model, ověření identity, transakční služba a validace profilu.
- `src/modules/documents`, `src/modules/files`: validovaný obsah, CRUD, soubory, Storage adaptér a údržba.
- `src/server`: server-only konfigurace, pg pool, SSR klient, autorizace a HTTP chyby.
- `src/proxy.ts`: aktualizace Auth cookies.
- `scripts`: výhradně lokální CLI, konfigurace a provisioning.
- `supabase`: verzovaná lokální konfigurace a SQL migrace rolí, grantů, RLS a modelu.
- `tests`: skutečné integrační a prohlížečové ověření.

Framework ani ESLint nebyly plošně upgradovány. Technický dluh kompatibilní řady ESLint 9 zůstává evidovaný. Pracovní postupy, výrobky, sklad, AI a administrační UI nejsou součástí etapy 4. Další etapa nebyla zahájena.
