Craftbook — etapa 10: prompt pro Codex a ruční postup
Část A — vlož do Codexu v repozitáři Craftbook
Implementuj etapu 10: nasazení a ověření uzavřeného pilotu Craftbook na Heroku a Supabase. Proveď přípravu, dostupné autorizované nasazovací kroky a ověření. Komunikuj česky. Pokud krok vyžaduje ruční přihlášení nebo zadání tajemství, připrav vše ostatní a dej přesný krátký pokyn. Nevyžaduj znovu souhlas pro běžné kroky v níže uvedeném cíli a rozsahu.
1. Načti skutečný stav a ověř cíle
Přečti AGENTS.md, docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md, docs/mvp-acceptance.md, README a dokumentaci účtů, souborů, záloh a obnovy.

Zkontroluj git status, testy a výsledek etapy 9. Její dokončení ani úspěšnou obnovu zálohy nepředpokládej bez evidence. Oprav relevantní blokátory před otevřením pilotu; nevydávej neověřený bod za splněný.

Uživatelka již připravila NOVÉ cílové zdroje:
- Supabase project ref: vayxezlkyognarkqebbg.
- Supabase URL podle tohoto ref: https://vayxezlkyognarkqebbg.supabase.co — ověř proti konfiguraci.
- Sdílený session pooler: aws-0-eu-west-1.pooler.supabase.com:5432.
- Heroku origin ze screenshotu: https://craftbook-app-cab5aab2013a.herokuapp.com.
- Přesný Heroku app name/ID ověř v účtu/CLI. Z generované domény ho neodvozuj slepě.
- Existující Eco předplatné, jedna web dyno, žádný worker/add-on.
- Data API bylo pro nový projekt vypnuto; doménová data používají Drizzle/pg.
Před první vzdálenou mutací ověř konkrétní project ref, cílovou aplikaci, vlastnictví a prázdný nebo známý stav cíle. Při neshodě se zastav pouze u závislých cloudových kroků a vyžádej správný identifikátor. Ostatní staré projekty a aplikace neměň, nemaž ani nevypínej.

Autorizovaný rozsah je: připravit a nasadit Craftbook do těchto nových zdrojů, provést jeho migrace, bucket/politiky, konfiguraci a vytvoření prvního účtu. Žádný nový tarif, placený add-on, jiný region, jiný projekt ani automatický import lokálních osobních dat.
2. Udrž konfiguraci a tajemství odděleně
Zkontroluj skutečné proměnné aplikace. Screenshot šablony obsahoval:
- APP_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- DATABASE_URL
- MIGRATION_DATABASE_URL
- SUPABASE_SECRET_KEY
- STORAGE_SECRET_KEY
- limity a TTL souborového modulu
Rozdělení:
- Heroku web: origin, veřejná Supabase URL/publishable key, omezené DATABASE_URL, serverový Storage secret a potřebné limity.
- Lokální provozní prostředí pro cloud: migrační DB přístup, Auth Admin secret a případné další přesně potřebné hodnoty.
- Běžné lokální prostředí dál míří na lokální Supabase. Nepřepiš .env.local/.env.ops.local cloudovými údaji.
Připrav samostatné ignorované soubory pro cloudové ops, šablony bez hodnot a přesný návod. Nemíchej lokální a cloudový cíl automatickým dotenv načítáním. Ověř .gitignore i git diff; tajemství nejsou v .env.example, commitech nebo reportu.

MIGRATION_DATABASE_URL a Auth Admin SUPABASE_SECRET_KEY nedávej do webového runtime, pokud pro to neexistuje výslovná nezbytnost v aktuálním kódu. Storage klíč je privilegovaný, pouze serverový a nepoužívá se jako zkratka k doménovým datům. Žádný secret pod NEXT_PUBLIC.

Nečti a nevypisuj hromadně heroku config, env soubory nebo celé připojovací řetězce. Pro kontroly loguj názvy proměnných, přítomnost a bezpečné identifikátory, nikoli hodnoty. Hesla zadávej skrytým vstupem nebo přes bezpečný ruční postup bez argumentů shellu.
3. Připrav podporovaný cloudový provisioning
Současné lokální ops skripty podle dřívějšího screenshotu odmítají vzdálené adresy. Neodstraňuj jejich ochrany globálně. Přidej výslovný cloudový režim nebo samostatné tenké příkazy se sdílenou doménovou logikou:
- cílový project ref a hostname musí odpovídat povolenému Craftbook cíli,
- role pro migrace a runtime jsou oddělené,
- opakování nerozbije existující účet, heslo, data nebo bucket,
- destruktivní reset/restore běžného cloudového projektu je zakázaný,
- nikdy nespouštěj lokální fixture/seed automaticky do cloudu.
Ověř podporovanou cestu migrací pro hostovaný Supabase. Lokální migrace mohou předpokládat Docker superusera, existenci rolí nebo instalovaných extensions; uprav je kompatibilně bez snížení ochrany. Nevytvářej vlastní runtime roli s příliš širokým členstvím, vlastnictvím nebo BYPASSRLS.

Pro runtime použij craftbook_runtime (nebo existující ekvivalent), vlastní silné heslo a session pooler:
postgresql://craftbook_runtime.vayxezlkyognarkqebbg:ENCODED_ROLE_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

Runtime heslo se liší od postgres databázového hesla. Sestavení URL musí správně zakódovat speciální znaky. Zapni ověřované TLS podle oficiální dokumentace a pg konfigurace; neřeš certifikáty pomocí rejectUnauthorized=false nebo NODE_TLS_REJECT_UNAUTHORIZED=0. Malý pg pool max 5 na proces. Ověř, že SSL parametry connectionString nepřepíšou požadovanou konfiguraci driveru.

Migrační připojení může použít postgres session pooler, pokud vyhovuje nástroji; není runtime připojením. Při každém migračním kroku kontroluj cíl a stav migrační historie. Nepoužívej db reset nebo neprověřený schema push. Migrace se nespouštějí při každém startu webu; při existujících datech předem proveď zálohu dle etapy 9.
4. Supabase Auth a Storage
Ověř a podle možností nástrojů nastav nebo připrav ruční kroky:
- e-mail/heslo jako metoda přihlášení,
- veřejné registrace vypnuté,
- anonymní přihlášení a nepotřební poskytovatelé vypnutí,
- Site URL = přesný Heroku HTTPS origin,
- jen potřebné konkrétní redirect URL podle skutečných callback rout, bez širokého wildcardu,
- žádné SMTP, magic link nebo e-mailová pozvánka jako podmínka založení účtu.
První účet vytvoř přes cloudový ops postup etapy 3: Auth identita s potvrzeným e-mailem přes podporované Admin API bez odesílání zprávy, UserAccount/Profile pending_password, expirace a povinná změna hesla. Potvrzení e-mailu zde není důkaz jeho vlastnictví. Vstupní e-mail si vyžádej, pokud není jednoznačně určen. Nezaváděj admin roli ani /admin.

Připrav soukromý bucket podle skutečného názvu v kódu. Ověř limity, povolené typy, granty a Storage politiky. Schéma app nesmí být vystavené Data API. Autentizace a Storage používají vlastní API; zkontroluj, že kód nevyžaduje databázové supabase.from()/rpc() dotazy. Pokud ano, neopravuj to potichu zapnutím Data API a vystavením schématu; vyřeš rozdíl vůči schválené architektuře.

Zkontroluj hostované bezpečnostní poradce a oprav relevantní závady bez automatického přidávání placených funkcí.
5. Heroku build a start
Ověř aktuální oficiální dokumentaci pro skutečný typ aplikace/buildpacku a podporované verze Node/Next.js.
- Použij stávající osobní aplikaci, EU a jednu Eco web dyno.
- Oficiální Node buildpack kompatibilní s cílem; nepřecházej na dražší runtime.
- Node verzi deklaruj kompatibilně s repozitářem a Heroku, npm lockfile zachovej.
- Připrav build a start (případně Procfile), bez npm run dev. Server naslouchá na 0.0.0.0 a Heroku PORT.
- Ověř produkční start lokálně s nestandardním PORT.
- NEXT_PUBLIC hodnoty musejí být správné už při build; respektuj dostupnost build-time config vars pro zvolený buildpack.
- Build nesmí vyžadovat migrační roli ani zapisovat do DB.
- Žádná trvalá data na disku dyno; exporty a soubory mají existující omezené zpracování.
- Cookies, origin kontrola, přesměrování a HTTPS fungují za Heroku proxy bez důvěry k libovolnému podvrženému hostu.
- Health zůstává veřejné minimální liveness bez tajemství.
Automatické GitHub deploye zatím vypnuté. Preferuj již připojený repozitář a řízený deploy konkrétního otestovaného commitu. Zkontroluj, že pracovní změny skutečně patří do nasazovaného commitu; necommituj nesouvisející změny. Netvrď, že nasazuješ lokální práci, pokud Heroku sestavuje jiný GitHub commit. Není-li push dostupný, připrav přesný ruční postup.
6. Pořadí provedení
1. Ověření stavu etapy 9, lokální kontroly a připravené změny kódu.
2. Ověření cílů, tarifu, Eco hodin a dostupných oprávnění.
3. Záloha případných existujících dat cíle.
4. Cloudový bootstrap role a řízené migrace.
5. Auth/Storage konfigurace a ověření omezené runtime role přes pooler.
6. Příprava prvního účtu bez vypisování hesla.
7. Config Vars a produkční build/deploy do konkrétní aplikace.
8. Web Eco=1, žádný worker/add-on, smoke test.
9. Uživatelský průchod, záloha pilotního stavu a dokumentace výsledků.
Při chybě nejdřív zjisti příčinu z redigovaných logů; nezvyšuj tarif, nevypínej RLS/TLS a nepřepínej runtime na postgres. Připrav rollback kódu a popiš jeho kompatibilitu se schématem; rollback releasu nevrací databázové migrace. Změny schématu nevracej destruktivně.
7. Ověření pilotu
Spusť lokální lint, typecheck, build a relevantní regrese. V cloudu proveď omezené nedestruktivní smoke testy na vlastních pilotních/testovacích datech:
- skutečné přihlášení, povinná změna hesla, odhlášení a refresh,
- odmítnutí veřejné registrace, neaktivního účtu a staré relace,
- dokument/poznámka s obrázkem, upload z telefonu nebo mobilní šířky, privátní stažení,
- školní výrobek bez ceny,
- vlastní nákup, rezervace a dokončení s příkladem 10 g / 300 Kč → odběr 5 g → výrobek 4 g + vratka 0,5 g + odpad 0,5 g → cena 120 Kč a volných 5,5 g,
- export a jeho úplnost,
- izolace dvou účtů včetně souborů, pouze pokud jsou k tomu připravené testovací účty,
- perzistence po restartu dyno, malý počet DB spojení a přijatelná paměť,
- chování po běžném uspání Eco, bez umělého keep-alive monitoru.
Nespouštěj celé destruktivní integrační testy proti pilotní DB. Testovací skladové pohyby nemaž obcházením ledgeru; odděl je vlastním účtem a zdokumentuj případné ponechání/archivaci.

Vytvoř zálohu pilotního stavu a ověř manifest dle etapy 9. Obnovu testuj pouze v izolovaném cíli, nikoli přepisem pilotu. Pokud je nutná úprava cloudové zálohy kvůli jiným možnostem Auth, konkrétně ji otestuj a zdokumentuj.

Nepřidávej spolužáky bez konkrétního zadání. Nejprve má pilot vyzkoušet uživatelka. Ruční test telefonu nebo potvrzení praktického použití označ jako čekající, pokud neproběhl; kvůli tomu neodkládej dostupné technické kroky.
8. Předání
Aktualizuj docs/progress.md, docs/decisions.md, README a docs/deployment.md. Uveď:
- konkrétní app/project identifikátory bez tajemství,
- nasazený commit a release,
- migrace a konfiguraci,
- bezpečné příkazy dalšího nasazení, ops správy, zálohy a rollbacku,
- výsledky kontrol, blokátory a ruční testy čekající na uživatelku.
Závěrečný report česky: funkční HTTPS adresa, stav nasazení, co bylo ověřeno a přesné zbývající ruční kroky. Neoznačuj pilot jako dokončený jen podle úspěšného buildu. Po etapě 10 se zastav; nezačínej V1.
Část B — ruční postup pro Julii
Tyto kroky dělej v pořadí s Codexem. Přesné příkazy migrací a ops dodá podle skutečného repozitáře; nepoužívej lokální npm run local:env pro cloud.
1. Připrav cíle a přístup
- Nový Supabase projekt: vayxezlkyognarkqebbg.
- Heroku: nová aplikace Craftbook s doménou https://craftbook-app-cab5aab2013a.herokuapp.com.
- Z Heroku Dashboardu převezmi také přesný App name; generovaná doména nemusí být shodná.
- Repo Craftbook připoj na Heroku v Deploy → GitHub. Automatic Deploys nech vypnuté.
- Pokud CLI není přihlášené, přihlas se sama podle pokynu Codexu, například heroku login. Tajné hodnoty neposílej do chatu.
2. Supabase nastavení
V Authentication:
- ponech přihlašování e-mailem a heslem,
- vypni Allow new users to sign up,
- vypni anonymní přihlášení a nepoužívané providery,
- v URL Configuration nastav Site URL na Heroku origin bez koncového lomítka,
- Redirect URLs přidej pouze podle skutečných rout, které vypíše Codex.
SMTP není potřeba; první účet založí připravený provozní příkaz bez e-mailové pozvánky. Kvůli tomu nezapínej veřejnou registraci.

Data API ponech vypnuté. Bucket a politiky nejlépe připraví reprodukovatelný skript; pokud tě Codex požádá o ruční založení, použij přesný název z kódu a Public bucket nech vypnuté.
3. Připrav oddělené cloudové údaje
Codex má nejdřív vytvořit šablonu ignorovaného souboru, například .env.ops.cloud.local. Do něj lokálně doplníš podle jeho návodu:
- URL a API klíče nového Supabase projektu,
- MIGRATION_DATABASE_URL pro postgres s databázovým heslem,
- případný nový runtime role password podle navrženého bezpečného vstupu.
Lokální .env.local a .env.ops.local nech připojené k lokálnímu Supabase. .env.example je bez tajných hodnot.

Roli craftbook_runtime a její samostatné heslo nejdřív musí připravit cloudový bootstrap; teprve pak bude runtime DATABASE_URL fungovat.
4. Migrace a účet
Spusť přesné cloudové příkazy připravené Codexem, nebo je nech provést v jeho autorizovaném prostředí:
- role a migrace,
- bucket/politiky,
- první účet na tvůj zvolený e-mail s dočasným heslem.
Před spuštěním zkontroluj, že nástroj uvádí správný project ref. Nevkládej heslo do argumentů příkazu nebo do commitu. Přihlašovací účet aplikace není totéž jako účet Supabase Dashboardu.
5. Heroku → Settings → Config Vars
Bez okolních uvozovek a bez zápisu KEY=VALUE do jediného políčka přidej:
Key	Value
APP_URL	https://craftbook-app-cab5aab2013a.herokuapp.com
NEXT_PUBLIC_SUPABASE_URL	https://vayxezlkyognarkqebbg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY	sb_publishable_… z nového projektu
DATABASE_URL	Připojení craftbook_runtime přes session pooler s heslem této role
STORAGE_SECRET_KEY	sb_secret_… podle aktuálního serverového adaptéru
Další potřebné proměnné	Pouze podle finálního seznamu Codexu a kódu


Limity souborů a TTL ponech podle stávající šablony, pokud Codex nepotvrdí jinou potřebu. TLS případné další proměnné určí podle ověřené konfigurace pg.

Do Heroku webu nevkládej MIGRATION_DATABASE_URL ani ops SUPABASE_SECRET_KEY. PORT nenastavuj; přiděluje ho Heroku. Cloudové tajné hodnoty nepatří do .env.example.
6. První nasazení
Až Codex potvrdí připravené migrace, konfiguraci a otestovaný commit:
- v Deploy zvol správnou větev a Manual deploy → Deploy Branch,
- počkej na úspěšný build a release,
- v Resources nastav jeden web proces na Eco a žádný worker,
- nepřidávej databázový ani jiný placený add-on.
Pokud deploy provádí Codex jinou připravenou cestou, ruční deploy neopakuj. Při změně NEXT_PUBLIC hodnot bude potřeba nový build. Automatické deploye můžeš řešit později.
7. Tvoje závěrečná kontrola
- Otevři aplikaci přes HTTPS a změň dočasné heslo.
- Vyzkoušej poznámku s fotkou a školní výrobek bez ceny.
- Zapni dílnu, přidej vlastní materiál a projdi vlastní výrobek až do dokončení.
- Vyzkoušej fotku z telefonu, stažení přílohy a export.
- Nech Codex ověřit perzistenci po restartu a připravit první zálohu.
- Pokud chceš zachovat lokální skutečná data i v cloudu, řekni to před jejich přenosem. Nasazení samo je automaticky nepřenáší.
Eco hodiny sdílí všechny tvoje Eco aplikace. Stará aplikace se v této etapě nevypíná automaticky. První načtení po uspání může být pomalejší.