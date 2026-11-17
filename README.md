# Craftbook

Jedna kniha vládne všem.

Soukromá aplikace pro studenty zlatnictví a vlastní dílnu. Po etapě 9 funguje školní i vlastní výrobní cyklus: plány, rezervace, deník a fotografie, skutečná spotřeba, vratky, odpad, materiálový náklad a auditovatelné opravy. Zachované jsou dokumenty, WYSIWYG, soukromé přílohy a provozní správa účtů. Nastavení nabízí export JSON/CSV i souborů; samostatné provozní nástroje mají skutečně ověřenou izolovanou obnovu.

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
- `src/modules/workshop`: postupy, školní výrobky, snapshoty, pracovní kroky, skutečná spotřeba a deník.
- `src/modules/documents`, `src/modules/files`: validovaný obsah, CRUD, soubory, Storage adaptér a údržba.
- `src/server`: server-only konfigurace, pg pool, SSR klient, autorizace a HTTP chyby.
- `src/proxy.ts`: aktualizace Auth cookies.
- `scripts`: výhradně lokální CLI, konfigurace a provisioning.
- `supabase`: verzovaná lokální konfigurace a SQL migrace rolí, grantů, RLS a modelu.
- `tests`: skutečné integrační a prohlížečové ověření.

Framework ani ESLint nebyly plošně upgradovány. Školní i vlastní cyklus jsou dostupné. Exporty, zálohy a nasazení čekají na další zadání. AI a administrační UI nejsou součástí implementace.

## Vyzkoušení etapy 5

Ve stávajícím lokálním prostředí spusťte `npm run local:start`, `npm run db:migrate` a `npm run dev`. Nová migrace `20261117000300_school_work.sql` přidává školní model a rozšiřuje vlastnické vazby příloh; zachovává předchozí data. Existující env soubory nepřegenerovávejte. Storage připravuje dosavadní `npm run local:storage`.

1. V **Pracovní postupy → Nový postup** zadejte název, volitelné kroky a materiály. Množství může zůstat prázdné. Kroky přeuspořádáte tlačítky Nahoru/Dolů. Z detailu zvolte **Založit školní výrobek**.
2. Návrh upravte a uložte. **Zahájit výrobu** uchová neměnnou kopii plánu. Zaškrtávejte kroky a ověřte reload; ani 100 % výrobek automaticky nedokončí.
3. Přidejte zápis do deníku s obrázkem a průběhovou fotografii. **Dokončit výrobek** nabídne skutečnou spotřebu a školní cenu; obojí lze nechat neznámé. Dokončit lze také bez všech checkboxů.
4. Přes **Výrobky → Nový výrobek** vytvořte ruční návrh bez vzoru, třeba jen s názvem. Po dokončení můžete nabídku nového vzoru přeskočit nebo otevřít **Uložit jako pracovní postup**, upravit předvyplněný návrh a uložit jej právě jednou.
5. U hotového výrobku lze opravit cenu/spotřebu, doplnit další skutečný materiál, deník a hotové fotografie. Datum dokončení a původní plán se tím nemění. Prázdná cena je jiná než nula.

Seznamy podporují hledání a stránkování, výrobky také filtry stavů. Upravený vzor nepřepisuje zahájenou práci; při změně před zahájením je nutné potvrdit aktuální revizi se zachováním vlastního návrhu. Postupy se archivují, výrobky se v této etapě nemažou. Přehled ukazuje skutečné rozpracované výrobky.

## Etapa 6 — vlastní sklad

Ve stávajícím lokálním prostředí spusťte `npm run local:start`, `npm run db:migrate`, `npm run dev`. Migrace `20261117000400_inventory.sql` zachovává existující data. Zapněte **Vlastní dílnu** v Nastavení. Materiály mají Zásoby / Nákupy / Pohyby; vypnutí dílny data zachová, ale zablokuje sklad i čtení/finalizaci faktur. Obecné dokumenty zůstávají dostupné.

Ruční kontrolní scénář:

1. V Zásobách založte kartu typu Kov, například „Ag 925 — kulatý drát Ø 1 mm“. Jednotka je g. Počáteční zásobu nyní vynechte.
2. V Nákupy → Nový nákup přidejte dva řádky stejné karty: **10 g / celková cena 300 Kč** a **10 g / 400 Kč**. Zadejte datum a dodavatele, případně přiložte PDF/DOCX/MD fakturu. Přijměte nákup.
3. Detail karty ukáže **20 g**, hodnotu **700,00 Kč**, průměr **35,00 Kč/g**. V Odpisu zadejte **2 g**, důvod a potvrďte: zbude **18 g / 630,00 Kč**.
4. V inventuře lze zadat skutečně zjištěné volné množství a důvod. Záporný rozdíl používá současné ocenění; kladný má volitelnou celkovou hodnotu přírůstku. Souběžná změna vyvolá konflikt. Odkaz „Opravit inventurou“ z nákupu zachová vazbu na opravovanou operaci.
5. Pohyby zobrazují historii a filtry; reload i nové přihlášení zachovají výsledky. Archivace karty zachová zásobu a historii; pro další pohyb kartu obnovte.

Prázdná cena je neznámá, nula je známé nulové ocenění. Smíšená zásoba ukazuje známou hodnotu jako neúplnou; odpis převádí známou a neznámou část poměrně. Nový příjem staré neznámé ceny nedopočítává. Částky jsou CZK, bez DPH a automatického rozpočítání dopravy. Po zaúčtování je nákup neměnný; opravy množství se evidují inventurou, nikoli úpravou historie. Poznámka a přílohy nákupu jsou v této etapě také pouze pro čtení.

Přesný model a zaokrouhlování jsou v `docs/decisions.md`. Diagnostika přihlášeného vlastníka s dílnou: `GET /api/inventory/reconcile`, očekávané `{"issues":[]}`; nic neopravuje. Etapy 7–8 níže doplňují rezervace a dokončený vlastní cyklus. Školní výrobky sklad nemění.

## Etapa 7 — rezervace a cenové části

Lokálně aplikujte `npm run db:migrate` (nové migrace `20261117000500_reservations.sql` a `20261117000600_reservation_integrity.sql`), poté `npm run dev`. Existující data a env soubory zachovejte.

Ve skladu jsou dostupné přehledy volného, rezervovaného a celkového evidovaného množství, oddělené hodnoty fondů a cenové části podle výrobků. Pohyby rozlišují rezervaci/uvolnění a odkazují na výrobek. Prázdný přehled znamená skutečně žádné rezervace; žádná demonstrační data se nezakládají.

V etapě 7 byly vlastní výrobní služby ověřené pouze interně. Etapa 8 je nyní zpřístupňuje spolu s dokončením, skutečností a opravami, viz postup níže. Služby nadále ověřují účet/dílnu, mapování, souběh a dostupnost.

Izolované lokální ověření:

```sh
node --conditions=react-server --import tsx --test tests/integration/reservations.test.ts
npm run test:integration
npm run build
npm run test:e2e -- tests/e2e/reservations.spec.ts
```

Test vytvoří pouze vlastní náhodné účty a data, zavolá interní služby s ověřeným Auth kontextem a vše uklidí. Browser test připravuje rezervaci těmito službami v lokálním subprocessu, bez veřejného testovacího endpointu; přihlašovací údaje předává pouze na stdin, bez argumentů nebo logů.

Kontrolní příklad v testu: 10 g / 300 Kč → rezervace 5 g / 150 Kč → nákup 5 g / 200 Kč → volných 10 g / 350 Kč → navýšení rezervace o 2 g / 70 Kč → rezervováno 7 g / 220 Kč, volných 8 g / 280 Kč → uvolnění vrátí celkem 15 g / 500 Kč. Nový příjem nepřecení staré části. Snížení vrací nejnovější cenové části jako první; plné uvolnění vrací i poslední přesné účetní zbytky.

`GET /api/inventory/reconcile` nyní porovnává všechny složky obou fondů s ledgerem a rezervovaný fond také se zbývajícími cenovými částmi; nic neopravuje. Vypnutí dílny rezervace nesmaže. Archivovaná karta dovoluje uvolnění, ale další čerpání vyžaduje její obnovu. Detailní invarianty a pořadí zámků jsou v `docs/decisions.md`.

Etapa 8 připojila mapovací a rezervační komponenty na autorizované webové mutace současně s úplným dokončením a vypořádáním. Bez dílny zůstává own zakázané na serveru.

## Etapa 8 — dokončení vlastní výroby a opravy

Ve stávajícím lokálním prostředí spusťte `npm run local:start`,
`npm run db:migrate` a `npm run dev`. Nové migrace jsou
`20261117000700_settlements.sql`, `20261117000800_settlement_results.sql`
a `20261117000900_settlement_integrity.sql`. Neresetují data.
Existující env soubory nepřegenerovávejte.

Ruční příklad **10 g / 300 Kč → odběr 5 g → náklad 120 Kč**:

1. Zapněte vlastní dílnu v Nastavení. V Materiálech založte kovovou kartu,
   například Ag 925, kulatý drát. Zadejte počáteční zásobu **10 g**,
   známou celkovou hodnotu **300 Kč** a důvod.
2. Vytvořte výrobek ručně nebo z postupu. Vyberte **Vlastní materiál ze skladu**,
   přidejte požadavek **5 g** a uložte návrh. Kroky jsou volitelné.
3. Na detailu vyberte kartu, potvrďte specifikaci, zaškrtněte
   **Rezervovat uvedené množství** a zvolte **Zahájit výrobu**.
   Volných je 5 g / 150 Kč, rezervováno 5 g / 150 Kč.
4. Volitelně přidejte deník a fotografie. Checkboxy ukládají průběh,
   ale 100 % výrobek nedokončí.
5. Zvolte **Dokončit výrobek**. Zadejte **Ve výrobku 4 g**,
   **Použitelná vratka 0,5 g**, **Vratný odpad 0,5 g** a **Nevratná ztráta 0 g**.
   Odběr se dopočítá na 5 g. Potvrďte skutečnost i použitelnost vratky
   ve stejné specifikaci.
6. **Spočítat náhled vypořádání** ukáže náklad **120,00 Kč**, volných
   **5,5 g / 165,00 Kč** a rezervováno 0. Odpadová hodnota 15 Kč není v nákladu.
   Potvrďte dokončení. Změna skladu od náhledu vyžádá přepočítání se zachováním zadání.
7. **Opravit spotřebu** vyžaduje důvod. Změňte vratku na 0,3 g a ztrátu na 0,2 g
   při stejném odběru 5 g: náklad je **126,00 Kč**, volných **5,3 g / 159,00 Kč**.
   Datum dokončení zůstane stejné a vznikne nová revize.
8. Ručně založený hotový výrobek nabídne **Uložit jako pracovní postup**.
   Po prvním příkladu se předvyplní vstup 4,5 g (= odběr minus použitelná vratka),
   po uvedené opravě 4,7 g. Množství i texty lze upravit. Ceny, rezervace,
   fotografie a checkboxy se nepřenášejí. Uložení lze přeskočit.

Skutečnost je kumulativní od začátku výrobku. **Vrátit do plánovaných** otevře
stejný formulář: nulové řádky musí být potvrzené, nenulový odběr se vypořádá.
Restart zachová snapshot i spotřebu; další dokončení odečte pouze rozdíl.
Nové rezervace jsou pro další dosud neevidovaný odběr.

Vratka jde na tutéž kartu/specifikaci. Odpad opouští zásobu a není v nákladu;
ztráta do nákladu vstupuje. U ks jsou všechny fyzické hodnoty celé a odpad je 0.
Další skutečný materiál lze doplnit bez změny původního plánu. Všechna skutečná
množství musí být známá; chybějící cena neblokuje dokončení a je označená
jako neúplné ocenění. Rezervování lze vědomě vypnout, neznámý plán začátek neblokuje.

Výrobky se archivují a obnovují. Archivace nic nespotřebuje ani neuvolní;
rezervace, revize a soubory zůstávají zachované. Seznam má filtr archivovaných.
Neproveditelná oprava vrátí konflikt množství/podílů/hodnoty a nepřecení jiné výrobky.

Školní kontrola: bez dílny založte, zahajte a dokončete výrobek bez ceny a spotřeby.
Nevzniká skladový pohyb. S dílnou lze výslovně vybrat také školní zdroj.

```sh
node --conditions=react-server --import tsx --test tests/integration/settlements.test.ts
npm run test:integration
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Podrobný model: [Skladový model](docs/inventory-model.md) a [rozhodnutí](docs/decisions.md).
Testy používají skutečný lokální Auth/PostgreSQL/Storage a uklízejí jen svá UUID.
Bez push, cloudu a nasazení. Etapa 9 nebyla zahájena.

### Etapa 9 — vlastní export a obnova

V **Nastavení → Export vlastních dat** lze stáhnout JSON, CSV, manifest a všechny
vlastní přílohy/fotografie. Plný ZIP má limit příloh 32 MiB; větší objem se
stahuje jako záznamy a samostatné soubory. Historická vlastní skladová data jsou
exportovatelná i po vypnutí dílny. [Postup a hranice exportu](docs/export.md).

Provozní záloha je samostatný lokální nástroj, vyžaduje okno bez zápisů a úklidu:

```sh
npm run ops:backup -- --output /absolutni/chranena/cesta/novy-backup --maintenance-confirmed
npm run ops:backup:verify -- --backup /absolutni/chranena/cesta/novy-backup
npm run ops:restore -- --backup /absolutni/chranena/cesta/novy-backup
```

Restore přijímá jen nový označený izolovaný cíl; nikdy běžný lokální ani cloudový
projekt. Účty po obnově vyžadují řízený reset, deaktivace zůstává zachovaná.
[Úplný návod včetně bezpečného retry](docs/backup-and-restore.md).

Závěrečné místní ověření (Docker, Node 24, lokální Supabase a Chrome):

```sh
npm run db:migrate
npm run lint
npm run typecheck
npm run build
npm run test:integration
npm run test:e2e
npm run test:recovery
```

Recovery test si založí dva vlastní lokální projekty s odlišnými volumes a porty
55321/55322 a 56321/56322, ověří skutečný dump, soubory, Auth reset, RLS, ledger
i obnovený web na 1440 a 375 px a zastaví pouze své projekty. Nespoléhá jen
na vytvoření souboru zálohy. [Akceptační mapa MVP](docs/mvp-acceptance.md).

Přípravy pro samostatnou etapu 10, bez aktuálního nasazení:

- Zvolit autorizovaný Supabase projekt a jednu stávající Heroku Eco dyno;
  potvrdit origin, vypnutou veřejnou registraci a režim bez SMTP.
- Připravit názvy runtime konfigurace: APP_URL, NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DATABASE_URL (omezená craftbook_runtime),
  STORAGE_SECRET_KEY a případně FILE_IMAGE_BYTES, FILE_DOCUMENT_BYTES,
  NOTE_CONTENT_BYTES, FILE_DOWNLOAD_TTL, FILE_GRACE_HOURS. Hodnoty se předávají
  odděleně; [šablona](.env.example) neobsahuje tajemství.
- Oddělit MIGRATION_DATABASE_URL a SUPABASE_SECRET_KEY pro provozní správu,
  provést migrace bez resetu a ověřit RLS skutečnou runtime rolí. Lokální ops
  nástroje zatím vzdálené cíle odmítají; cloudový provozní postup se musí připravit
  až pro konkrétní autorizované prostředí, ne obcházením lokálních ochran.
- Ověřit doménu/HTTPS/cookies, soukromý bucket, paměť Eco, limity exportů,
  restart a zálohování skutečného pilotu před pozváním dalších osob.
