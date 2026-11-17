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

## Etapa 5 — dokončeno (17. 11. 2026)

### Hotovo

- Pracovní postupy: vytvoření/úprava, hledání, stránkování, detail, řazení textových kroků tlačítky, nezávislé materiály s null množstvím, přílohy celého plánu a archivace. Kontrola revision_counter brání tiché ztrátě souběžných změn.
- Školní výrobek ze vzoru i přímo z ručního návrhu; stačí název, kroky a známá množství nejsou povinné. Server i SQL odmítají source=own. Seznam má hledání, stránkování a filtry planned/in_progress/done. Přehled zobrazuje skutečné rozpracované výrobky.
- Atomické zahájení a dokončení s klíčem požadavku, kontrolou verze a zámkem. První zahájení ukládá neměnný snapshot včetně chráněných příloh. Změněná revize vzoru vyžaduje vědomé potvrzení se zachováním vlastního návrhu. Návrat do planned a opětovné zahájení zachovají původní kopii a historii.
- Pracovní checkboxy ukládají explicitní hodnotu; 100 % neznamená done a bez kroků je „Bez kroků“. Pracovní texty a materiály lze podle specifikace měnit během výroby, aniž se změní snapshot. Po dokončení jsou checkboxy historické.
- Chronologický deník s datem, WYSIWYG a obrázky, úpravou/smazáním vlastního zápisu; fotografie konkrétního výrobku průběh/hotový výrobek. Znovu využit editor, validace, renderer, upload, optimalizace a soukromé čtení etapy 4. Deník a fotky fungují i po dokončení.
- Skutečná spotřeba oddělená od plánu, možnost dalších skutečných materiálů a pozdější opravy. Školní cena je přesný numeric řetězec v CZK, null je odlišné od nuly. Opravy nemění completed_at.
- Dobrovolný editovatelný nový vzor z dokončeného ručního výrobku, vytvořený transakčně právě jednou. Známá potvrzená vstupní spotřeba má přednost před původním plánem; nepřenášejí se checkboxy, fotografie, ceny ani deník. Původ výrobku a snapshot zůstávají zachované.
- Migrace `20261117000300_school_work.sql` aplikována pouze lokálně, bez resetu. Osm doménových tabulek, RLS skutečné omezené runtime role, stejnovlastnické FK a rozšířený AssetLink s právě jedním cílem. Snapshoty a jejich vazby jsou pro runtime neměnné. Drizzle modely odpovídají sloupcům SQL.
- Aktualizované README, decisions a návod k souborům; zadání v `docs/stage-05-prompt.md`. Žádné nové závislosti nebo plošné upgrady.

### Skutečně spuštěné kontroly

- `npm run db:migrate`: prošlo na lokálním Supabase, existující data zachována.
- `npm run lint`, `npm run typecheck`, `npm run build`: prošly. `git diff --check`: bez problémů.
- `npm run test:integration`: **44/44**, skutečný PostgreSQL/Auth/Storage, včetně regrese etap 2–4. Nové testy zahrnují null/0/přesnou cenu, obě cesty vytvoření, snapshot, revize, souběžné zahájení/dokončení a retry, návrat planned, explicitní checkboxy, relogin, deník/fotografie, archivaci, snapshotové reference a úklid, neaktivní účty/staré relace, RLS, souběžné editace a škodlivý obsah.
- Po doplnění skutečných materiálů a dalších pokusů o propojení cizích objektů byl samostatně zopakován `tests/integration/workshop.test.ts`: **11/11**. Výslovně ověřeno odmítnutí cizí přílohy, fotografie, deníkového obrázku, materiálového řádku a FK na cizí výrobek; cizí snapshot není viditelný. Dodatečný materiál zachovává snapshot i completed_at.
- `npm run test:e2e`: **6/6**, Chrome proti lokálnímu produkčnímu Next. Zachované čtyři scénáře etap 2–4 včetně skutečného restartu procesu; nové celé školní a ruční cykly na 1440 a 375 px, s obrázkem v deníku, průběhovou/hotovou fotografií, přímým API A/B, odmítnutím own, dokončením bez ceny, opravou na 0, novým přihlášením a editovatelným uložením nového vzoru.
- Screenshoty mobilního formuláře a desktopového/mobilního detailu vizuálně zkontrolovány; testy kontrolují nulové vodorovné přetečení. Snímky v dočasném adresáři OS obsahují pouze fixture data.
- V prvním integračním běhu opravena nejednoznačná SQL reference occurred_at v řazení deníku; následná regrese prošla. V E2E upraveno čekání na serverové uložení checkboxu místo předpokladu okamžité lokální změny.

### Omezení a další krok

- Bez otevřeného funkčního/testovacího blokátoru v zadaném rozsahu. Ověření pouze lokální, cloud ani Heroku nebyly měněny; bez push/nasazení. Testovací účty a soubory uklizeny podle UUID, osobní data zachována. Testovací Next procesy skončily, lokální Supabase zůstává dostupný.
- Podporován pouze school. Vlastní skladová výroba, rezervace, pohyby, vypořádání a automatické oceňování nejsou hotové. Mazání výrobků, globální galerie a historie verzí vzorů se nenabízejí. Platí dosavadní omezení souborů a ochranné lhůty úklidu.
- Vyzkoušení ve stávajícím prostředí: `npm run dev`, pak `/procedures/new` nebo `/products/new`. Podrobný průchod v README; při jiném checkoutu nejprve lokální stack a migrace. Existující env nepřegenerovávat.
- Etapa 5 dokončena. Etapu 6 nezačínat bez samostatného zadání.

## Etapa 6 — průběžný záznam implementace (17. 11. 2026)

- Zadání zachováno v stage-06-prompt.md, model a pravidla zaokrouhlení zapsána v decisions před migrací. Počáteční git stav byl čistý.
- Lokálně aplikována migrace 20261117000400_inventory.sql bez resetu: karty, balance, operace, nákupy/řádky, append-only pohyby a FK faktur. RLS vyžaduje vlastní dílnu. Rezervační složky jsou nulové.
- Implementován základ přesné BigInt aritmetiky, transakční nákup, počáteční stav, odpis, inventurní korekce, idempotence, stabilní zámky, archivace a diagnostika rekonstrukce. Rozšířen souborový modul o workshop_only; dokončení integrace a bezpečnostní ověření ještě zbývají.
- První skutečný integrační scénář prošel: 20 g / 700 Kč, odpis 2 g → 18 g / 630 Kč; souběžný retry bez duplikátu, historie souhlasí, vypnutá dílna odmítá přístup. Nejde o dokončené povinné ověření etapy.
- Samostatný TypeScript bez incremental cache a lint v této fázi prošly; původní incremental běh nesl staré chyby cíle ES2017. Cíl upraven na ES2020 kvůli BigInt, Node 24 zůstává zachován.
- Zbývá UI, úplné HTTP rozhraní, modely Drizzle, širší souběžné/bezpečnostní testy, regrese a desktop/mobil. Etapa 6 zatím není dokončena, další etapy nezačínat.

### Dokončení etapy 6 (17. 11. 2026)

- Funkční materiálové karty s typem, specifikací, úpravou názvu/popisu, archivací a obnovou. Specifikace a jednotka po prvním pohybu chráněny serverem i SQL triggerem. Archivovaná zásoba je viditelná; nové pohyby jsou blokované.
- Zásoby mají hledání, typový filtr a stabilní stránkování. Detail rozlišuje neúplné ocenění, známou hodnotu, neoceněné množství a plný průměr pouze u oceněné zásoby. Množství různých jednotek se nesčítají.
- Počáteční stav, atomické vícepoložkové nákupy (včetně opakované karty), odpis s důvodem, inventura s očekávanou verzí. Historie je append-only, obsahuje osm samostatných delta složek a historickou specifikaci, pořadí zaúčtování nezávislé na datu nákupu. Oprava přes inventuru má odkaz na původní operaci. Nákup po zaúčtování je pouze pro čtení, včetně poznámky/příloh.
- Faktury přes existující souborový modul: PDF/DOCX/MD, ověření/retry, skutečná vlastnická FK. Sticky workshop_only brání čtení/finalizaci i přes obecné souborové endpointy bez dílny. Úklid respektuje fakturové reference.
- UI Zásoby / Nákupy / Pohyby, filtry historie podle typu, materiálu a data, stránkování, české desetinné vstupy, potvrzení změn a chyby s fokusem. Přidána ochrana rozepsaných formulářů. Obecné dokumenty a školní výrobky zachované.
- Diagnostika `GET /api/inventory/reconcile` ověří přihlášeného vlastníka/dílnu a porovná všechny složky balance s historií pod zámkem, bez oprav. Drizzle modely přidané pro sklad i rozšíření souborů.

### Skutečně spuštěné kontroly etapy 6

- Lokální migrace, lint, typecheck a produkční build prošly. Žádné nové knihovny nebo upgrade frameworku; target ES2020 kvůli přesné BigInt aritmetice.
- Celá integrační regrese: **45/45**. Starý test etapy 5 upraven z neexistence skladových tabulek na nulové skladové pohyby školního uživatele; opakování prošlo.
- Rozšířený skutečný skladový test samostatně opakovaně prošel. Obsahuje 20 g/700 Kč → odpis 2 g → 18 g/630 Kč, smíšené ocenění kovů i kusů, úplné vyčerpání zbytků, malé odpisy, celočíselné ks, numeric limit/přesnost, duplicitní/souběžný počáteční stav a nákup, jiný payload pod stejným klíčem, souběžné odpisy proti přečerpání, příjem+odpis, nákupy v opačném pořadí karet, rollback po chybě druhého řádku, inventurní konflikt, archivaci a zákaz změny typu s historií. Rekonstrukce souhlasí; runtime DELETE historie odmítnut. A/B izolace, faktura A nepřístupná B, bezkontextová RLS, vypnutí dílny blokuje sklad i read/finalize faktury, úklid připojenou fakturu zachová.
- Celá prohlížečová regrese: **8/8**, zachované testy účtů/hesel/dokumentů/školního cyklu včetně restartu Next. Nové skladové scénáře na 1440 a 375 px: karta, dva nákupní řádky, skutečný upload PDF faktury, její dostupnost jen s dílnou, odpis, inventura, historie a nové přihlášení. Nulové vodorovné přetečení.
- Skladové E2E po úpravě rozvržení samostatně **2/2**. Screenshoty desktop/mobil vizuálně zkontrolovány v dočasném adresáři OS, pouze fixture data. `git diff --check` bez problémů.

### Hranice a další krok

- Lokální implementace; bez push, cloudu, Heroku a nasazení, bez resetu osobních dat. Testy uklízejí jen vlastní UUID. Testovací weby skončily; lokální Supabase zůstává dostupný.
- Podporované skladové operace jsou nezávislé na výrobcích. Rezervační sloupce jsou nulové; workflow rezervací, own výroba, vratný odpad a vypořádání nejsou implementované. Source own nadále odmítá původní server i SQL.
- Příjem neopravuje staré neznámé ocenění. Úplné historické přepočty, editace zaúčtovaného nákupu a účetnictví nejsou nabízené. Platí dosavadní limity a ochranné lhůty souborů. Ověření pouze lokální; produkční provoz nebyl testovaný.
- Spuštění a přesný ruční scénář jsou v README. Etapa 6 dokončena; etapy 7–8 nezačínat bez nového zadání.

## Etapa 7 — průběžný záznam implementace (17. 11. 2026)

- Výchozí git stav čistý. Zadání zachováno v stage-07-prompt.md, rozhodnutí cenových částí/LIFO/zámků/hranice webu zapsána před migrací.
- Lokálně bez resetu aplikovány 20261117000500_reservations.sql a 20261117000600_reservation_integrity.sql. Reservation, cenové části, mapování ProductMaterial, ledgerové reserve/release a FK výrobku/části/karty. Runtime nesmí měnit původní ocenění nebo mazat cenové části; odložený trigger kontroluje součet rezervovaného fondu.
- Společný Operation mechanismus nyní umožňuje použití uvnitř zahájení výrobku, bez druhé transakce. Interní own save/start a cílové updateReservations s kontrolou revize/verze, kompatibility, dostupnosti a explicitního mapování. Snapshot obsahuje požadavek i potvrzenou specifikaci karty. Uvolnění LIFO vrací původní hodnoty; všechny návraty předcházejí novému čerpání pro atomické výměny karet.
- Webové mutace own odmítají. Own dokončení, skutečnost a obecný návrat do planned jsou ve službě odmítnuté. Ve skladu read-only přehledy obou fondů a cenových částí; připraven callbackový formulář pro etapu 8, bez endpointu nebo skrytého bypassu.
- První integrační regrese **54/54** skutečný PostgreSQL/Auth/Storage. Další doplněné scénáře a prohlížečové ověření dosud probíhají. Etapa zatím není označena za dokončenou.

### Etapa 7 — dokončeno (17. 11. 2026)

- Mapování požadavků na vlastní karty, povinné potvrzení a verze karty, kontrola typu/jednotky a dostupných strukturovaných parametrů. Null množství normalizuje rezervování na false; známé množství lze vědomě nerezervovat. Nedostatek nikdy nezapíná tento režim automaticky.
- Interní saveProduct/startProduct umožňují own s aktivním účtem a dílnou. Atomické zahájení používá společnou snapshot cestu a Operation v téže transakci. Materiál, snapshot a potvrzená karta uchovávají původní specifikaci. Při konfliktu revize nebo nedostatku vše rollbackuje.
- Reservation uchovává identitu, původní ocenění a zbývající složky každé cenové části. Navýšení vytvoří novou část. Částečné uvolnění LIFO vrací původní hodnotu, úplné uvolnění i poslední zbytky. Při výměně karet se nejprve vracejí všechny snižované části, pak čerpají nové, pod společnými stabilními zámky.
- Cílové rezervace vyžadují row_version a idempotentní klíč. Retry starého startu po změně rezervací je neobnoví. Samostatné uvolnění zachová in_progress a snapshot. Archivovaná karta dovolí uvolnění, nové čerpání vyžaduje obnovu. Příjem/odpis/inventura nadále pracují pouze s volným fondem.
- Ledger má reserve/release a přesné vazby na výrobek, materiálovou cenovou část i kartu; původní historie se nemění. Diagnostika rekonstruuje oba fondy a porovnává aktivní části. SQL odložený trigger blokuje nesoulad rezervovaného fondu s částmi a runtime granty zakazují přepis původních cenových podkladů.
- Skladové přehledy volné/rezervované/celkové zásoby, známých hodnot a neoceněné části, cenových částí podle výrobků, pohybů a odkazů. Vlastní detail je pouze pro čtení. Připravené callbackové mapovací/cílové formuláře nemají HTTP endpoint a nejsou běžně připojené. Webové mutace source=own a akce own výrobků odmítají; own dokončení, skutečnost a návrat do planned blokují i interní služby.
- Aktualizované README a decisions, nová `docs/inventory-model.md`, modely Drizzle a cleanup izolovaných fixture dat. Bez nových závislostí a bez změn původních aplikovaných migrací.

### Skutečně spuštěné kontroly

- Obě nové migrace aplikovány pouze lokálně bez resetu. Lint bez chyb/varování, typecheck a produkční build prošly; `git diff --check` bez problémů.
- Celá integrační regrese **54/54**, skutečný Auth/PostgreSQL/Storage a omezená runtime role. Nové rezervace **9/9** (8 scénářů + hlavní test), po doplnění přímých databázových pokusů samostatně znovu **9/9**.
- Ověřeno: číselný příklad 10g/300 → 5g/150 → nákup 5g/200 → navýšení 2g/70 → 7g/220 rezervováno, 8g/280 volných → plné uvolnění 15g/500; částečné LIFO přes nové i původní části; smíšené ks, účetní podíly a malé opakované přesuny; dva výrobky o poslední zásobu; více řádků jedné karty; atomické selhání při přesunu; souběh příjem/odpis/inventura/uvolnění a výměny mezi dvěma výrobky; idempotence a staré verze; null a vypnuté rezervování; strukturovaná ryzost, potvrzení karty, revize vzoru a historický snapshot/checkbox; archivace a vypnutí/obnovení dílny.
- Bezpečnost: A/B izolace a cizí mapování, nepříslušný materiálový řádek téhož uživatele, přímý složený FK, bezkontextová RLS, inactive/pending_password/stará relace; runtime UPDATE původní ceny Reservation i UPDATE/DELETE historie odmítnuté. Přímá změna balance porušující rezervovaný fond odmítnutá při commitu. Rekonstrukce všech složek souhlasí po scénářích.
- Celá prohlížečová regrese **10/10**, zachované etapy 2–6 včetně restartu Next. Nové přehledy na 1440 i 375 px, skutečně připravené interními službami v izolovaném subprocessu; bez veřejného seed endpointu. Ověřeny veřejné own mutace (409), source=own při založení (400), read-only detail, A/B přímé GET, vypnutí/zapnutí dílny a zachování rezervace. Obě šířky bez vodorovného přetečení.
- Screenshot mobilního skladového detailu vizuálně zkontrolován; snímky obou šířek jsou v dočasném adresáři OS, pouze izolovaná testovací data. Následné úpravy upřesnily popisky volného fondu a zablokovaly přímou editační stránku own deníku; lint/typecheck/build poté opět prošly.

### Omezení a další krok

- Lokální ověření, bez push/nasazení/cloudových změn/Heroku a bez resetu uživatelských dat. Fixture účty i jejich rezervace/soubory uklizeny podle vlastních UUID; testovací webové procesy skončily. Lokální Supabase běží.
- Běžné vlastní výrobní akce se v této etapě neotevírají. Přehled může být prázdný, dokud nevzniknou skutečná data po otevření cyklu; nevytvářet demo data v účtu uživatelky. Integrační příkaz pro rezervace je v README.
- Vlastní dokončení, skutečná spotřeba, vratky, odpad, vypořádání a bezpečný návrat do planned nejsou implementované. Etapa 8 musí doplnit celý tento cyklus a teprve společně otevřít webové mutace a připravené komponenty. Školní cyklus zůstává funkční.
- Etapa 7 dokončena. Etapu 8 nezačínat bez nového zadání.

## Etapa 8 — průběžná implementace (17. 11. 2026)

- Výchozí git stav obsahoval necommitnutou etapu 7; zachována a rozšířena, bez resetu či přegenerování. Zadání zachováno v stage-08-prompt.md.
- Rozhodnutí kumulativní skutečnosti, FIFO odběru/LIFO uvolnění, poměrných kategorií a kompenzačních oprav zapsána před kódem. Lokálně aplikovány 20261117000700_settlements.sql, 20261117000800_settlement_results.sql a 20261117000900_settlement_integrity.sql.
- Interní dokončení/oprava/návrat fungují s neměnnými cenovými částmi, revizemi a ledgerem, v jediné Operation transakci. Náhled používá tentýž výpočet v rollbackované transakci. Po návratu je skutečnost kumulativní a další dokončení neúčtuje starý odběr podruhé. Doplňování skutečného materiálu nepřepisuje snapshot.
- Otevřen own cyklus ve webových mutacích a UI po prvním úspěšném integračním ověření. Explicitní zdroj, mapování/rezervace, checkboxy, deník/fotky, skutečnost s náhledem, opravy a historie; školní cyklus zachovaný. Archivace/obnova místo destruktivního mazání, filtr archivovaných a ochrana souborů zachovaná.
- První regrese 65/65 integračních testů, nový vlastní prohlížečový průchod 2/2 na 1440 a 375 px. Rozšířené vypořádání samostatně 13/13 včetně souběhu a archivace. Závěrečné kontroly po posledních doplněních ještě probíhají; etapa zatím není označena za dokončenou.

### Etapa 8 — dokončeno (17. 11. 2026)

- Zpřístupněn celý vlastní cyklus v běžném UI i autorizovaných mutacích:
  ruční výrobek nebo vzor, explicitní school/own s dílnou, mapování,
  dobrovolná rezervace, kroky, deník/fotky, skutečnost, náhled a dokončení.
  Bez dílny se používá school a přímé own založení je 403.
- Odběr = ve výrobku + použitelná vratka + vratný odpad + nevratná ztráta.
  Vlastní skutečnost je povinně známá/potvrzená, včetně explicitních nul.
  Nový skutečný materiál lze přidat. Ks jsou celé a jejich odpad je 0.
  Cílová rezervace je oddělená od odhadu plánu; neprovádí se tichý fallback při nedostatku.
- FIFO cenové podklady rezervací, volný fond pro rozdíl, uvolnění přebytku
  v původním ocenění. Hrubý odběr všech řádků musí být dostupný před vratkami.
  Kategorie se rozdělí přesnou aritmetikou s deterministickými zbytky.
  Náklad zahrnuje výrobek a ztrátu, odpad nikoli; úplnost vychází jen z nákladových kategorií.
- Neměnné ProductSettlement/SettlementLine, předchozí revize, cenové části,
  snímky materiálu/karty a Operation výsledky. Oprava vyžaduje důvod/revizi,
  zachovává původní ceny pro původní množství a zapisuje přesné kompenzační rozdíly.
  Jiné výrobky, rezervace a nákupy nepřepočítává. Neproveditelná oprava je konflikt.
- Kumulativní skutečnost při návratu do planned, včetně nenulového odběru.
  Restart zachová snapshot, kroky, deník a již evidovanou spotřebu.
  Další dokončení účtuje pouze rozdíl; completed_at opravy nemění.
- Náhled používá tentýž výpočet a rollback. Potvrzení kontroluje verze fondů
  a při změně skladu/ocenění vrátí STOCK_CHANGED se zachováním vstupu.
  Aktualizace podkladů zachová množství a přidá nové řádky k potvrzení.
  Síťová nejistota ponechá původní klíč a náhled pro bezpečný retry.
- Archivace/obnova nic nespotřebuje ani neuvolní. Filtr archivovaných,
  zákaz hard DELETE, zachované soubory a rezervace. Finanční akce vyžadují obnovu.
  Pracovní materiál s historií nelze odstranit nebo změnit jeho fyzický význam.
- Nový editovatelný/idempotentní vzor také z ručního own výrobku:
  množství taken-returned, tedy i odpad/ztráta, bez přenosu ceny, rezervací,
  fotografií a checkboxů. Pozdější oprava nemění již vytvořený vzor.
- Rozšířeny Drizzle modely, diagnostika ledger/balance/rezervace/aktuální
  vypořádání/náklad Product, odložené kontroly souhrnu a revizí a owner-scoped FK.
  Aktualizované README, decisions a inventory-model. Původní migrace zachované,
  bez nových knihoven nebo plošných upgradů.

### Skutečně spuštěné závěrečné kontroly

- Lokální migrace 007/008/009 aplikovány bez resetu dat.
- Lint bez chyb/varování, typecheck a produkční build prošly.
- Celá integrační regrese **67/67** na skutečném Auth/PostgreSQL/Storage,
  včetně zachovaných etap 2–7. Vypořádání **13/13** (12 scénářů a hlavní test).
- Ověřeny oba číselné příklady: 120 Kč s 5,5g/165Kč volně a nulovou rezervací;
  126 Kč s 5,3g/159Kč při ztrátě 0,2g. Dále FIFO více cenových částí,
  pod/přes/nad rezervaci, částečná rezervace proti odhadu plánu,
  bez rezervace/null plán, neznámá a nulová cena, nulový odběr,
  neoceněný odpad při úplném nulovém nákladu, celé ks a zákaz jejich odpadu.
- Úplný rollback více řádků/karet a nových materiálů při nedostatku;
  hrubá dostupnost před vratkou; dvojklik/souběh, ztracený výsledek a payload konflikt;
  změna skladu od náhledu; dokončení souběžně s nákupem, odpisem a rezervací.
- Opravy kategorií stejného odběru, zvýšení/snížení a opakované opravy,
  stará revize/klíč, jiná nákupní cena, ochrana cizí rezervace a odmítnutá oprava.
  Nulový i nenulový návrat/restart bez dvojí spotřeby a druhého snapshotu.
  Archivace aktivní rezervaci zachová; nový vzor je idempotentní a další oprava jej nemění.
- A/B a cizí karta, inactive/pending_password/stará relace a vypnutá dílna,
  skutečná runtime RLS bez kontextu, odmítnuté přepsání/smazání revizí,
  shoda rekonstruovaných složek a aktuálního vypořádání. Školní cyklus bez ceny dál prošel.
- Celá prohlížečová regrese **12/12** v Chrome s produkčním Next.
  Nový vlastní průchod na 1440 a 375 px: karta a zásoba 10g/300Kč,
  ruční own výrobek, rezervace, 100% kroků bez auto-done, deník s obrázkem,
  průběhová fotografie, skutečnost, náhled, dokončení za 120Kč,
  oprava na 126Kč se stejným completed_at, hotová fotografie, editovatelný nový vzor,
  own ze vzoru bez rezervace a s potvrzeným nulovým odběrem, nové přihlášení,
  archivace/obnova s fotografiemi a odmítnutý DELETE.
- E2E skutečně nechá server dokončit požadavek a zahodí odpověď; retry zachová
  rozepsané hodnoty a skončí jedinou revizí bez druhého odečtu. Zachované testy
  dokumentů včetně restartu Next, účtů, hesel, skladu a školního cyklu prošly.
  Dřívější testy zákazu own byly upraveny na nové autorizované otevření s dílnou;
  bez dílny je own dál odmítnutý serverem.
- Obě šířky bez vodorovného přetečení. Vizuálně zkontrolován desktopový náhled
  a mobilní hotový detail; screenshoty v dočasném adresáři OS obsahují jen fixture data.
  Git diff --check bez problémů.

### Hranice a další krok

- Lokální implementace a ověření, bez cloudových migrací, push, nasazení,
  změn Heroku nebo resetu uživatelských dat. Předchozí necommitnutá etapa 7 zachovaná.
  Testy uklidily jen svá UUID, rezervace, vypořádání a soubory. Testovací weby skončily,
  lokální Supabase zůstává dostupný.
- Ruční scénář školního i vlastního cyklu je v README. Oprava může být odmítnutá,
  pokud nelze zachovat původní podíly/hodnoty a pozdější rezervace; žádný globální
  historický přepočet. Výrobky se archivují, nikoli destruktivně mažou.
- Žádný sklad odpadu, převod materiálu mezi kartami, prodejní cena, účetnictví,
  export, zálohy nebo pilot. Produkční/cloudový provoz nebyl testovaný.
- Etapa 8 dokončena. Etapu 9 nezačínat bez nového zadání.

## 17. 11. 2026 — Etapa 9: dotažení MVP, export a obnova

### Implementace

- Před změnami založena docs/mvp-acceptance.md s neověřenými body; doplněna
  důkazy skutečných testů, samostatné zadání stage-09 a návody export/backup.
  Předchozí necommitnuté etapy 7–8 zachované, žádný reset nebo redesign.
- Nastavení → Export vlastních dat: JSON celé vlastní domény včetně historie,
  archivovaných výrobků a všech revizí, doplňková CSV, manifest, přílohy a fotky.
  SHA-256, přesné decimal/bigint řetězce a null, UTC, čeština, CSV vzorce,
  bezpečné UUID cesty a rozlišení duplicitních původních názvů.
- Úzká SQL read výjimka pro vlastní historické skladové záznamy a soubory po
  vypnutí dílny; běžný sklad/faktury/mutace zůstávají uzavřené. Aktivní účet a
  skutečná relace, žádný owner argument, private/no-store, žádné tajné hodnoty.
- DB snapshot končí před sítí. Chybějící/poškozený ready soubor ruší archiv;
  pending/deleting a oddělené soubory mají complete=false. Limity bez oříznutí,
  globální DB lease, timeout, sekvenční čtení a release při chybě/odpojení.
  Bez diskového úložiště dyno, jobů, placených služeb nebo nové závislosti.
- Soubory nad 32 MiB celkem lze získat samostatně vedle datového ZIP. Tlačítka
  mají průběh, zrušení, českou chybu s fokusem a pravdivou zprávu neúplnosti.
- Opraveny zastaralé placeholderové texty Přehledu a Nastavení, které po etapě 8
  stále slibovaly sklad/vlastní výrobu až v budoucnu. Zbytek navigace, hledání,
  filtrů, stránkování, dirty/conflict stavů ověřen zachovanými scénáři.
- Samostatné ops:backup, ops:backup:verify, ops:restore a cílené ops reset/status/
  resume pro označený obnovený lokální cíl. Záloha app schématu, dat všech
  vlastníků, grantů/RLS/sekvencí, migrací/role/Auth konfigurace a skutečných
  Storage bajtů. Kontrolní součty, časové okno, verze, počty, chráněné soubory.
- Okno bez zápisů/úklidu zahrnuje DB, Auth i Storage. SQL SHARE zámky a dvojí
  kontrola Storage během ops zálohy. Nedokončená záloha nemá úspěšný manifest.
- Restore používá původní Auth UUID přes Admin API, nová neznámá hesla a řízený
  reset bez SMTP. Nekopíruje Auth interní tabulky, password hashes ani sessions.
  Inactive/disabled a ban zůstávají blokované, staré sessions odmítnuté.
- Obnova jen do nového izolovaného /private/tmp cíle s markerem, krátkým
  project ID, porty, vlastními volumes a Docker project/workdir štítky.
  Naplněný cíl se nepřepisuje. Kontrola shody migrací s checkoutem.
- Serverová Auth/Storage konfigurace používá Reflect.get pro skutečné runtime
  čtení. Samotný alias process.env byl v Turbopack stále vložen při buildu;
  oprava ověřena v sestaveném kódu i přihlášením do obnoveného projektu.

### Skutečně provedené kontroly

- Migrace 010 aplikovaná lokálně bez resetu dat. Lint, typecheck, produkční
  build a git diff --check prošly. Žádný nový balíček ani změna lockfile.
- Celá integrační regrese **74/74**, skutečný Auth/PostgreSQL/Storage a runtime
  role. Exportní sada **7/7**, včetně archivovaného own výrobku, dvou revizí,
  snapshotu, přesných čísel/null, A/B, vypnuté dílny, poškozeného/chybějícího
  objektu, pending, přerušení, 10 001 řádků a převzetí expirovaného lease.
- Souběžný nákup během čtení exportního souboru uspěje na stejném runtime poolu;
  archiv dál obsahuje původní DB snapshot. Nedrží dlouhé skladové zámky.
- Závěrečná úplná prohlížečová regrese **14/14** (cca 1,2 min), včetně
  skutečného restartu Next a souborů, školního a vlastního cyklu na 1440 i 375 px.
  Ověřen skutečný download tlačítkem, chybějící soubor s českou chybou a fokusem,
  odpojení a uvolnění lease. Export vizuálně zkontrolován na 375 px, bez přetečení.
  Testovací selektor chyby rozlišuje Next route announcer.
- **Skutečná izolovaná obnova 1/1 prošla**, poslední běh cca 51 sekund.
  Zdroj 55321/55322 a cíl 56321/56322, odlišná project ID a volumes,
  produkční Next 3104 a Chrome na desktopu i 375 px. Tři syntetické identity,
  poznámka s obrázkem, PDF, postup, školní done/null cena a vlastní výroba
  s fakturou, rezervací, dokončením, odpadem a opravou.
- Obnova ověřila počty všech app tabulek, validní FK, SHA-256 všech tří souborů,
  původní UUID vlastníků, skutečné přihlášení přes řízený reset a vynucenou
  změnu, zachování Auth banu/inactive, staré relace, A/B, RLS, ledger a nové
  operace/sekvence. Obnovená poznámka, obrázek a školní výrobek se vykreslily.
  Corrupt/missing/INCOMPLETE byly odmítnuté před vytvořením app schématu;
  naplněný cíl i source jako cíl odmítnuté.
- Samostatně spuštěné skutečné CLI ops:backup:verify a ops:restore nad
  syntetickou testovací zálohou také prošly. Vygenerovaná cílová .env.runtime
  se připojila omezenou rolí; RLS bez kontextu vrací nula dokumentů. Dodatečný
  projekt zastaven přes ověřený workdir, běžný lokální projekt zachován.
- Ověřené verze: Node 24.16.0, Supabase CLI 3.2.0, PostgreSQL 17.12,
  Next 16.4.6, supabase-js 2.119.0. Příkazy a hranice v backup-and-restore.md.

### Hranice a další krok

- Bez cloudového pilotu, nasazení, push, supabase link, nových účtů/služeb,
  změn Heroku nebo resetu osobních dat. Privátní fixture zálohy jsou mimo Git
  v dočasných adresářích OS, se syntetickými údaji. Testy uklidily své běžné
  fixture účty a soubory, izolované projekty byly zastavené.
- Export není automatický import. Záloha vyžaduje klidové okno a chráněné
  lokální uložení. Nejvýše 32 MiB příloh v plném ZIP, jinak odděleně; limity
  dat, času a souběhu jsou výslovné. Paměť skutečné Eco dyno dosud neověřená.
- **Etapa 9 dokončena a lokálně ověřena, bez otevřeného blokátoru.**
  Všechny body akceptační mapy v lokálním rozsahu ověřené. Práce zde končí.
  Další krok je pouze samostatně autorizovaná etapa 10: konkrétní pilotní konfigurace, HTTPS,
  migrace/runtime RLS, soukromý bucket, Eco/paměť/restart a provozní zálohování.
  Přehled názvů konfigurace je v README a .env.example, bez hodnot tajemství.

## 17. 11. 2026 — Etapa 10: nasazený uzavřený pilot — technické ověření

- Výchozí čistý commit 9e08d88 obsahuje etapy 7–9 a doloženou lokální obnovu.
  Lokální soubory/DB se nepřepnuly do cloudu. Žádná osobní data se neimportují.
- Přes API ověřena osobní EU aplikace craftbook-app,
  e1b8d94d-af33-4b0d-b45d-a9f2bb3a8de7, heroku-24, oficiální Node buildpack,
  bez add-onů/workerů, dostupná velikost Eco. Supabase ref
  vayxezlkyognarkqebbg, eu-west-1, organizace jfrylueyelglcduamzin, prázdný
  DB/Auth/Storage před první mutací. Automatic Deploys potvrzené vypnuté.
- Připraven oddělený cloudový setup/ops a chráněná konfigurace, TLS a password
  URL builder. Cloudové migrace 12/12 skutečně aplikovány se SHA-256 historií,
  bez superusera; runtime přes pooler ověřen bez vlastnictví/BYPASSRLS/členství
  a s uzavřenou RLS bez kontextu. Oba úseky TLS po cíleném SSL enforcement.
- Auth registrace/provideri uzavřené, přesný HTTPS Site URL, soukromý bucket
  a politika. Osobní první účet připraven pending_password s expirací 48 h;
  dočasné údaje jen v ignorovaném 0600 souboru, nikoli reportu/Git.
- Heroku runtime Config Vars připravené bez migrační URL a Auth Admin klíče,
  s CA. Nový start/Procfile, Node 24 a produkční build, kanonické HTTPS.
- Lokální kontroly: 74/74 integračních, 14/14 E2E, 3/3 testy cloudových ochran,
  1/1 skutečná izolovaná obnova síťového dumpu včetně Auth/Storage a 375 px.
  Lint/typecheck/build prošly i po dokončení provozního smoke skriptu.
  Kontrola souborů ke commitu nezjistila cloudová tajemství ani osobní e-mail.
- Security advisors: pouze záměrné INFO pro ops tabulky bez RLS politik a WARN
  leaked-password protection; žádná placená funkce nebyla zapnutá.
- Živá verze: Heroku **v5**, release c8854ff8-f80b-415d-b7b7-c057b5358108,
  commit **e41fd0fda7c0a58665c8c1796d8aea0f306403e0**, build
  ae610943-a140-41a3-8c90-dd721041d79e. Archiv přesného commitu, push na main.
  Pozdější doplnění provozních nástrojů/dokumentace nemění tento nasazený SHA.
- Cloudový smoke skutečně prošel přes HTTPS: povinná změna hesla, secure cookie,
  zákaz registrace, refresh, odmítnutí staré relace po resetu a deaktivace;
  obrázek/PDF, A/B soubory i dokumenty, postup a školní done s null cenou,
  vlastní nákup/rezervace/dokončení **120 Kč, 5,5 g / 165 Kč volných, rezervace 0**,
  úplný ZIP export a prohlížeč 1440/375 bez přetečení. Restart skutečné dyno
  zachoval DB i soubory. Dva schválené syntetické účty jsou deaktivované;
  jejich oddělený ledger zůstává. Osobní účet zůstal pending_password.
- Jeden Eco web, bez add-onů a workerů. Pozorované maximum paměti **124,15 MB**
  (61 vzorků), žádné R14/R15; runtime pool max 5, při klidu 0 DB spojení.
  Nejde o zátěžový test ani garantované maximum. API kvóty v 15:13 UTC hlásilo
  1 000 / 1 000 Eco hodin zbývajících; jde o průběžné sdílené vyúčtování, ne
  rezervaci hodin pro tento web.
- Skutečná pilotní záloha mimo Git v chráněném adresáři
  /Users/user/Desktop/Dev/craftbook-backups/pilot-2026-11-17T14-36-35-825Z:
  25 app tabulek, 3 skutečné soubory, 3 vlastníci, Auth politika bez tajemství,
  aplikované migrace a SHA-256 manifest. Během zálohy web=0 a žádné další zápisy.
- **Obnova této skutečné pilotní zálohy prošla** do odděleného lokálního projektu:
  počty 25 tabulek, SHA-256 všech 3 souborů, UUID, validní FK, omezená runtime
  role/RLS bez kontextu a blokace 2 disabled + 1 pending_password. Cíl zastaven.
  Pilot nebyl přepsán; osobní heslo nebylo měněno. Přihlášení/render po obnově
  navíc pokrývá samostatný syntetický test cloudového dumpu 1/1.
- Údržba osiřelých souborů má samostatný cloudový dry-run/apply wrapper s kontrolou
  cíle a sdílenou logikou; lokální ochrany se neobcházejí. Skutečný dry-run:
  0 kandidátů, 0 smazaných, 0 chyb. Závěrečný lint/typecheck/build i 3/3 cloud
  ochrany prošly. Kontrola zdrojů a browser bundle: žádná cloudová tajemství
  ani osobní e-mail.
- Přirozené uspání Eco a následné probuzení: ověření probíhá bez HTTP keep-alive.
- Čeká na uživatelku: vlastní první přihlášení a změna hesla (lokální
  .env.pilot-login.local, expirace 48 h), skutečný telefon/fotka a praktický průchod.
  To není nahrazeno automatickým testem. Žádní další uživatelé ani V1 se nezakládají.
