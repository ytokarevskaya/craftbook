# Craftbook

Jedna kniha vládne všem.

Soukromá aplikace pro studenty zlatnictví a vlastní dílnu. Etapa 2 přidává skutečné lokální přihlášení, oddělené účty a ukládané nastavení. Dokumenty, postupy, výrobky a materiály zůstávají prázdnými stavy budoucích etap.

## První lokální spuštění

Vyžaduje Node 24.x (`nvm use`, ověřeno 24.16.0), npm, běžící Docker Desktop a volné porty 54321/54322. Supabase CLI je verzovaná vývojová závislost, globální instalace není nutná.

```sh
npm ci
docker version
docker info
npm run local:start
npm run db:migrate
npm run local:env
npm run local:account
npm run dev
```

Otevřete **http://localhost:3000/login** a přihlaste se vlastním lokálním účtem. `APP_URL` musí odpovídat originu prohlížeče; nemíchejte localhost a 127.0.0.1. Při změně portu nastavte i APP_URL.

`local:start` stáhne potřebné Docker obrazy a spustí projekt `craftbook-local` s PostgreSQL 17, Auth a lokálním API. Nepřipojuje cloud, neposílá SMTP, nespouští Storage ani Studio. Výstup CLI s přihlašovacími údaji se nezobrazuje. První stažení může chvíli trvat. Při chybě daemonu spusťte Docker Desktop, počkejte na běžící Engine a zopakujte `docker info`; při chybě stahování ověřte síť a volné místo.

`local:env` jednorázově načte lokální CLI status, vygeneruje heslo runtime DB role a zapíše ignorované soubory s právy 600:

- `.env.local`: APP_URL, veřejná Supabase URL/klíč a omezený DATABASE_URL.
- `.env.ops.local`: migrační DB přístup a privilegovaný lokální Auth klíč. Next tento soubor nenačítá.

Existující konfiguraci skript odmítne přepsat. Pro běžný další start jej neopakujte. Pokud existuje jen jeden z obou souborů po neúplném prvním nastavení, zachovejte jej a dokončete konfiguraci cíleně; nemažte DB ani funkční konfiguraci. Nezapisujte tajemství do Git, reportů nebo argumentů shellu. Při chybějící konfiguraci aplikace přístup odmítne, nepoužije falešný backend.

## Lokální účty

`npm run local:account` se interaktivně zeptá na e-mail a heslo (nejméně 12 znaků, skrytý vstup). Vytvoří nový **aktivní lokální vývojový účet**, bez povinné změny hesla, s vlastní dílnou vypnutou. Příkaz lze použít dvakrát s odlišnými e-maily pro ruční kontrolu dvou uživatelů. Existující identitu ani heslo nepřepisuje. Heslo se neukládá do souborů ani logů.

Tato výjimka je pouze pro lokální fixtures, nikoli produkční onboarding. Nástroje před síťovým spojením odmítají vzdálené Auth/DB adresy a jiné než určené lokální porty. Neimportují se do aplikace a nemají webový endpoint.

`npm run local:provision` přijímá interaktivně konkrétní existující Auth UUID. Idempotentně založí účet a profil v jedné DB transakci se stavem **pending_password**, povinnou změnou a expirací 48 hodin. Existující účet nezmění ani neaktivuje. Takový účet v etapě 2 nemá běžný přístup; zobrazí vysvětlení a odhlášení.

Pokud fixture vytvoří Auth identitu a selže DB zápis, vytiskne pouze Auth ID pro nápravu; identita nemá přístup. Opakování `local:provision` bezpečně doplní pending účet. Plné zotavení, aktivace, reset, deaktivace a změna hesla patří etapě 3. Existující účet bez profilu se automaticky neopravuje ani neaktivuje.

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

Schéma `app` není v Data API. Role `craftbook_runtime` není vlastník, superuser, BYPASSRLS ani člen jiné role. Může číst vlastní stav účtu a upravovat jen `display_name`/`has_workshop` vlastního profilu. `UserAccount` nemá runtime zápisy.

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

Ručně vyzkoušejte změnu jména a vlastní dílny v `/settings`, reload a nové přihlášení. Bez dílny se Materiály nezobrazují a přímé `/materials`, `/materials/purchases`, `/materials/movements` neposkytnou obsah. S dílnou uvidíte pravdivé prázdné stránky. E-mail je jen pro čtení, změna hesla neaktivní.

`/api/health` zůstává veřejné a vrací přesně `{"status":"ok"}` s `Cache-Control: no-store`; neověřuje DB ani Auth. Produkční lokální běh: `npm run build`, `npm run start`; `next start` respektuje prostředím předané PORT (budoucí Heroku).

## Struktura a hranice etapy

- `src/app/(private)`: chráněné stránky při zachování původních URL a vizuálního shellu.
- `src/app/api/auth`, `src/app/api/profile`: samostatně ověřované HTTP operace.
- `src/modules/identity`: Drizzle model, ověření identity, transakční služba a validace profilu.
- `src/server`: server-only konfigurace, pg pool, SSR klient, autorizace a HTTP chyby.
- `src/proxy.ts`: aktualizace Auth cookies.
- `scripts`: výhradně lokální CLI, konfigurace a provisioning.
- `supabase`: verzovaná lokální konfigurace a SQL migrace rolí, grantů, RLS a modelu.
- `tests`: skutečné integrační a prohlížečové ověření.

Framework ani ESLint nebyly plošně upgradovány. Technický dluh kompatibilní řady ESLint 9 zůstává evidovaný. Dokumenty, soubory, výrobky, sklad, AI a administrační UI nejsou součástí etapy 2. Změna a reset hesla i úplný provozní lifecycle čekají na etapu 3.
