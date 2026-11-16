Craftbook — prompt pro Codex, etapa 2
Pracuj v existujícím repozitáři Craftbook. Implementuj etapu 2: skutečná identita a oddělení dat. Etapa 1 je dokončená, Docker je nově nainstalovaný. Tvým úkolem je provést lokální implementaci a ověření, ne pouze napsat návrh. Komunikuj česky.
1. Nejprve načti kontext
Přečti AGENTS.md, docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md a pro změny UI také docs/ui-guidelines.md.

Výchozí schválené revize jsou produktová 0.3, technická 0.2 a implementační plán 1.1. Respektuj novější schválená rozhodnutí. Pokud podklady chybějí nebo si zásadně odporují v bezpečnostních pravidlech, popiš konkrétní problém; nevymýšlej jejich obsah. Tento prompt upřesňuje hranici mezi etapami 2 a 3.

Zkontroluj git status, strukturu projektu, package.json, lockfile a existující kód. Podle progress běží Next.js 16.4.6, React 19.3.1, TypeScript strict, Node 24 a npm. Ověř skutečnost v repozitáři; nepřegenerovávej projekt ani neupgraduj plošně závislosti. Zachovej nesouvisející změny i dosavadní responzivní rozhraní. Dluh kolem ESLint 9 neřeš bez přímé potřeby této etapy.
2. Cílový výsledek a rozsah
Uživatel se skutečně přihlásí e-mailem a heslem, vidí pouze svůj účet a nastavení, uloží display name a volbu vlastní dílny a může se odhlásit. Server i PostgreSQL vynucují oddělení dat. Veřejná registrace není dostupná. Ostatní moduly zůstávají pravdivými prázdnými stavy.

Implementuj lokální Supabase, Drizzle + pg, migrace, UserAccount/UserProfile, autentizaci, autorizaci, RLS, nastavení a odpovídající integrační testy.

Do této etapy nepatří: dokumenty a uploady, editor, výrobky, skladové entity a transakce, AI, admin UI ani kompletní provozní správa účtů. Etapa 3 řeší dočasná hesla, povinnou změnu, reset, deaktivaci prostřednictvím ops nástrojů a obnovu částečně dokončeného provisioningu. V etapě 2 však musí být bezpečnostní příznaky už respektované, nikoli ignorované.
3. Lokální prostředí a migrace
- Ověř docker version a docker info: nestačí dostupná binárka, musí běžet daemon. Při problému uveď konkrétní nápravu. Nepovažuj automaticky dřívější blokátor za vyřešený jen podle progress.
- Použij lokální Supabase CLI, verzovanou konfiguraci a reprodukovatelné npm skripty. Existující konfiguraci zachovej. Ověř potřebná API v oficiální dokumentaci odpovídající používané verzi.
- Neprováděj supabase link, cloudové migrace, založení cloudového projektu, změny Heroku, nasazení ani push. Stávající cloudový Supabase projekt může sloužit jiné aplikaci. Není náhradou za lokální testovací prostředí.
- Připrav .env.example bez tajných hodnot a README s pořadím spuštění, migrací a testů. Reálné lokální hodnoty patří do ignorovaného souboru. Nevypisuj tokeny, hesla ani celé připojovací řetězce do reportů.
- Odděl migrační DB připojení od runtime připojení. Runtime role nesmí být superuser, vlastník tabulek, mít BYPASSRLS ani možnost přepnout se do privilegované role. Použij malý pg pool, nejvýše 5 spojení pro běh aplikace.
- Pro lokální DB použij odpovídající lokální adresu. Nevynucuj cloudový pooler. Citlivé konfigurace a DB klient označ jako server-only; žádný privilegovaný klíč s prefixem NEXT_PUBLIC.
- Urči jeden autoritativní způsob verzování a aplikace migrací v Drizzle/Supabase a zdokumentuj ho. Migruj i role, granty a politiky; nepoužívej nezdokumentované ruční SQL jako podmínku běhu.
- Bez výslovné potřeby nemaž lokální data. Destruktivní reset je přípustný pouze pro prokazatelně izolované, jednorázové testovací prostředí, které jsi pro tento účel vytvořil.
4. Datový model a autorizace
Vytvoř zatím pouze potřebný základ podle technické specifikace:
- UserAccount: vazba na Auth ID, status, must_change_password, temp_expires_at, sessions_valid_after.
- UserProfile: vazba na uživatele, display_name, has_workshop s výchozí hodnotou false.
Schéma app nevystavuj přes Supabase Data API. Zapni RLS a nastav minimální granty. Uživateli povol pouze úpravu jeho běžných profilových polí, nikoli chráněných příznaků účtu. Metadata měnitelná uživatelem nejsou zdrojem oprávnění.

Před implementací stručně popiš mechanismus načtení UserAccount: jak ověřená identita získá vlastní stav účtu, aniž by vznikla rekurze RLS nebo neomezené čtení všech účtů. Zaznamenej rozhodnutí do docs/decisions.md. Pokud použiješ SECURITY DEFINER, musí být úzce omezený, mít bezpečný search_path a explicitní oprávnění. Neřeš problém použitím postgres nebo service role pro běžné dotazy aplikace.

Zaveď společný serverový mechanismus: ověřená identita → transakce → transakčně lokální uživatelský kontext → kontrola účtu/relace → autorizované dotazy. ID nikdy nepřebírej jako autoritu z formuláře nebo URL. Přímé pg spojení nemá automaticky nastavené auth.uid(); politiky musejí odpovídat skutečně nastavenému kontextu. Chybějící či neplatný kontext nesmí zpřístupnit data. Kontext se nesmí přenést na další požadavek při opětovném použití spojení, ani po rollbacku.

Auth identita bez odpovídajícího aplikačního účtu/profilu nemá běžný přístup. Zakázaný, neaktivní, expirovaný nebo pending_password účet a účet vyžadující změnu hesla nesmí do aplikace. Do implementace etapy 3 zobraz bezpečné vysvětlení a možnost odhlášení; nenastavuj tyto účty automaticky jako aktivní. Kontroluj sessions_valid_after vůči ověřeným údajům relace a popiš použitou semantiku. Obnovení tokenu nesmí samo obejít zneplatnění původní relace.
5. Přihlášení a nastavení
- Zprovozni stávající /login, odhlášení a obnovování relace pomocí podporované Supabase SSR integrace. Identitu ověřuj serverově; nespoléhej pouze na neověřený obsah getSession či klientský stav.
- Veřejné založení účtu vypni i v lokálním Auth provideru a ověř odmítnutí přímého registračního požadavku. Nepřidávej SMTP, sociální login ani registraci v UI.
- Chraň stránky, server actions a routy samostatně na serveru; pouhý redirect v layoutu nebo skrytá navigace nestačí. Ošetři neplatnou relaci, bezpečné návratové URL a ochranu mutací podle použitého frameworku. Neumožni sdílenou cache osobních dat.
- Přihlašovací chyby musí být srozumitelné, bez odhalování existence konkrétních účtů. Zajisti pending stav, prevenci opakovaného odesílání a přístupné popisky/chyby.
- Nastavení: skutečně ukládané display name a has_workshop, e-mail pouze pro čtení. Validace vstupu na serveru, potvrzení uložení a zobrazení chyb. Změna hesla zatím neaktivní s pravdivým vysvětlením.
- Bez vlastní dílny skryj Materiály a zakaž přímý serverový přístup k /materials, /materials/purchases a /materials/movements. S dílnou jsou dostupné dosavadní prázdné stránky, nikoli funkční sklad.
- Po přihlášení odstraň zavádějící označení náhledu bez přihlášení. Zachovej vizuální styl, české UI, mobilní drawer a ovládání klávesnicí.
- /api/health ponech veřejné, s přesným {"status":"ok"} a Cache-Control no-store, bez údajů o DB, Auth či konfiguraci.
6. Lokální účty pro vývoj a testování
Připrav minimální, opakovatelný lokální provisioning pro konkrétní Auth ID a vytvoření dvou izolovaných testovacích účtů. Nesmí vzniknout /admin, admin role ani webový privilegovaný endpoint.

Pro ověření této etapy mohou izolované lokální fixtures vytvořit aktivní účty s běžným heslem bez povinné změny. Jde výhradně o vývojová data, nikoli o produkční onboarding: nástroj musí odmítnout vzdálené Auth i DB cíle a nesmí být součástí runtime aplikace. Neoslabuj kvůli fixtures produkční pravidla. Běžný provisioning do budoucna zůstává podle specifikace pending_password.

Privilegované přístupy používej pouze v odděleném lokálním nástroji. Hesla nenechávej v Git, argumentech příkazové řádky ani logu. Umožni jejich bezpečné zadání a uveď jednoduchý postup, jak si uživatelka připraví vlastní lokální účet. Opakované spuštění nesmí bez upozornění přepisovat existující účet nebo heslo. Při částečném vytvoření identity zachovej zákaz přístupu a popiš nápravu; celý provozní workflow patří etapě 3.
7. Povinné ověření
Spusť existující lint, typecheck a build. Přidej smysluplné integrační testy nad skutečným lokálním PostgreSQL a Auth, ne pouze mocky. Testovací příprava smí použít migrační oprávnění, samotné kontroly RLS musejí běžet skutečným omezeným runtime připojením.

Ověř alespoň:
1. Přihlášení, odhlášení, refresh relace a odmítnutí neplatného hesla; žádný přístup bez ověřené identity.
2. Uživatel A nečte ani nemění profil B, včetně přímého požadavku obcházejícího UI a podvrženého ID. B má vlastní nezávislé nastavení.
3. Bez transakčního kontextu není dostupný žádný profil. Na stejném pool spojení proveď A → bez kontextu → B a variantu po rollbacku; identita nesmí uniknout.
4. Skutečná runtime role nemá oprávnění obcházet RLS ani měnit chráněné příznaky UserAccount. Dolož kontrolou práv i negativním testem.
5. Chybějící účet/profil, neaktivní účet, pending_password, povinná změna, expirace a zastaralá relace vedou k odmítnutí. Test zneplatnění relace zahrnuje pokus o refresh.
6. Přímá veřejná registrace je zakázaná. Ani podvržená metadata nezvýší oprávnění.
7. has_workshop je novému uživateli false; bez dílny jsou materiálové routy zakázané. Změna nastavení přetrvá reload i nové přihlášení.
8. Migrace a lokální provisioning jsou reprodukovatelné. Testy zasahují jen vlastní izolovaná data a prostředí.
9. Login a nastavení na desktopu a 375 px: bez přetečení, čitelné chyby, klávesnice a fokus. Health odpovídá původnímu kontraktu.
Při chybějícím Docker daemonu, síti nebo oprávnění pracuj dál na nezávislých částech. Neobcházej omezení připojením ke cloudu. Neoznačuj nespouštěné testy jako úspěšné a etapu jako dokončenou, pokud klíčové integrační ověření neproběhlo.
8. Předání a zastavení
Aktualizuj README, .env.example, docs/progress.md a relevantní docs/decisions.md. Zachovej historii etapy 1; starý blokátor Docker označ jako vyřešený až po ověření. Uveď přesné skripty pro start lokálního Supabase, migrace, vytvoření účtu, běh aplikace, testy a bezpečné zastavení bez smazání dat.

Na konci napiš stručný český report: co funguje, změněné části, výsledky skutečně spuštěných kontrol, blokátory a jak vyzkoušet přihlášení a nastavení. Nevypisuj tajné hodnoty. Uveď, že reset a změna hesla čekají na etapu 3. Po etapě 2 se zastav.