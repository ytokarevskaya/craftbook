# Průběh implementace

## Etapa 1 — dokončeno (16. 11. 2026)

### Hotovo

- Next.js 16.4.6 App Router, React 19.3.1, TypeScript strict, Node 24, npm lockfile; žádná závislost na cloudových klíčích.
- Český responzivní shell, tokeny podle návrhů, desktop sidebar, mobilní drawer, aktivní navigace, skip link a viditelný focus.
- Přehled s pravdivými prezentačními stavy, Dokumenty, Pracovní postupy, Výrobky, Materiály se třemi navigačními cíli a Nastavení.
- Neaktivní přihlášení, profil, vlastní dílna, změna hesla a odhlášení. Bez osobních dat, formulářového odesílání či ukládání.
- Výslovné označení náhledu bez přihlášení. Materiály jsou pouze náhled struktury, nikoli nastavení či autorizovaný sklad. Na Přehledu není materiálový souhrn.
- `/api/health` vrací jen stav procesu bez konfigurace, DB nebo Auth; vlastní česká 404.
- Podklady z Downloads zkopírovány do docs beze změn; původní soubory i AGENTS.md zachovány. README, .env.example, ui-guidelines a decisions.
- Lokální Git repozitář na větvi main; bez commitu, remote, push či nasazení.
- Změny schématu: žádné. Cloudové prostředky: žádné.

### Spuštěné kontroly

- `npm install`: úspěch, lockfile vytvořen. Konečná instalace hlásí 0 známých zranitelností.
- `npm run lint`: prošel bez chyb i varování.
- `npm run typecheck`: prošel (`next typegen && tsc --noEmit`).
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: prošel, všechny stránky sestaveny bez cloudové konfigurace.
- `NEXT_TELEMETRY_DISABLED=1 npm run dev -- --hostname 127.0.0.1 --port 3101`: spuštěn bez konfigurace; GET `/` HTTP 200, `/api/health` vrací stav ok.
- `npm ls --depth=0` a `npm ls eslint --all`: finální závislosti bez neplatných peer vazeb.
- `NEXT_TELEMETRY_DISABLED=1 PORT=3100 npm run start -- --hostname 127.0.0.1`: úspěch, ověřené respektování PORT.
- Dočasný Playwright + instalovaný Chrome: všech 9 stránek (`/`, `/documents`, `/procedures`, `/products`, `/materials`, `/materials/purchases`, `/materials/movements`, `/settings`, `/login`) vrací HTTP 200 na 1440 i 375 px; nikde vodorovné přetečení.
- Prohlížeč: mobilní menu otevírání klávesnicí, Tab cyklus uvnitř, Escape, návrat fokusu, zavření po navigaci a při změně šířky na desktop; aktivní položka a skip link. Původní únik fokusu na hraně cyklu opraven, opakovaná kontrola prošla.
- Health: HTTP 200, přesně `{"status":"ok"}`, `Cache-Control: no-store`. Přihlášení: obě pole i tlačítko deaktivované. Neexistující URL: HTTP 404. Žádné pageerror v prohlížeči.
- Screenshot Přehledu na 1440 a 375 px vizuálně zkontrolován. Dočasné ověřovací nástroje/screenshoty jsou mimo projekt v `/private/tmp`, nejsou závislostmi aplikace.

### Omezení a blokátory

- Autentizace, DB, RLS, účty, sklad, editor, soubory a ukládání patří do dalších etap. Bez těchto funkcí se netestuje bezpečnost dvou účtů; žádný výsledek takových testů není tvrzen.
- Původní blokátor etapy 1: Docker nebyl dostupný v PATH. **Vyřešeno v etapě 2 (16. 11. 2026):** ověřen klient i běžící daemon, lokální Supabase spuštěn; viz záznam níže.
- ESLint 9 je v npm označen jako nepodporovaný. Vybraná konfigurace Next má tranzitivní pluginy deklarující kompatibilitu pouze do řady 9; zachována kompatibilní verze 9.39.5. Technický dluh zaznamenán v decisions. Nejde o runtime závislost; přechod na řadu 10 provést s podporovanými pluginy.
- Síťové instalace, spuštění lokálních serverů a Chrome vyžadovaly rozšířené sandbox oprávnění; poté proběhly úspěšně.

### Vyzkoušení a další krok

`npm ci`, `npm run dev`, otevřít http://localhost:3000. Projít navigaci, Materiály, neaktivní Nastavení a Přihlášení. Zúžit na 375 px a vyzkoušet hamburger, Tab a Escape.

Etapa 1 končí zde. Další je samostatně zadaná etapa 2 (skutečná identita, omezená runtime DB role, transakční kontext, RLS a testy dvou uživatelů); automaticky nezačala.

## Etapa 2 — dokončeno (16. 11. 2026)

### Hotovo

- Lokální Supabase CLI 3.2.0 a konfigurace projektu `craftbook-local`, PostgreSQL 17, Auth bez veřejné registrace a SMTP. Docker Engine 29.9.3 ověřen přes `docker version` i `docker info`; původní blokátor vyřešen.
- Kanonická SQL migrace `20261116000100_identity.sql`: pouze UserAccount a UserProfile ve schématu app, runtime role, minimální granty, RLS a úzké funkce pro kontext/relaci. Žádné doménové ani skladové entity.
- Drizzle + pg, max. 5 runtime spojení. Runtime role není vlastník, superuser, BYPASSRLS ani člen privilegované role. Nemění chráněné příznaky. Migrační přístup oddělený od běžné aplikace.
- Ověřená Auth identita a claims, transakční user/session kontext, kontrola účtu/relace a RLS. Kontext nezůstává po COMMIT ani ROLLBACK. Obnova tokenu neobchází původní sessions_valid_after.
- Skutečné přihlášení, SSR cookies/refresh a odhlášení. HTTP mutace s kontrolou Origin a striktní validací, no-store odpovědi, generické přihlašovací chyby. Žádná registrace, admin UI, service role v runtime ani autentizační bypass.
- Každá chráněná stránka a API samostatně kontrolují účet. Chybějící účet/profil, neaktivní/disabled/pending účet, povinná změna, expirace a stará relace neposkytují běžný přístup. Blokovaný účet má vysvětlení a odhlášení.
- Ukládané display name a has_workshop, e-mail pouze pro čtení. Vlastní dílna výchozí false; Materiály skryté a přímé routy odmítnuté bez dílny. S dílnou zůstávají jen prázdné stránky.
- Lokální příkazy pro start/stop/migrace, bezpečné oddělené env soubory a interaktivní účet se skrytým heslem. Idempotentní provisioning konkrétního Auth ID je pending; aktivní účty jsou pouze lokální fixtures. Nástroje odmítají vzdálené cíle.
- Aktualizované README, .env.example, rozhodnutí a UI pravidla. Původní specifikace, AGENTS.md i historie etapy 1 zachovány. Etapa 2 prompt uložen do docs pro dohledání hranice etapy 3.

### Skutečně spuštěné kontroly

- `docker version`, `docker info`: daemon běží. `npm run local:start`: čistý první start s aplikací SQL migrace prošel.
- `npm run db:migrate`: opakovaná aplikace migračního řetězce prošla bez resetu nebo změny již aplikované migrace.
- `npm run local:env`: lokální omezené přístupy připraveny, tajemství nevypsána; `.env.local` a `.env.ops.local` jsou ignorované a oddělené.
- `npm run local:stop` a opětovný `npm run local:start`: prošly, schéma a runtime přístup zachované; integrační testy po restartu znovu prošly.
- `npm run lint`: bez chyb/varování. `npm run typecheck`: prošel. `NEXT_TELEMETRY_DISABLED=1 npm run build`: prošel, privátní stránky dynamické, health veřejný.
- `npm run test:integration`: 11/11 testů (hlavní test + 10 scénářů), skutečné lokální Auth a PostgreSQL. Pokrývají A/B izolaci čtení/zápisu, podvržené ID a session ID, COMMIT/ROLLBACK na stejném spojení, chybějící/poškozený kontext, runtime práva a negativní pokusy měnit účet/obejít RLS, chybějící účet/profil, všechny blokující příznaky, refresh/zneplatnění relace, metadata, zakázanou registraci, nevystavené app schéma, opakovaný provisioning a odhlášení.
- `npm run test:e2e`: 1/1 průchodového testu prošel po opravě fokusu; skutečný Chrome, lokální produkční web a Supabase. Ověřuje přihlášení/odhlášení, chybu hesla, serverovou validaci a CSRF, A/B izolaci přes HTTP, podvržené ID, uložení/reload/nové přihlášení, všechny materiálové routy bez dílny, SSR refresh cookies i pokus o refresh po zneplatnění, blokovaný neúplný účet, mobilní drawer a desktop/375 px bez přetečení. Health přesně odpovídá původnímu kontraktu.
- Během ověření opraven závod přesunu fokusu na chybovou zprávu před vykreslením Reactem; fokus nyní reaguje až na dokončené vykreslení. Kolize testovacího selektoru s Next route announcerem opravena přesným selektorem formulářové chyby.
- Snímky Přihlášení a Nastavení na 1440 i 375 px vizuálně zkontrolovány; ukládají se do dočasného adresáře OS, obsahují jen izolované testovací údaje.
- Kontrola klientských JS balíčků: žádný privilegovaný Auth klíč, migrační URL ani runtime DB heslo. `git check-ignore` potvrzuje ignorování env a CLI temp souborů; `git diff --check` bez problémů.

### Omezení a další krok

- Změna/reset hesla, plný provisioning lifecycle, ops deaktivace a obnova částečných operací čekají na etapu 3. Bezpečnostní příznaky jsou již nyní vynucené. Pending účet se automaticky neaktivuje.
- Neimplementovány dokumenty, upload, editor, výrobky, sklad a AI. Žádný cloudový projekt nebyl propojen ani změněn, žádný push či nasazení.
- Testy používají výhradně vlastní náhodné lokální identity a po sobě je mažou. Osobní účet uživatelky nebyl vytvořen; heslo si zvolí přes `npm run local:account`. Automatické testy nejsou ověřením cloudového nasazení.
- Původní dluh ESLint 9 ponechán podle zadání. E2E vyžaduje nainstalovaný Chrome a volný port 3100. Pro lokální web používat přesný origin z APP_URL.
- Vyzkoušení již připraveného prostředí: `npm run local:start`, `npm run db:migrate`, `npm run local:account`, `npm run dev`, otevřít http://localhost:3000/login. Konfigurace je už připravená; `local:env` ji znovu nepřepíše. Bezpečné zastavení: Ctrl+C web a `npm run local:stop` bez mazání volumes.
- Etapa 2 dokončena bez otevřeného blokátoru. Lokální Supabase po ověření běží; testovací web byl ukončen a testovací identity uklizeny. Etapa 3 nebyla zahájena.

## Etapa 3 — dokončeno (17. 11. 2026)

### Hotovo

- Lokální interaktivní ops CLI pro create/provision/reset/deactivate/status/resume. Skrytá hesla bez argumentů, kontrola cílového účtu a prostředí, odmítnutí vzdálených cílů. Žádný webový ops endpoint, admin UI nebo SMTP.
- Migrace `20261116000200_account_operations.sql`: AccountProvisionOperation s trvalým stavem/fází, idempotency klíčem, referencí a bezpečným chybovým kódem; UserAccount.operation_id. Nová migrace aplikována lokálně, původní migrace zachována.
- Založení bez pozvánky: předem rezervované Auth UUID, pending_password, must_change_password, expirace 48 h, dílna false. Opakování nepřepisuje existující profil ani heslo; kolize e-mailu se nepřebírá.
- Povinná změna hesla v úzkém průchodu bez běžných dat. Běžná změna v Nastavení ověřuje současné heslo. Úspěch ruší relace a vyžaduje nové přihlášení; dlouho otevřená dočasná relace vyžaduje čerstvé přihlášení před mutací. Expirovaný přístup má vysvětlení a odhlášení.
- Reset blokuje přístup před Auth změnou a obnovuje pouze pending stav. Deaktivace ponechá data, nastaví disabled, zablokuje Auth a změnou na nezachovávané náhodné heslo zruší relace. Reset disabled účet neaktivuje.
- Zámek cílového účtu, trvalé mezikroky a operation_id chrání před souběhem a zastaralým dokončením. Selhání po zahájení nechává přístup zablokovaný. Ops operace lze obnovit původním klíčem; selhanou vlastní změnu napravuje explicitní provozní reset.
- Runtime nemá přímé provozní zápisy ani přístup k evidenci operací; úzké funkce vlastní změny kontrolují uživatele, původní relaci a aktuální operaci. Zachované RLS a transakčně lokální kontext.
- Aktualizované README, .env.example, decisions a UI pravidla; nový `docs/account-operations.md` popisuje příkazy, Dashboard, předání hesla a nápravu. Závislosti a lockfile bez upgradu.

### Skutečně spuštěné kontroly

- `npm run db:migrate`: nová migrace úspěšně aplikována na lokální Supabase bez resetu dat.
- `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build`: prošly.
- `npm run test:integration`: závěrečný běh 17. 11. prošel **23/23** (včetně dvou hlavních testů). Zachované bezpečnostní scénáře etapy 2; nové pokrývají založení/idempotenci/kolizi e-mailu, pending přístup, obě změny hesla, expiraci, starou relaci, reset, deaktivaci včetně odstranění auth.sessions, selhání v mezikrocích, obnovu, zastaralé operace, souběh a omezení runtime role.
- Nový test staré relace původně narazil na správnou kontrolu sessions_valid_after: simulace posunula jen relaci, nikoli čas provisioningu. Opravena testovací příprava historických časů; závěrečný běh prošel.
- `npm run test:e2e`: závěrečný běh 17. 11. **2/2**. Skutečný Chrome a lokální produkční Next: původní průchod etapy 2 plus první heslo, Nastavení, reset a expirace; přímé HTTP pokusy mimo UI, CSRF, cizí ID, fokus chyb, klávesnice a šířky 1440/375 px bez přetečení.
- Snímky formuláře povinné změny na 375 px a Nastavení na desktopu vizuálně zkontrolovány; snímky obou formulářů v obou šířkách jsou v dočasném adresáři OS, jen s izolovanými testovacími účty.
- Kontrola finálních klientských souborů: bez privilegovaného Auth klíče a DB přístupů. `git check-ignore` potvrzuje oddělené ignorované env soubory; `git diff --check` prošel.
- Předchozí opakování kontrol přerušil limit automatického schvalování, nikoli chyba aplikace. Po obnovení dostupnosti byly oba závěrečné běhy skutečně dokončeny.

### Omezení a další krok

- Bez otevřeného funkčního/testovacího blokátoru. Ověření je lokální; cloudový Supabase ani Heroku se neměnily, neproběhl push ani nasazení. CLI záměrně vzdálené cíle odmítá. Reaktivace disabled účtu není součástí etapy.
- Auth a DB nejsou atomická transakce. Při nejistém výsledku vlastní změny je nutný explicitní ops reset; návod popisuje bezpečný postup. Žádné heslo se pro pozdější obnovu neukládá.
- Testy uklidily pouze své náhodné identity; ruční účty zůstaly zachované. Lokální Supabase běží, testovací web je ukončený.
- Vyzkoušení: `npm run local:start`, `npm run db:migrate`, `npm run ops:create`, `npm run dev`; otevřít http://localhost:3000/login a projít povinnou změnou. Existující konfiguraci nepřegenerovávat. Reset: `npm run ops:reset`; deaktivace: `npm run ops:deactivate`.
- Etapa 3 dokončena. Další krok je až samostatně zadaná etapa 4; dokumenty, sklad ani další moduly nebyly zahájeny.

## Etapa 4 — dokončeno (17. 11. 2026)

### Hotovo

- Dokumenty: vlastní seznam, hledání podle názvu, serverové stránkování se stabilním pořadím updated_at/id, prázdný stav, nulový výsledek hledání a samostatný chybový stav. Přehled zobrazuje skutečné poslední dokumenty.
- Poznámky: otevřený Tiptap 3, základní WYSIWYG formátování, obrázky v obsahu přes Asset ID, explicitní Uložit, ochrana neuložených změn, zachování rozepsaného obsahu při chybě a konflikt row_version s možností načtení aktuální verze. Bez localStorage, HTML/Markdown zdroje nebo autosave.
- Přílohy PDF/DOCX/UTF-8 MD: upload, ověření, metadata, přejmenování, privátní stažení a potvrzené smazání. Dostupné s vlastní dílnou i bez ní. Žádná galerie, workflow postupů nebo jiné budoucí moduly.
- Migrace `20261117000100_documents.sql` a `20261117000200_document_shape.sql`: Document/Asset/AssetLink, složené vlastnické FK, RLS, runtime granty, indexy, odložená kontrola hlavní přílohy a ochrana připojení ready assetů. Drizzle modely odpovídají těmto tabulkám; původní migrace zachovány.
- Lokální Storage zapnuto bezpečným stop/start se zachováním dat. `local:storage` připravuje soukromý bucket, limity a restriktivní politiku proti přímému anon/JWT přístupu. Serverový klíč je pouze v ignorované konfiguraci a úzkém adaptéru; aplikační DB stále používá omezenou runtime roli.
- Pending → ready → deleting, checksum, opakovatelná finalizace, neměnný objekt bez upsert, atomické vazby dokumentů a bezpečný opakovatelný dávkový úklid s výchozím dry-run. Úklid znovu ověřuje reference pod zámkem a respektuje ochrannou lhůtu i expiraci upload tokenu.
- Obrázky: klientská orientace/zmenšení/komprese, serverová kontrola signatury a dekódování; omezené ZIP/XML pro DOCX a striktní UTF-8 pro MD. Pevné horní meze a konfigurovatelné nižší limity. Validační kontrola není antivirus.
- Autorizovaný content endpoint doručuje ověřený MIME, private/no-store, nosniff, sandbox CSP a attachment pro soubory. Signed download vzniká jen interně, s krátkým TTL a novou autorizací při každém požadavku.
- Aktualizované README, .env.example, decisions a UI pravidla. Provozní návod `docs/files-and-maintenance.md` obsahuje přípravu, limity, obnovu, údržbu a ruční scénář. Zadání zachováno v `docs/stage-04-prompt.md`.

### Skutečně spuštěné kontroly

- Instalace uzamčených kompatibilních knihoven: Tiptap 3.34.0, sharp 0.35.5, yauzl 3.4.0, fast-xml-parser 5.12.1 a typy yauzl; npm hlásilo 0 známých zranitelností. Stávající framework/Auth/ORM bez upgradu.
- `npm run local:stop`, `npm run local:start`, `npm run db:migrate`, `npm run local:storage`: prošly. Storage a obě nové migrace dostupné na skutečném lokálním stacku, bez resetu dat. Opravena počáteční nekompatibilita top-level await ops skriptu s CJS během přípravy; opakovaný běh uspěl.
- `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build`: prošly bez lint chyb/varování.
- `npm run test:integration`: **33/33**, včetně zachovaných testů etap 2–3 a 9 nových scénářů + hlavního testu. Skutečné Auth/PostgreSQL/Storage, runtime RLS, CRUD, idempotence, hledání/stránkování, PDF/DOCX/MD, obrázek a Asset ID, A/B izolace, přímý Storage přístup, neaktivní/pending/staré relace, XSS/atributy/limity/signatury, SQL FK a hlavní příloha, reference, grace, chybějící objekt, selhání mazání a retry, souběh finalizace/připojení s deleting a expirace signed odkazu.
- `npm run test:e2e`: finálně **4/4**, Chrome proti lokálnímu produkčnímu Next. Poznámka s obrázkem, normalizace clipboard HTML, ztracená odpověď skutečné finalizace a retry, chyby/fokus/klávesnice, neuložené změny, konflikt se zachováním lokální verze, nové přihlášení, PDF upload/download/přejmenování/mazání, hledání a chybné PDF. Zachované průchody identitou a hesly.
- Samostatný E2E test skutečně spustí Next na portu 3102, uloží poznámku i PDF, proces ukončí a znovu spustí; text i původní bajty souboru zůstávají dostupné. Nejde jen o reload nebo nový browser context.
- Prohlížečové ověření na 375 i 1440 px bez vodorovného přetečení. Screenshot editoru v obou šířkách a mobilního detailu PDF vizuálně zkontrolován. Snímky jsou v dočasném adresáři OS a obsahují pouze izolované fixture údaje.
- Během E2E opraveny testovací selektory kolidující s Next route announcerem a čekání na dokončení odhlášení. Simulace přerušené sítě vedla k doplnění českých zpráv místo původních prohlížečových výjimek.
- `npm run files:cleanup -- --dry-run`: prošel, 0 kandidátů, 0 smazaných, 0 selhání. Skutečné mazání testováno výhradně na UUID testovacích vlastníků, včetně simulované chyby a následného opakování.
- Klientské sestavené soubory neobsahují Storage/Auth privilegované klíče, migrační URL ani runtime DB přístup. Env soubory ignorované; `git diff --check` bez problémů.

### Omezení a další krok

- Bez otevřeného funkčního či testovacího blokátoru. Testování pouze lokální; žádný supabase link, cloudová migrace, Heroku změna, push nebo nasazení. Testovací identity a soubory uklizeny, ruční data zachována. Lokální Supabase běží, testovací Next procesy ukončeny.
- Supabase signed upload má pevnou platnost 2 hodiny; úklid čeká nejméně 24 hodin a kontroluje expiraci. Již vydaný bearer download může fungovat do expirace; okamžité odvolání se neslibuje. Prohlížeči se download token neposkytuje, čtení jde přes autorizovaný endpoint a zatěžuje přenos Next serveru.
- Validace není antivirová ochrana. HEIC, aktivní SVG/HTML, makra, DOCX editor/konverze, OCR a extrakce textu nejsou podporované. Originály fotografií se nahrazují optimalizovanou kopií, dokumentové přílohy zůstávají původní.
- U právě připraveného prostředí stačí `npm run dev`, http://localhost:3000/documents. Při přechodu z jiného checkoutu postupovat podle návodu a aplikovat migrace + `local:storage`, nepřegenerovávat existující env.
- Etapa 4 dokončena. Etapa 5 (pracovní postupy/výrobky) nebyla zahájena; čeká na samostatné zadání.
