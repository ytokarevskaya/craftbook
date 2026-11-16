# Prompt pro Codex — Craftbook, etapa 1
Zkopíruj text od následujícího odstavce do Codexu otevřeného v repozitáři projektu. Přilož produktovou a technickou specifikaci a implementační plán, nebo je vlož do docs podle názvů níže.

---

Pracuješ na webové aplikaci Craftbook pro studenty zlatnictví a vlastní dílnu. Tvým úkolem je implementovat POUZE etapu 1: spustitelný základ projektu a responzivní prezentační rozhraní. Neimplementuj celé MVP.

## Kontext a autoritativní podklady
Nejdřív přečti AGENTS.md, pokud existuje, a:
- docs/product-spec.md — produktová specifikace revize 0.3;
- docs/technical-spec.md — technická specifikace revize 0.2;
- docs/implementation-plan.md — implementační plán, zejména etapa 1.

Původní názvy přiložených specifikací mohou být zlatnicka-dilna-specifikace-v0.1.md (uvnitř revize 0.3) a zlatnicka-dilna-technicka-specifikace-v0.1.md. Pokud byly dodány jako soubory mimo docs, přečti je a zkopíruj do uvedených cest, originály nepřepisuj. Pokud podklady chybějí, nehledej je v soukromých účtech a nevymýšlej obsah; tento prompt stačí pro etapu 1 a chybějící podklady uveď v reportu.

Pozdější schválená rozhodnutí:
- Název aplikace je Craftbook.
- Slogan v hlavičce je přesně „Jedna kniha vládne všem.“
- Produktové i technické podklady byly schváleny pro pokračování, i když jejich text může obsahovat původní označení návrhu.
- Cílová architektura: Next.js App Router + TypeScript, serverový Node runtime, Drizzle + pg, PostgreSQL/Supabase Auth/Storage, Heroku Eco.
- Uzavřená aplikace, účty vytváří provozovatel mimo Craftbook přes Supabase a lokální ops skript. V aplikaci není administrace ani odkaz Správa uživatelů. E-mail a heslo bez SMTP, dočasné heslo a povinná změna. To se implementuje až v etapách 2–3.
- Žádné nové placené služby a žádná AI v MVP.

## Schválený vizuální směr a nejnovější změny
Pokud jsou přiloženy nové obrázky návrhů, použij je jako vizuální referenci; text těchto instrukcí má přednost před ilustračními čísly a případnými chybami obrázku. Pokud obrázky chybí, postupuj podle těchto pravidel bez blokování:
- Desktop levý sidebar přibližně 220 px, hlavní obsah s breadcrumb a názvem stránky, mobil hamburger a vysouvací menu.
- Ivory #F7F6F2, bílé panely, text #26332F, primární #355E50, šalvějové zvýraznění, jemné šedé okraje, radius cca 10 px. Serif jen Craftbook, ostatní čitelné sans. Střídmý brass akcent, žádné velké stíny nebo marketingový hero.
- Domovská stránka: krátké přivítání, pokračování v práci, nedávné dokumenty, rychlé akce, materiálový přehled pouze pro vlastní dílnu. Zatím pravdivé prázdné stavy, žádná demo čísla.
- Materiály: podnavigace Zásoby / Nákupy / Pohyby. V prvním prezentačním náhledu lze ukázat její strukturu, ale nesmí to být bezpečnostní přepínač nebo skutečné uživatelské nastavení.
- Nastavení v etapě 1 pouze prezentačně: zobrazované jméno, e-mail pouze pro čtení, vlastní dílna, změna hesla. Ukládání a změna hesla nejsou aktivní. Žádný admin odkaz.
- Kroky postupu budou jen text, bez fotografií. Fotografie patří do poznámek a deníku výrobku.
- Poznámkový editor bude jednoduchý WYSIWYG bez zdrojového Markdownu nebo split náhledu; funkční implementace až etapa 4.
- In progress bude mít checkboxy textových kroků a počet X/Y + procento; bez kroků „Bez kroků“. 100 % samo neznamená done. Implementace až etapa 5.
- Nový výrobek nabídne „Z pracovního postupu“ / „Bez pracovního postupu“. Ruční cesta: název, popis, materiály a volitelná množství, volitelné kroky. Po dokončení nabídne editovatelný nový vzor s předvyplněním a možností přeskočit. Funkce až etapy 5/8, ne nyní.
- Oblíbené ani další funkce V1–V3 nepřidávej.
- Nedělej kompletní obrazovky dalších etap místo úkolu etapy 1. Přenes nyní společný shell, vizuální tokeny a strukturu navigace; zbývající vzory zaznamenej do docs/ui-guidelines.md.

## Postup
Nejdřív zkontroluj pracovní strom a existující aplikaci, package manager, Node a dostupné nástroje. Zachovej cizí změny. Pokud je repozitář prázdný, založ projekt. Pokud není, přizpůsob se jeho struktuře; nedělej destruktivní regeneraci.

Použij stabilní vzájemně kompatibilní verze, ověřené podle oficiální dokumentace při realizaci. Respektuj existující package manager; u nového projektu použij npm. Ulož lockfile a Node verzi. Neinstaluj další knihovny jen kvůli jejich možné budoucí potřebě.

## Výstupy etapy 1
1. Funkční Next.js App Router + TypeScript strict aplikace se src strukturou.
2. Jednoduché oddělení app, components, server a budoucích doménových modulů. Nevytvářej rozsáhlé prázdné abstrakce, repository třídy ani všechny budoucí tabulky.
3. Responzivní základ rozhraní v češtině:
   - hlavička Craftbook a slogan;
   - navigace Přehled, Dokumenty, Pracovní postupy, Výrobky, Materiály, Nastavení;
   - pro každou sekci funkční navigační cíl a stručný pravdivý prázdný stav „Tato část bude dostupná v další etapě“;
   - žádné ukázkové skladové množství, ceny, falešné statistiky či záznamy, které vypadají jako uživatelská data;
   - jasné označení lokálního náhledu bez přihlášení.
4. Prezentační stránka Přihlášení s označenými poli e-mail a heslo. Přihlášení zatím není zapojené: tlačítko je neaktivní a stav vysvětlený. Neodesílej, neukládej a neloguj zadané údaje. Žádné falešné úspěšné přihlášení, testovací uživatel ani autentizační bypass, který by se později mohl dostat do provozu.
5. Základní UI stavy a přístupnost: sémantické prvky, viditelný focus, klávesnice, aktivní položka navigace, mobilní menu. Vzhled klidný a pracovní, světlý podklad, tmavý text, střídmý akcent. CSS variables pro změnu barev. Nevytvářej novou značku, obrázky ani logo.
6. /api/health potvrzující pouze běh aplikace bez výpisu konfigurace. Není to kontrola dostupnosti DB.
7. .env.example s prázdnými hodnotami a vysvětlením budoucích proměnných: APP_URL, Supabase URL a veřejný klíč, serverový privilegovaný klíč, DATABASE_URL a samostatný migrační přístup. Žádný privilegovaný klíč s NEXT_PUBLIC prefixem.
8. Výchozí lokální spuštění a build fungují bez cloudových klíčů. Chybějící budoucí konfigurace nesmí přepnout aplikaci na falešný backend. Nenavazuj zatím spojení.
9. npm scripts pro dev, build, start, lint a typecheck (nebo odpovídající skripty existujícího package manageru). Použij příkazy podporované zvolenou verzí frameworku.
10. README s instalací, lokálním spuštěním, kontrolami, omezeními etapy a budoucím nastavením. Uveď způsob respektování Heroku PORT při pozdějším nasazení; nevytvářej cloudové prostředky.
11. docs/ui-guidelines.md podle pravidel výše, docs/progress.md se stavem etapy a docs/decisions.md se stručným záznamem vybraných verzí a struktury.

Revize promptu 1.1: aktualizované UI a správa účtů mimo aplikaci.

## Co v této etapě nedělat
Neimplementuj skutečné Auth, administraci, DB schéma a migrace, skladovou logiku, uploady, editor dokumentů, galerie, AI ani funkce V1–V3. Nepřidávej databázi do localStorage. Nevytvářej cloudové projekty, nenasazuj, nezískávej tajné údaje a neměň původní Heroku/Supabase aplikace uživatelky. Nevytvářej veřejnou registraci.

## Ověření
- Spusť lint, typecheck a produkční build; oprav chyby v rozsahu etapy.
- Spusť aplikaci a ověř /api/health a všechny navigační cíle.
- Pokud je dostupný prohlížeč, ověř desktop a šířku 375 px, klávesnicovou navigaci a žádné horizontální přetečení.
- Nepiš unit testy pouze kontrolující existenci nadpisu nebo statického textu. Přidej smysluplný test jen pro skutečně implementované chování.
- Pokud nástroj nebo síť chybí, jasně uveď, co se nepodařilo ověřit. Netvrď, že kontroly prošly, pokud se nespustily.
- Nezaváděj zbytečný testovací framework jen pro statický základ.

## Dokončení
Dodej krátký report:
1. Co je skutečně hotové.
2. Důležité soubory a zvolená struktura.
3. Přesné spuštěné kontroly a výsledky.
4. Jak aplikaci lokálně spustit a co vyzkoušet.
5. Co není implementované a případné blokátory.
6. Co připravit pro etapu 2, zejména dostupnost Dockeru pro lokální Supabase.

Pro rutinní lokální rozhodnutí nečekej na potvrzení. Při skutečném konfliktu zachovej existující práci a popiš jej. Po dokončení etapy 1 se zastav; další etapu nezačínej automaticky.

