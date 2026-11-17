# Uzavřený pilot — etapa 10

Autorizované a API ověřené cíle:

- Supabase `vayxezlkyognarkqebbg`, region eu-west-1, organizace `jfrylueyelglcduamzin`.
- API `https://vayxezlkyognarkqebbg.supabase.co`.
- Session pooler `aws-0-eu-west-1.pooler.supabase.com:5432`.
- Heroku osobní EU aplikace **craftbook-app**, ID
  `e1b8d94d-af33-4b0d-b45d-a9f2bb3a8de7`, stack heroku-24, oficiální Node buildpack.
- HTTPS origin `https://craftbook-app-cab5aab2013a.herokuapp.com`.
- Pouze jeden Eco web, žádný worker ani add-on. Jiné aplikace se nemění.

App name byl dohledán přes API podle přesné domény a porovnán s ID i vlastníkem,
neodvozen z domény. Automatic Deploys uživatelka potvrdila jako vypnuté.
Nasazeno **17. 11. 2026**, Heroku **v5**,
release `c8854ff8-f80b-415d-b7b7-c057b5358108`, commit
`e41fd0fda7c0a58665c8c1796d8aea0f306403e0`. Omezený cloudový smoke prošel,
včetně restartu, A/B, souborů, exportu a skladu. Podrobnosti v progress.
Pozdější provozní/dokumentační commity nejsou automaticky nasazené.

## Oddělená konfigurace

Běžné .env.local a .env.ops.local zůstávají lokální. Cloudové příkazy čtou jen
`.env.ops.cloud.local` přes parseEnv, nemění globální process.env a nenačítají
lokální dotenv. Soubor má práva 0600 a je ignorovaný. Šablona bez tajemství je
`config/cloud-ops.env.example`. Hesla se nezadávají argumenty:

```sh
npm run cloud:setup
npm run cloud:cert -- /uplna/cesta/prod-ca-2021.crt
npm run cloud:inspect
```

Setup přijímá Heroku API token a Supabase Management token, publishable/secret
key a postgres heslo skrytě. Přesný app name/ID může zjistit ověřeným čtením API.
Certifikát stáhněte z cílového Dashboard → Database → Settings → SSL Configuration.
Veřejná CA se uloží jako DATABASE_CA_CERT; ověřuje se platnost a typ CA.
Nepoužívat certifikát získaný z neověřeného DB spojení jako nový trust anchor.

Web Config Vars: APP_URL, NEXT_PUBLIC_SUPABASE_URL,
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DATABASE_URL (craftbook_runtime.ref),
DATABASE_CA_CERT, STORAGE_SECRET_KEY a limity souborů. Migrační URL ani
ops SUPABASE_SECRET_KEY do webu nepatří; cloud:heroku je výslovně odstraní.
PORT přiděluje Heroku. Tokeny, hesla a podepsané URL se nevypisují. API update
Config Vars záměrně nečte/nevypisuje vrácenou mapu proměnných.

URL hesla se sestavují přes encodeURIComponent v samostatném builderu;
pouhý URL.password setter nestačí pro doslovné %. V DB URL nesmí být žádné
query SSL parametry: pg by jimi mohl přepsat explicitní SSL konfiguraci.
Cloud používá rejectUnauthorized=true, přesný servername a CA. Není povolené
NODE_TLS_REJECT_UNAUTHORIZED=0. Runtime pool max 5, ops max 2. Lokální přístup
má dál vlastní role, loopback a porty; cloudové parametry se na něj nepřenášejí.

## První bootstrap a opakování

Po čtecí kontrole cíle/vlastníka a prázdného stavu:

```sh
npm run cloud:ssl
npm run cloud:migrate
npm run cloud:runtime
npm run cloud:auth
npm run cloud:storage
npm run cloud:advisors
npm run cloud:first-account
npm run cloud:heroku
```

SSL enforcement může krátce restartovat DB. Poté migrace vyžadují ověřené
klientské TLS i šifrovaný upstream pooler → PG. Migrační postgres nemusí být
superuser; musí mít potřebná existující oprávnění/BYPASSRLS pro bezpečnostní
funkce, runtime je nedostane. SQL zůstává stejné jako v lokální historii.
Každý soubor běží ve vlastní transakci s advisory lockem a kontrolou pořadí
+ SHA-256 v neveřejné app.schema_migration. Neznámé schéma nebo změněný checksum
se odmítá. Opakování hotových migrací nic nepřepisuje. Žádný reset/schema push
ani migrace při startu dyno. První runtime heslo se vygeneruje nezávisle na
postgres hesle; existující heslo se při opakování automaticky nerotuje.

Auth: e-mail/heslo, zákaz veřejné/anonymní registrace a ostatních providerů,
Site URL přesný HTTPS origin, prázdný redirect allowlist (aplikace nemá callback
routu). Žádná SMTP služba ani pozvánka. První zadaný e-mail zůstává pouze v
ignorovaném FIRST_ACCOUNT_EMAIL. cloud:first-account je idempotentní operace
etapy 3; heslo se uloží pouze do 0600 `.env.pilot-login.local`, ne do výstupu.
Uživatelka otevře soubor v editoru, přihlásí se a změní heslo do 48 hodin.
Potvrzení e-mailu přes Admin API není důkaz vlastnictví schránky.

Bucket craftbook-private je soukromý, 10 MiB, whitelist JPEG/PNG/WebP/PDF/DOCX/MD.
Restriktivní politika odmítá anon/authenticated přímé operace. Web ověřuje účet,
relaci a vlastníka před každým souborem a používá Storage API jen serverově.
Data API zůstává vypnuté; app schéma není vystavené. Kód nepoužívá doménové
supabase.from()/rpc() dotazy. RLS a runtime fungují i při přímém ORM spojení.

Dva INFO nálezy `rls_enabled_no_policy` na account_provision_operation a
schema_migration jsou záměrné uzavření provozních tabulek. Runtime/anon k nim
nemají granty. Auth leaked-password protection může hlásit WARN; placenou funkci
nezapínáme. Zachovaná politika 12 znaků / max 72 bajtů, aktuální heslo,
vynucená změna a zneplatňování relací. Žádný ERROR nález se nesmí přehlédnout.

## Účty a údržba

```sh
npm run cloud:account:create
npm run cloud:account:provision
npm run cloud:account:reset
npm run cloud:account:deactivate
npm run cloud:account:status
npm run cloud:account:resume
```

Sdílejí doménovou logiku etapy 3. Výslovný --cloud režim ověřuje přesný projekt,
Heroku identitu a migrační TLS/roli/historii. Lokální ops příkazy dál cloud
odmítají. Heslo pouze skrytým vstupem; disabled se provisioningem/resetem
neaktivuje. Přerušené operace řešte status/resume, nikoli ručním active zápisem.

Údržba souborů používá stejnou doménovou logiku jako lokální nástroj:

```sh
npm run cloud:files:cleanup -- --dry-run
npm run cloud:files:cleanup -- --apply
```

Výchozí režim nic nemaže, dávka nejvýše 50 objektů. Nejprve zkontrolujte počty;
apply používejte mimo zálohovací okno. Nemění skladový ledger.

## Build a nasazení přesného commitu

```sh
npm run lint
npm run typecheck
npm run build
npm run test:integration
npm run test:cloud
npm run test:e2e
npm run test:cloud:recovery
```

Heroku classic Node buildpack podporuje Node 24.x; heroku-postbuild spouští
produkční Next build, bez DB zápisů nebo migračních přístupů. Procfile spouští
npm start; start.mjs naslouchá na 0.0.0.0 a PORT. Produkční start je testovaný
na nestandardním portu a HTTPS redirect používá jen pevný APP_URL, ne Host.
Config Vars včetně NEXT_PUBLIC musejí být připravené před buildem.

Po kontrole diffu a commitnutí výhradně souvisejících otestovaných změn:

```sh
git push origin HEAD
npm run cloud:deploy -- FULL_40_CHARACTER_TESTED_SHA
npm run cloud:release
npm run cloud:eco
```

cloud:deploy vyžaduje čistý worktree a HEAD přesně stejného SHA. Git archive
obsahuje pouze commitované soubory; ignorované konfigurace, zálohy a výsledky
se neposílají. Oficiální Heroku Sources/Build API nasadí tento archiv a uvede
SHA jako source_blob.version. Nejde o build jiné vzdálené GitHub větve.
Soukromé upload/download URL se neukládají do reportu. Průběh/release ID je
v ignorovaném .cloud/deploy.json; cloud:release je bezpečný jednorázový dotaz.
Alternativní Manual Deploy v propojeném GitHub repozitáři je možný pouze po
push správného commitu a jeho ověření. Nasazení neopakujte oběma cestami.
Automatic Deploys zůstávají vypnuté. Eco ověřuje dostupnou velikost přes API,
nepřidá předplatné, worker ani add-on a žádnou jinou aplikaci nevypíná.

## Smoke, zálohy a rollback

Dva syntetické účty schválila uživatelka výslovně pro omezený cloudový test:

```sh
npm run cloud:smoke -- --synthetic-accounts-authorized
```

Nespouštět celé test:integration/test:e2e proti pilotu. Smoke používá skutečné
HTTPS/Auth/Storage a jen své UUID a syntetické záznamy. Testuje vynucenou změnu,
soukromé soubory, školní null cenu, 120 Kč / 5,5 g, A/B, export, 1440/375,
restart dyno, refresh/reset a deaktivaci. Ledger se nikdy nemaže. Účty po
úspěchu deaktivuje; syntetická data zůstávají oddělená a přiznaná. Při chybě
uchovejte chráněné .cloud/smoke-secrets.json pro řízené pokračování a status,
nezakládejte další účty bez zadání. První osobní účet se testem nemění.

Před další migrací a alespoň týdně během aktivního používání: zastavit zápisy,
web a ops/Storage/Auth změny, dokončit uploady, poté:

```sh
npm run cloud:backup -- /absolutni/chranena/cesta/novy-backup --maintenance-confirmed
npm run ops:backup:verify -- --backup /absolutni/chranena/cesta/novy-backup
npm run cloud:migrate -- --backup /absolutni/chranena/cesta/novy-backup --maintenance-confirmed
```

V Heroku Dashboard → Resources dočasně nastavte web quantity=0. Po dokončení
zálohy obnovte jeden Eco web příkazem `npm run cloud:eco`. Žádné další změny
Auth/Storage ani cleanup během tohoto okna.

Backup vyžaduje quantity=0 všech procesů cílové aplikace. Zahrnuje app schema,
všechny vlastníky/historii, RLS/granty/sekvence a skutečné Storage bajty; cloud
pg_dump běží v jednorázovém lokálním Dockeru přes síť, ověřené TLS a 0600 pgpass.
Heslo není v argv ani globálním ~/.pgpass. Zdroj je explicitně povolený ref.
Dočasný pgpass/CA se uklidí. Migrační soubory se ukládají jen pro skutečně
aplikovanou historii. Manifest navíc zachycuje netajnou Auth politiku, exposed
schemas a metadata soukromého bucketu; nikoli API klíče, JWT secrets nebo sessions.
Při obnově do lokálního cíle je konfigurace referencí pro kontrolu, nepřenastavuje
cloud ani nenahrazuje izolované bezpečné výchozí nastavení. Nové migrace po existujících datech vyžadují správnou
ověřenou zálohu do hodiny a stejné klidové okno. Ponechte poslední dobrou kopii.

Restore **jen do izolovaného lokálního cíle** postupem backup-and-restore.md,
nikdy zpět do pilotu přes reset. Síťový dump transport má skutečný izolovaný
restore test: npm run test:cloud:recovery. Přirozené uspání skutečné Eco bylo zachyceno 17. 11. v 15:38:46 UTC;
jediný požadavek ji probudil a vrátil zdravé HTTP 200 za 14,4 s. Během čekání
žádný HTTP keep-alive, jen řídicí API. První načtení po nečinnosti může trvat
podobně déle; nepřidávejte keep-alive monitor.

Rollback kódu: uchovejte číslo předchozího kompatibilního releasu. Příkaz
`heroku releases:rollback vN --app craftbook-app` je určen jen po kontrole
kompatibility se současným schématem. Alternativně nasadit archiv známého
kompatibilního commitu oficiálním API. Rollback releasu nevrací migrace.
Nedělat destruktivní down/reset. Předchozí **v4**, commit `5fc2d1422d915d1463332b809b417df7492ce18e`,
má stejný webový kód a stejné schéma jako v5 (v5 opravuje pouze smoke helper).
Je kompatibilním rollbackem této verze. Při nejistotě web=0 do opravy,
ne automatický restore DB.

První skutečná záloha a její izolovaná obnova jsou dokončené: viz progress.
Pozorovaná paměť maximálně 124,15 MB, bez R14/R15, nikoli kapacitní záruka.

Zbývající osobní kontrola: skutečný telefon/fotka, vlastní první přihlášení a
praktické používání. Technický průchod to nenahrazuje. V1 nezačíná automaticky.

Podklady: [Heroku Node](https://devcenter.heroku.com/articles/nodejs-support),
[Eco hodiny](https://devcenter.heroku.com/articles/eco-dyno-hours),
[Node build](https://devcenter.heroku.com/articles/nodejs-classic-buildpack-builds),
[Heroku API](https://devcenter.heroku.com/articles/platform-api-reference),
[pg TLS](https://node-postgres.com/features/ssl),
[Supabase SSL](https://supabase.com/docs/guides/platform/ssl-enforcement),
[Supabase role](https://supabase.com/docs/guides/database/postgres/roles-superuser).
