Projekt
Craftbook je soukromá webová aplikace pro studenty zlatnictví a vlastní dílnu: dokumentace, pracovní postupy, výrobky, deník a evidence materiálu.
Slogan: Jedna kniha vládne všem.
Komunikuj s uživatelkou česky. UI a uživatelské chyby piš česky; identifikátory v kódu anglicky.
Podklady a rozsah práce
Před změnou relevantního modulu přečti:
- .docs/product-spec.md — produktové chování; výchozí schválená revize 0.3.
- .docs/technical-spec.md — architektura a model; výchozí schválená revize 0.2.
- .docs/implementation-plan.md — etapy; výchozí revize 1.1.
- .docs/progress.md a .docs/decisions.md, pokud existují.
- .docs/ui-guidelines.md, pokud se mění rozhraní.
Novější výslovné rozhodnutí uživatelky má přednost před starším návrhem. Čísla revizí výše slouží k odhalení starých podkladů, nebrání pozdějším schváleným aktualizacím. Tento soubor shrnuje zásady; podrobná pravidla a vzorce patří do specifikací.

Implementuj pouze aktuálně zadanou etapu. Po jejím dokončení nepokračuj automaticky další etapou. Pokud etapa není určena, zjisti ji z aktuálního zadání a progress; při nejasnosti se zeptej, nezačínej celé MVP.
Chybějící dokument nevymýšlej. Pro etapu 1 lze pokračovat podle samostatného promptu a chybějící podklad uvést; před implementací skladových pravidel musí být příslušná specifikace dostupná.
Rutinní vratné lokální volby řeš samostatně. Ptej se na skutečně chybějící rozhodnutí, změnu produktu, rizikovou migraci či nový náklad; nežádej znovu o již udělený souhlas.
Práce v repozitáři
- Nejdřív zkontroluj strukturu, git status, existující skripty a související kód.
- Zachovej cizí a nesouvisející změny. Nepoužívej destruktivní reset, nevracej cizí práci a nepřegenerovávej existující projekt.
- Změny udržuj malé a související s etapou. Neprováděj plošný refactoring bez potřeby.
- Respektuj existující package manager; pro nový projekt použij npm. Udržuj lockfile a deklarovanou kompatibilní Node verzi.
- Před použitím neznámého nebo verzově závislého API ověř odpovídající oficiální dokumentaci.
- Žádné nevyžádané nové placené služby, jiné databáze nebo cloudové účty.
- Nikdy nepřidávej tajné hodnoty, skutečná osobní data ani provozní zálohy do Git.
- Neprováděj push, nasazení ani změny cloudové konfigurace, pokud nejsou součástí aktuálně autorizované etapy. Lokální implementaci tím neblokuj.
Architektura
- Next.js App Router, TypeScript strict, Node runtime.
- Drizzle + pg, PostgreSQL v Supabase; Supabase Auth a soukromé Storage.
- Hosting: jedna Heroku Eco web dyno ve stávajícím předplatném.
- Modulární monolit. Žádné MongoDB, Redis, mikroservisy, fronty ani AI infrastruktura v MVP.
- UI, aplikační služby a přístup k datům odděluj. Nevytvářej prázdné abstrakce pro neurčitou budoucnost.
- Obchodní pravidla musí být autoritativně na serveru, nikoli jen ve formulářích.
- SQL a migrace verzuj. Doménové tabulky přidávej podle etap; negeneruj předčasně celý budoucí model.
- Nepoužívej localStorage jako náhradu serverového úložiště, falešné přihlášení ani mock backend při chybějící produkční konfiguraci.
Identita a bezpečnost
- Veřejná registrace je vypnutá. E-mail a heslo bez SMTP.
- Správa účtů probíhá mimo Craftbook v Supabase a podpůrnými lokálními ops skripty. Nevytvářej /admin, administrační UI, aplikační admin roli ani odkaz „Správa uživatelů“.
- Auth identita musí mít platný aplikační UserAccount. Neúplně připravený účet nemá přístup.
- Zachovej vynucenou změnu dočasného hesla, expiraci, deaktivaci a kontrolu relací po resetu. Přesný postup je v technické specifikaci.
- Chráněné příznaky nečti jako autoritu z uživatelem upravitelných metadata.
- Ověř identitu, stav účtu a vlastnictví při každé serverové operaci včetně souborů a exportů. Skryté tlačítko není autorizace.
- Schéma app není vystavené přes Data API. Runtime DB role nevlastní tabulky a nemá BYPASSRLS. Migrační oprávnění jsou oddělená.
- Používej transakčně lokální kontext ověřeného uživatele; nesmí zůstat na spojení pro dalšího uživatele.
- Přímé ORM spojení samo nenastaví auth.uid(). Testuj skutečnou runtime roli a RLS.
- Cizí klíče mezi doménovými objekty musí zachovat stejného vlastníka.
- Privilegované klíče jsou pouze serverové/provozní, nikdy NEXT_PUBLIC. Neloguj hesla, tokeny, podepsané URL nebo obsah soukromých dokumentů.
Produktová pravidla, která nesmí změna porušit
- Vlastní dílna je ve výchozím stavu vypnutá. Bez ní není vlastní sklad; výrobek používá školní materiál.
- Výrobek má jediný zdroj school/own a tři stavy planned / in progress / done.
- Školní cena i odhad jsou zcela volitelné. Null není nula ani chyba dokončeného výrobku.
- Výrobek lze založit bez vzoru: název, popis, materiály s volitelným množstvím a volitelné textové kroky.
- Neznámé množství umožní zahájit práci bez rezervace.
- Při zahájení se uchová potvrzená kopie postupu/plánu. Aktualizace vzoru ji nepřepisují.
- Kroky postupu jsou textové, bez fotografií. Fotografie patří do poznámek, deníku a fotek výrobku.
- Pracovní kroky konkrétního výrobku mají checkboxy oddělené od neměnné kopie. Ukládej explicitní true/false, ne nebezpečně opakovatelný toggle.
- Průběh = dokončené kroky / všechny kroky. Bez kroků zobraz „Bez kroků“, nikoli dělení nulou. 100 % automaticky neznamená done a nemění sklad.
- Po dokončení výrobku bez vzoru nabídni editovatelný nový postup. Uložení je dobrovolné a idempotentní; nesmí změnit dokončení ani cenu výrobku. Nepřenášej dokončené checkboxy, fotografie, ceny ani rezervace.
- Pro nové vzory předvyplň materiál podle produktové specifikace, nikoli bez vysvětlení pouze čistou hmotnost hotového šperku.
- Oblíbené, vybavení, kolekce, velikostní varianty, historie vzorů a AI nejsou součást MVP.
Sklad a peníze
- Kovy jsou v g, kameny a součástky v ks. Fyzické ks jsou celá čísla.
- Decimal hodnoty ukládej přesně, přenášej jako řetězce a počítej vhodnou přesnou aritmetikou. Nepoužívej JS Number pro autoritativní finanční výpočty.
- Odděluj volnou zásobu, rezervaci a skutečnou spotřebu.
- Nový nákup mění vážený průměr volné zásoby; již rezervovaný materiál zachovává ocenění.
- Dokončení, odpisy a rezervace jsou transakční a idempotentní; dvojklik ani retry nesmí odečíst materiál dvakrát.
- Dostupnost kontroluj znovu po získání zámků. Souběžné operace nesmějí vytvořit zápornou zásobu ani spotřebovat cizí rezervaci.
- Vratný odpad se eviduje při dokončení a odečítá ze zásob, ale nezahrnuje do ceny výrobku. Nevratná ztráta je v nákladu.
- Použitelná vratka vrací i odpovídající hodnotu. Neznámé ceny nepovažuj za nulu.
- Pohyby nepřepisuj; opravy prováděj kompenzačními pohyby a novou revizí podle specifikace.
- Kontrolní příklad: 10 g při 30 Kč/g, odběr 5 g, ve výrobku 4 g, vratka 0,5 g, odpad 0,5 g → volných 5,5 g, rezervace 0 g, cena 120 Kč.
Rozhraní a dokumenty
- Zachovej název a slogan. Sidebar: Přehled, Dokumenty, Pracovní postupy, Výrobky, Materiály; dole Nastavení a odhlášení. Mobil: hamburger a drawer.
- Materiály mají Zásoby / Nákupy / Pohyby a jsou dostupné jen s vlastní dílnou.
- Pozadí #F7F6F2, bílé panely, text #26332F, primární #355E50, jemné šalvějové zvýraznění. Přibližně 10px radius, střídmé stíny, serif pouze wordmark. Používej sdílené vizuální tokeny.
- Jednoduchý WYSIWYG editor, žádný zdrojový Markdown ani split náhled. Validovaný obsah a bezpečný renderer; obrázky přes Asset ID. PDF/DOCX/MD přílohy zůstávají podporované.
- Obrázkové návrhy jsou vizuální reference, nikoli autorita pro vzorce, ukázková data nebo textové chyby.
- Nevytvářej falešné KPI, záznamy nebo demonstrační data vydávaná za skutečná.
- Etapa 1 vytváří shell a prezentační prázdné stavy; pozdější funkce nepředstírej jako hotové.
- Sémantické HTML, popisky polí, klávesnice, viditelný focus, čitelné chyby a mobilní rozvržení bez přetečení.
- Přílohy jsou soukromé. Neukládej trvalá data na disk Heroku dyno. Upload a DB nejsou jedna transakce; ošetři neúplné operace.
Ověření a předání
- Používej skutečné skripty projektu. U nového projektu připrav lint, typecheck, build a později testy podle potřeby.
- U změn pravidel přidej smysluplné testy. Nepiš testy jen na existenci statického nadpisu.
- Skladové transakce, souběžnost a RLS testuj na PostgreSQL, nikoli jen mocky nebo SQLite.
- Bezpečnost ověř minimálně se dvěma uživateli, včetně přímých požadavků obcházejících UI.
- Změny UI ověř na desktopu a šířce 375 px, pokud je dostupný prohlížeč.
- Nikdy netvrď, že test prošel, pokud se nespustil. Uveď chybějící nástroj, přístup nebo konfiguraci.
- Po úpravě aktualizuj .docs/progress.md: etapa, dokončené body, kontroly, blokátory a další krok. Významné technické rozhodnutí patří do .docs/decisions.md.
- Finální report česky: co se změnilo, jak to spustit a vyzkoušet, výsledky kontrol, omezení. Neuváděj tajné hodnoty.
- Po dokončení zadané etapy se zastav. Otevřené problémy nezakrývej implementací dalších etap.