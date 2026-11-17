Craftbook — prompt pro Codex, etapa 9
Implementuj etapu 9: dotažení a ověření úplného MVP, export vlastních dat a provozní záloha s obnovou v existujícím repozitáři Craftbook. Uživatelka potvrdila dokončení etapy 8. Proveď změny a testy, ne pouze audit nebo návrh. Komunikuj česky.
1. Výchozí stav a rozsah
Nejprve přečti AGENTS.md a docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md, docs/ui-guidelines.md i relevantní provozní dokumentaci. Zkontroluj git status, skutečné schéma a testy všech předchozích etap.

Novější schválená rozhodnutí mají přednost. Historická specifikace může ještě obsahovat překonané návrhy: editor je WYSIWYG bez Markdown zdroje, správa účtů je provozní mimo aplikaci, kroky postupů nemají fotografie. Zachovej dosavadní implementaci a data. Nedělej plošný redesign, přegenerování projektu nebo nesouvisející upgrady.

Cíl této etapy:
- propojit hotové MVP do použitelného celku,
- odstranit nefunkční placeholdery funkcí patřících do MVP,
- dokončit běžné prázdné/chybové stavy, hledání a mobilní používání,
- uživateli umožnit získat vlastní záznamy i přílohy,
- připravit provozní zálohu DB a souborů,
- skutečně ověřit obnovu v odděleném lokálním prostředí,
- doložit stav všech akceptačních požadavků MVP.
Neimplementuj galerii napříč výrobky, oblíbené, vybavení, kolekce, velikostní varianty, historii vzorů, AI ani další verze. Neprováděj cloudový pilot, nasazení, push, supabase link, zakládání cloudových zdrojů nebo změny Heroku; to je etapa 10. Žádné nové placené služby, fronty ani workery.
2. Mapa požadavků a opravy MVP
Nejdřív vytvoř stručnou mapu požadavků v docs/mvp-acceptance.md:
- požadavek/scénář,
- konkrétní implementace,
- důkaz ověření,
- stav ověřeno / problém / neověřeno,
- případný blokátor.
Neodvozuj splnění jen z existence souboru, stránky nebo předchozího progress. Zkontroluj skutečné chování a oprav související nedostatky MVP. Nezačínej novou obecnou architekturu ani kosmetický refactoring bez vlivu na scénáře.

Projdi navigaci a propojení:
- Přehled se skutečnými posledními rozpracovanými výrobky a dokumenty.
- Dokumenty a poznámky → detail/editace, soukromé přílohy.
- Pracovní postup → založení výrobku.
- Výrobek → plán/snapshot, kroky, deník, fotky, materiály a vypořádání.
- Vlastní výrobek → rezervace → karta → pohyby; nákup → faktura.
- Ruční výrobek → dokončení → nepovinné uložení nového postupu.
- Nastavení, přihlášení, povinná změna a odhlášení.
Přehled musí respektovat vlastní dílnu a vlastnictví; nevytvářej falešná KPI ani nesčítej gramy s kusy. Zobrazuj neúplné ocenění pravdivě. Student bez dílny má plnohodnotný školní tok bez skladu a povinné ceny.

Ověř hledání podle názvu, stavové filtry, stránkování, návrat do seznamů, chybové stavy a zachování rozepsaných údajů při chybě. Nezaváděj globální fulltext nebo externí vyhledávač.
3. Uživatelský export
Přidej jednoduchou akci v Nastavení pro získání vlastních dat. Uživatel si musí odnést:
- verzovaný JSON se svými doménovými záznamy a vazbami,
- srozumitelná CSV pro tabulkové přehledy,
- všechny vlastní dostupné přílohy a fotografie s mapováním na jejich použití.
JSON je úplný strukturovaný export; CSV je čitelná doplňková reprezentace, ne jediný formát pro komplexní snapshoty. Zahrň dokumenty a obsah poznámek, postupy/materiály/kroky, výrobky a snapshoty, checkboxy, deník, školní ceny, skladové karty, nákupy, rezervace, pohyby, revize vypořádání a relevantní metadata souborů. Zahrň archivované záznamy a historii patřící uživateli. Interní technické idempotency záznamy nemusí být součástí uživatelských CSV.

Neexportuj hesla, tokeny, API klíče, cookies, cizí data ani neveřejné provozní údaje ostatních účtů. Uživatelský export není provozní záloha a neslibuje automatický zpětný import. Importovací UI není součást této etapy.

Zvol nejjednodušší formu vhodnou pro aktuální architekturu: například streamovaný ZIP s JSON, CSV, manifestem a soubory. Pokud by bezpečný limit velikosti/paměti vyžadoval oddělit data a přílohy, umožni získat obojí jasným postupem; žádná část nesmí být potichu vynechána. Nepřidávej background job infrastrukturu.

Manifest má verzi formátu, čas exportu, identifikátory, relativní cesty, typ, velikost a kontrolní součty souborů. Chybějící či neověřený soubor musí být výslovně označen; neoznačuj export jako úplný, pokud není. Podepsané dočasné URL nepatří do trvalého obsahu exportu.

Decimal přenášej bezeztrátově jako řetězce, null zachovej a časy exportuj v jednoznačném formátu s časovou zónou. CSV správně escapuj, zachovej češtinu a ošetři spreadsheet formula injection bez změny autoritativních dat v JSON. Cesty v archivu nesmějí dovolit path traversal; používej bezpečné unikátní názvy a mapování původních názvů v manifestu.
4. Konzistence a zabezpečení exportu
Export autorizuj stejně přísně jako ostatní data:
- aktivní účet a aktuální relace,
- žádné podvržené owner ID,
- žádné cizí vazby nebo soubory,
- osobní odpovědi bez sdílené cache,
- bez veřejných exportních objektů a logování soukromého obsahu.
Export vlastních historických skladových dat pro přenositelnost dovol i po vypnutí dílny; běžné skladové stránky a mutace tím neotevírej. Výjimku implementuj úzce a otestuj. Pokud aktuální schválená specifikace stanoví jiné pravidlo, respektuj ji a popiš je uživateli.

Data čti z konzistentního DB snapshotu. Dlouhé stahování souborů nesmí držet zámky skladových mutací. Zdokumentuj hranici konzistence DB vs Storage a ošetři souběžné mazání: například dočasnou ochranou souborů, nebo kontrolovaným selháním a opakováním místo neúplného archivu vydávaného za úplný.

Použij konečné limity velikosti, doby a souběžných exportů a omezenou spotřebu paměti. Nepoužívej trvalý disk dyno. Případné dočasné soubory bezpečně uklízej po úspěchu, chybě i odpojení klienta. Export nesmí vyžadovat migrační DB přístup.
5. Provozní záloha
Připrav samostatné lokálně spouštěné nástroje a docs/backup-and-restore.md. Provozní záloha je privilegovaná operace mimo webovou aplikaci; uživatelské tlačítko ji nesmí spouštět.

Záloha musí pokrýt:
- aplikační data a historii včetně všech vlastníků,
- schéma, migrace, granty, RLS a potřebnou konfiguraci rolí,
- skutečné bajty soukromých Storage objektů a jejich mapování,
- postup obnovy identity, Auth konfigurace, politik a vazby Auth ID na vlastníky.
Nespoléhej, že dump tabulky storage.objects obsahuje bajty souborů. Soubory zálohuj přes podporované rozhraní a obnovuj obdobně. Neprováděj neověřené přímé zásahy do interních spravovaných tabulek Supabase.

Před implementací ověř podle oficiální dokumentace používané verze, co konkrétní dump/CLI skutečně zahrnuje a jak bezpečně obnovit Auth a Storage. Nepředpokládej přenositelnost interních tabulek nebo hesel. Zvol a zdokumentuj konkrétní podporovanou cestu pro identity; pokud nelze obnovit původní hesla, použij ověřené mapování vlastníků a řízený reset bez SMTP podle etapy 3. Zachovej stav deaktivace a ochranu účtů; neaktivuj po obnově všechny automaticky.

Tajné hodnoty nepatří do Git ani veřejného manifestu. Pokud záloha zahrnuje citlivé Auth údaje, označ ji jako citlivou a řeš její chráněné uložení na zařízení. Konfigurační šablona obsahuje jen názvy proměnných; klíče a hesla se předávají odděleně.

Manifest zálohy má verzi schématu/aplikace, časy, seznam objektů a kontrolní součty. Pro pilot zvol jednoduché konzistentní okno bez zápisů a souběžného úklidu souborů; postup musí výslovně řešit DB i Storage. Neprohlašuj za konzistentní dva nezávislé exporty provedené během měnících se dat.

Dokumentuj ruční zálohování před migrací a alespoň týdně při aktivním používání, bez slibu automatických cloudových záloh. Není potřeba externí automatizační služba.
6. Skutečný test obnovy
Vytvoř izolované lokální testovací prostředí s odlišným project ID, porty, volumes a výslovnými ochrannými kontrolami. Obnovu nikdy nespouštěj proti běžnému lokálnímu projektu ani vzdálenému cíli. Neukládej skutečná osobní data nebo zálohy do Git.

Testovací sada má alespoň dva vlastníky, poznámku s obrázkem, dokument, pracovní postup, školní výrobek bez ceny a vlastní výrobek s nákupem, rezervací, dokončením, odpadem a opravou.

Proveď zálohu, obnov do čistého izolovaného cíle a ověř:
- úplnost záznamů, referenční integritu a kontrolní součty všech souborů,
- vlastníky a přihlášení/řízené obnovení přístupu,
- deaktivovaný účet zůstává zablokovaný,
- staré relace nejsou po obnově automaticky považované za platné,
- uživatel A nevidí data/soubory B,
- RLS a omezená runtime role skutečně fungují,
- ledger odpovídá balance, rezervacím a aktuálním vypořádáním,
- snapshoty, poznámky a soubory se zobrazí,
- po obnově lze bezpečně provést novou běžnou operaci bez kolize ID a verzí.
Ověř detekci poškozeného/chybějícího souboru a neúplné zálohy. Nástroj nesmí neúplnou obnovu označit za úspěch. Opakování selhané obnovy má zdokumentovanou cestu v izolovaném cíli; žádný tichý reset libovolné databáze.

Zaznamenej přesné příkazy, verze nástrojů a skutečný výsledek. Samotná existence zálohovacího skriptu není důkaz obnovitelnosti.
7. Závěrečná akceptace MVP
Spusť relevantní automatické regrese a celý uživatelský průchod na desktopu a 375 px. Využij existující testy, nepřepisuj je do druhé paralelní sady.

Povinné scénáře:
1. Přihlášení, povinná změna hesla, reset, deaktivace a odmítnutí starých relací.
2. Student bez dílny: poznámka s obrázkem → postup → školní výrobek → checkboxy/deník/foto → done bez ceny.
3. Ruční výrobek bez známých množství → dokončení → nepovinný nový postup.
4. Vlastní dílna: nákup s fakturou → rezervace → skutečnost/vratka/odpad → cena → oprava.
5. Kontrolní příklad 10 g / 300 Kč, odběr 5 g, výrobek 4 g, vratka 0,5 g, odpad 0,5 g → volných 5,5 g / 165 Kč, rezervace 0, náklad 120 Kč.
6. Neznámá cena není nula; snapshot se změnou vzoru nemění; 100 % kroků samo nedokončuje.
7. Kritické souběhy a idempotence skladových příkazů; historie a pozdější rezervace zůstávají konzistentní.
8. Export A obsahuje přesně jeho data, archivované záznamy, historii a přílohy; ani podvrženým požadavkem nezíská data B.
9. Export s českými názvy, decimal/null, nebezpečnými CSV hodnotami, duplicitními názvy souborů a expirovanou relací.
10. Chybějící soubor, odpojení exportu a souběžné mazání mají pravdivý a bezpečný výsledek.
11. Obnova zálohy dle předchozí části.
12. Bez horizontálního přetečení, funkční klávesnice a focus, čitelné chyby, prázdné seznamy a validace formulářů.
13. Data přežijí restart aplikace; soukromá cache nepropouští data mezi účty.
14. /api/health dál vrací veřejné minimum bez konfigurace a tajemství.
Spusť lint, typecheck, build a příslušné testy. Oprav zjištěné problémy v rozsahu MVP. Nedělej nekonečné kosmetické iterace. Neověřené body nebo nefunkční obnovu označ výslovně; nevydávej „MVP hotové“, pokud zásadní podmínka neprošla.
8. Předání
Aktualizuj README, docs/progress.md, docs/decisions.md a docs/mvp-acceptance.md. Přidej návod exportu a docs/backup-and-restore.md s ověřenými příkazy a omezeními. Zachovej historii etap.

Výsledný report česky obsahuje:
- co se dokončilo a jak získat vlastní export,
- výsledek skutečného testu obnovy,
- souhrn akceptace a případné blokátory,
- krátký seznam zbývajících příprav pro etapu 10.
Připrav přehled požadované konfigurace pro budoucí pilot bez hodnot tajemství. Nezakládej cloudové zdroje a nežádej předčasně přístupové klíče.

Po etapě 9 se zastav. Nasazení na Heroku a výběr konkrétních cloudových zdrojů jsou samostatná etapa 10.