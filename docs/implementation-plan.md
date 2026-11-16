# Craftbook — implementační plán MVP
Revize 1.1 · 16. 11. 2026

Pracovní název: Craftbook
Slogan v hlavičce: „Jedna kniha vládne všem.“

## Závazné podklady
Produktová specifikace revize 0.3 (soubor zlatnicka-dilna-specifikace-v0.1.md) a technická specifikace revize 0.2. Název a slogan jsou pozdější schválené doplnění. Stará označení „návrh ke schválení“ v těchto souborech neznamenají nové čekání na souhlas; uživatelka schválila pokračování.

Tento plán neimplementuje aplikaci a nevytváří cloudové zdroje. Jedna etapa představuje samostatné zadání pro Codex s ověřitelným výsledkem. Pokud je etapa příliš velká pro jeden přehledný diff, rozdělí se podle uvedených dílčích kroků. Nedávat Codexu celé MVP jako jeden úkol.

## Cílová architektura
Next.js App Router + TypeScript, Node runtime, Drizzle + pg, PostgreSQL/Supabase Auth/Storage, jedna webová Heroku Eco dyno. Žádné další placené služby. Lokální vývoj, později druhý izolovaný Supabase Free projekt. Správa účtů provozovatelem mimo aplikaci přes Supabase a ops skript, e-mail a heslo bez SMTP, bez veřejné registrace.

## Jak pracovat s Codexem
1. V novém nebo zvoleném Git repozitáři uložit podklady jako docs/product-spec.md, docs/technical-spec.md a tento plán jako docs/implementation-plan.md. Přiložit je Codexu nebo ho nechat z dodaných souborů tyto kopie založit.
2. Předat vždy jen prompt aktuální etapy; první je samostatný soubor craftbook-codex-prompt-etapa-01.md.
3. Codex nejdřív zkontroluje repozitář, AGENTS.md, existující změny a prostředí. Zachová cizí práci.
4. Po etapě uvede změny, přesné výsledky kontrol, omezení a návod k vyzkoušení. Aktualizuje docs/progress.md a stručný seznam architektonických rozhodnutí.
5. Julia výsledek vyzkouší podle kritérií níže a zkontroluje diff. Poté se zadá další etapa. Automatické nasazování ani přeskakování etap není součástí prvního promptu.
6. Změna produktu nebo architektury musí být popsaná jako změna, nikoli ukrytá v implementaci. Běžné lokální volby řeší Codex samostatně.

## Etapa 1 — spustitelný základ a rozhraní
Závislosti: žádné cloudové účty ani Docker.

Kroky:
1. Založit nebo přizpůsobit Next.js/TypeScript projekt, stabilní kompatibilní závislosti, lockfile a Node verzi.
2. Připravit rozdělení serverového a klientského kódu a jednoduchou strukturu modulů.
3. Vytvořit responzivní rozložení s Craftbook a českým sloganem; přehled, dokumenty, postupy, výrobky, materiály, nastavení jako jasně označené budoucí sekce.
4. Přidat čistě prezentační přihlašovací obrazovku bez falešného úspěšného přihlášení.
5. Připravit .env.example bez tajných údajů, README, lint, typecheck a produkční build.
6. Přidat health endpoint bez údajů o databázi či tajných hodnot. V této etapě potvrzuje pouze běh procesu.
7. Popsat lokální spuštění a připravenost na budoucí PORT proměnnou hostingu.

Výsledek: lokálně spustitelná základní aplikace bez připojení ke cloudu. Prázdné sekce nejsou hotové funkce; nic neukládají a neobsahují smyšlená uživatelská data.

Přijetí: funkční navigace, čitelnost na 375 px i desktopu, bez vodorovného přetečení, ovládání klávesnicí, lint/typecheck/build projdou. Žádná hesla, falešná autentizace ani cloudové zápisy.

## Etapa 2 — skutečná identita a oddělení dat
Závislost: etapa 1; Docker pro lokální Supabase nebo explicitně připravené izolované testovací prostředí.

Kroky:
1. Ověřit Docker a připravit lokální Supabase. Pokud chybí, dokončit kód a sdělit konkrétní blokátor; nepřipojit se potichu k již používanému projektu.
2. Nastavit Drizzle migrace a oddělit runtime roli od migrační role.
3. Vytvořit UserAccount/UserProfile a chráněné schéma app, transakční uživatelský kontext, RLS a explicitní serverové oprávnění.
4. Přidat skutečné přihlášení/odhlášení, obnovování relace, kontrolu aktivního účtu a aktuální relace. Veřejnou registraci vypnout i u poskytovatele.
5. Bezpečný provisioning konkrétního uživatele podle Auth ID; žádná aplikační admin role, chybějící UserAccount znamená zákaz přístupu.
6. Uživatelské nastavení vlastní dílny s výchozím ne. Sklad chránit na serveru stejně jako v UI.

Přijetí: dva lokální uživatelé nevidí navzájem profil ani chráněná data. Žádný přístup bez kontextu; opakované použití stejného pool spojení nepřenese identitu A na B. Testy skutečně používají omezenou runtime roli.

Doplnění před kódem: popsat úzký mechanismus načtení UserAccount a provozní správy tak, aby nevznikla rekurze RLS ani nutnost povolit runtime roli veškerá data. Nekopírovat privilegovaný postgres účet do běžného běhu.

## Etapa 3 — provozní správa účtů a změna hesla
Závislost: etapa 2. Žádné administrační obrazovky v Craftbooku.

Kroky:
1. Návod Authentication > Users v Supabase, ověření dostupnosti ručního vytvoření bez pozvánky a fallback lokálním Auth Admin skriptem.
2. Idempotentní ops provisioning UserAccount/Profile pro konkrétní Auth ID; identita bez profilu nemá přístup.
3. Dočasné heslo, povinná změna, expirace; změna vlastního hesla v Nastavení.
4. Lokální ops reset/deaktivace se zneplatněním starých relací a synchronizací aplikačních příznaků; bez SMTP.
5. AccountProvisionOperation a bezpečná náprava částečného selhání. Privilegované nástroje nejsou vystavené jako webové endpointy.

Přijetí: nevznikne /admin ani odkaz Správa uživatelů. Účet z Dashboardu projde provisioningem; bez něj má zákaz přístupu. Dočasné heslo je nutné změnit, staré relace po resetu nefungují. Přihlašovací údaje nejsou v logu. Provozní skript nevyžaduje nový placený nástroj.

## Etapa 4 — dokumenty a soukromé soubory
Závislost: etapy 2–3.

Kroky:
1. Asset a Document, autorizované krátkodobé odkazy, lifecycle pending/ready/deleting.
2. Nahrání PDF/DOCX/MD, vytvoření a úprava poznámky ve WYSIWYG editoru.
3. Obrázky vložené do textu, bezpečný render, jednoduchá lišta formátování v jediném editoru bez zdrojového Markdownu.
4. Komprese fotografií, konfigurovatelné limity, srozumitelná reakce na nepodporovaný formát.
5. Opakovatelný úklid neúplných uploadů a mazání respektující odkazy.
6. Vyhledávání dokumentů podle názvu a stránkování.

Migrace AssetLink přidávají konkrétní cizí klíče postupně s dalšími entitami. Nevytvářet kvůli souborům předčasně celý model a nepoužívat neověřovaná polymorfní ID.

Přijetí: druhý uživatel nezíská cizí soubor; selhaný upload není hotová příloha; vložený skript se nespustí. Dokument se obnoví po přihlášení i restartu aplikace.

## Etapa 5 — postupy, školní výrobky a deník
Závislost: etapa 4.

Kroky:
1. Strukturovaný postup s textovými kroky bez fotografií a množstvím materiálu, které smí být null.
2. Samostatný výrobek nebo výrobek z postupu, planned/in progress/done. Samostatný formulář: název, popis, materiály/množství i null, volitelné ručně zadané kroky.
   - ProductStep checkboxy a průběh X/Y + procento; bez kroků se procento nezobrazuje, 100 % nezpůsobuje dokončení.
   - Po dokončení samostatného výrobku nabídka předvyplněného formuláře nového postupu, v této etapě pro školní režim. Uložit nebo přeskočit; bez duplikátů a bez přepisování výrobku.
3. Kopie postupu vzniká při zahájení, kontrola souběžné změny vzoru.
4. Školní výrobek: žádný sklad, žádná povinná cena či odhad.
5. Deník, fotografie průběhu i hotového výrobku a dodatečná volitelná školní cena.
6. Vlastní výrobní zdroj zatím nevystavit jako funkční, dokud není hotové vypořádání v etapě 8.

Přijetí: student dokončí celý školní cyklus včetně fotek bez skladu a ceny. Změna postupu nezmění existující kopii. Ruční úprava URL nepřepne školní výrobek na neimplementovaný skladový režim.

Milník: první skutečně použitelná část pro studium; stále nejde o úplné MVP.

## Etapa 6 — materiály, nákupy a skladová historie
Závislost: etapa 5; využívá transakční a bezpečnostní základ etapy 2.

Kroky:
1. Karty kovů v g, kamenů a součástek v ks, parametry specifikace.
2. Nákup včetně ceny, dodavatele a faktury; počáteční zásoba s neznámou cenou.
3. InventoryBalance, append-only InventoryMovement, Operation a idempotentní příjem.
4. Odpis s důvodem, inventurní oprava a archivace karty s historií.
5. Přesné desetinné výpočty; viditelné oddělení nuly a neznámé ceny.
6. Čtecí přehled volného/rezervovaného množství a historie.

Před implementací ledgeru upřesnit jeho fyzické sloupce: musí umožnit rekonstruovat zvlášť volné i rezervované množství, známou hodnotu a neoceněný podíl. Jediný obecný value_delta nestačí k vysvětlení přesunů. Jde o zpřesnění technického modelu, nikoli změnu produktu.

Přijetí: 10 g za 300 Kč + 10 g za 400 Kč → 20 g za průměrných 35 Kč/g. Stejný request_key nepřidá příjem podruhé. Odpis bez důvodu a necelé fyzické ks jsou odmítnuty.

## Etapa 7 — rezervace a oceňování v transakcích
Závislost: etapa 6.

Kroky:
1. Mapování požadavku postupu na vlastní kartu materiálu.
2. Atomické zahájení včetně kopie, stavu, rezervací a cenového podkladu.
3. Změna a uvolnění rezervace; známé množství versus dobrovolný režim bez rezervace.
4. Cenové části rezervací, vážený průměr volného fondu, deterministické zaokrouhlení.
5. Souběžnost: zámky ve stabilním pořadí, kontrola dostupnosti uvnitř transakce, idempotence.
6. Historie a informace o rozpracovaných výrobcích bez rezervace.

Přijetí: dva souběžné požadavky nemohou přečerpat stejnou zásobu. Nový nákup nepřecení rezervaci. Zrušení rezervace vrátí původní hodnotu. Smíšeně oceněný materiál nevytváří falešně přesnou cenu.

U kusových položek je celočíselná fyzická spotřeba; poměrné účetní rozdělení známé/neznámé ceny nesmí být omezeno tak, že znemožní odebrat 1 ks ze smíšeného fondu. Pokrýt konkrétním testem.

## Etapa 8 — dokončení, odpad a opravy
Závislost: etapa 7.

Kroky:
1. Formulář skutečné spotřeby: výrobek, vratka, vratný odpad a nevratná ztráta.
2. Transakční vypořádání s rezervací i bez rezervace, náklad a done.
3. Odběr nad rezervaci s aktuální cenou a pod rezervací s uvolněním přebytku.
4. Oprava přes kompenzační pohyby a novou revizi, nikoli přepis historie.
5. Bezpečný návrat do planned a pravidla mazání/archivace.
6. Zpřístupnit vlastní výrobu v UI až po dokončení celého cyklu.
7. Dokončit předvyplnění nového vzoru pro vlastní materiály: odběr minus použitelná vratka, rozpis a ruční úprava množství; bez cen, fotografií a odškrtnutých stavů.

Přijetí: 10 g v zásobě za 30 Kč/g, rezervace 5 g, výrobek 4 g, vratka 0,5 g, odpad 0,5 g → volných 5,5 g, rezervace 0, cena výrobku 120 Kč. Opakované dokončení nic dalšího neodečte. Oprava nepoškodí novější rezervace ani ceny jiných hotových výrobků.

## Etapa 9 — úplné MVP a uživatelská kontrola
Závislost: etapy 1–8.

Kroky:
1. Přehled a propojení dokumentace, postupů, výrobků a skladu; odstranit nefunkční placeholdery MVP.
2. Hledání podle názvu, stavové filtry, prázdné a chybové stavy, mobilní používání.
3. Export vlastních záznamů JSON/CSV a získání příloh; ochrana exportu stejně jako běžných dat.
4. Provozní záloha DB a souborů, dokumentovaný postup obnovy Auth konfigurace/účtů.
5. Ověřit obnovu v izolovaném prostředí.
6. Projít akceptační scénáře produktu a technické specifikace.

Přijetí: všechny požadavky MVP mají dohledatelný výsledek kontroly. Neověřené body jsou výslovně uvedené, nikoli označené za splněné. Nezahrnovat galerii, vybavení, kolekce, historii vzorů, velikosti ani AI z dalších verzí.

## Etapa 10 — Heroku pilot a reálné používání
Závislost: etapa 9; explicitně zvolený nový Supabase projekt a nová Heroku aplikace.

Kroky:
1. Ověřit současné limity a tarif, volné Eco hodiny a nulové nové placené služby.
2. Vytvořit/použít pouze jednoznačně určené nové zdroje pro Craftbook. Původní projekt Supabase a původní Heroku aplikaci neměnit.
3. Nastavit neveřejná tajemství, migrace, Auth konfiguraci bez veřejné registrace, soukromý bucket a provisioning prvního uživatele.
4. Nasadit aplikaci a ověřit HTTPS, cookies, správnou PORT proměnnou a chování po uspání/restartu.
5. Ověřit paměť, DB připojení přes pooler, upload z telefonu a limity souborů.
6. Julia projde školní i vlastní výrobek a reálný nákup; teprve potom přidá prvního spolužáka.
7. Zachytit potíže z používání a zvolit opravy před V1.

Přijetí: data přežijí restart, fungují obě výrobní cesty, běží pouze zamýšlené zdroje, záloha je obnovitelná a nedošlo ke změně starých aplikací.

## Kontroly a záznam postupu
Každá etapa: lint, typecheck a build podle dotčeného kódu; smysluplné testy nových pravidel, nikoli testy statického textu.
Etapy 2–3: skutečné integrační testy přístupů, Auth a resetů.
Etapy 6–8: PostgreSQL transakce, souběžnost, přesné ceny a opakování požadavků; nenahrazovat SQLite nebo pouhými mocky.
Etapy 4–5 a 9: prohlížeč a mobilní rozměr.
Etapa 10: reálné provozní ověření.

docs/progress.md po každé etapě uvádí: hotovo, spuštěné kontroly a jejich výsledky, blokátory, změny schématu, návod k vyzkoušení a další krok. Migrační oprávnění ani klíče do reportu nepatří.

## Budoucí verze
V1: vybavení, provozní spotřeba, kategorie/štítky, souhrn dokončení a ruční zlepšení postupu. Historie posledních N verzí až po upřesnění.
V2: galerie, oblíbené, kolekce, nákupní seznam, velikostní varianty.
V3: AI až po ověření základních funkcí a kvality dat.

Termíny ani počet hodin nejsou slíbené. Etapy se řídí výsledkem a ověřením; první prompt končí etapou 1.


## Vizuální pravidla po revizi návrhů
Desktop sidebar Přehled / Dokumenty / Pracovní postupy / Výrobky / Materiály; dole Nastavení a odhlášení. Mobil: hamburger a drawer. Žádná Správa uživatelů. Materiály pouze při vlastní dílně, záložky Zásoby / Nákupy / Pohyby. Pozadí #F7F6F2, bílé karty, text #26332F, primární zelená #355E50, jemné šalvějové zvýraznění, brass pouze malý akcent. Serif jen wordmark, jinak čitelné sans písmo. Radius přibližně 10 px.
Kroky bez fotografií. Poznámky WYSIWYG, žádný zdroj/náhled. Detail in progress zobrazuje checklist a průběh. Výrobek bez vzoru má samostatnou ruční cestu. Po dokončení nabídka nového postupu je MVP; oblíbené zůstávají na později.
Etapa 1 implementuje shell, navigaci, prezentační nastavení a prázdné stavy; fotografie a čísla z návrhů nejsou reálná seed data. Funkční editor patří etapě 4, checkboxy/formuláře etapě 5 a skladové dokončení etapě 8.
