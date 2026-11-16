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
- Docker není dostupný v PATH; pro etapu 2 připravit lokální Docker + Supabase, případně výslovně zvolené izolované prostředí. Etapu 1 to neblokuje.
- ESLint 9 je v npm označen jako nepodporovaný. Vybraná konfigurace Next má tranzitivní pluginy deklarující kompatibilitu pouze do řady 9; zachována kompatibilní verze 9.39.5. Technický dluh zaznamenán v decisions. Nejde o runtime závislost; přechod na řadu 10 provést s podporovanými pluginy.
- Síťové instalace, spuštění lokálních serverů a Chrome vyžadovaly rozšířené sandbox oprávnění; poté proběhly úspěšně.

### Vyzkoušení a další krok

`npm ci`, `npm run dev`, otevřít http://localhost:3000. Projít navigaci, Materiály, neaktivní Nastavení a Přihlášení. Zúžit na 375 px a vyzkoušet hamburger, Tab a Escape.

Etapa 1 končí zde. Další je samostatně zadaná etapa 2 (skutečná identita, omezená runtime DB role, transakční kontext, RLS a testy dvou uživatelů); automaticky nezačala.
