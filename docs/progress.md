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
