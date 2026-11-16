# Craftbook — produktová specifikace
Verze dokumentu: 0.3 · 16. 11. 2026 · Návrh ke schválení

## 1. Účel a uživatelé
Osobní webová aplikace pro studenty zlatnictví a vlastní dílnu. Propojí zásoby, materiálové náklady, učební dokumentaci, pracovní postupy a historii výrobků. První uživatelkou bude Julia, následně několik spolužáků; každý má soukromá data.

Hlavní přínosy:
- Zjistit, jaký materiál mám a zda ho množstvím a parametry stačí na výrobek.
- Dohledat nákup a vypočítat materiálové náklady bez opakovaného hledání faktur.
- Uchovat postupy, chyby, poznámky mistrové a fotografie u konkrétní práce.
- Zopakovat výrobek podle uloženého postupu.

Aplikace je responzivní pro telefon i počítač. Návrh MVP předpokládá připojení k internetu; offline režim nebyl požadován a není součástí návrhu MVP. Jazyk čeština, částky v Kč. Jde o produktový návrh, bez volby technologií.

## 2. Uživatelský režim
Nastavení „Mám vlastní dílnu“ je ve výchozím stavu vypnuté.
- Bez dílny: dokumentace, postupy, výrobky, deník a fotografie. Materiál výrobku je automaticky školní.
- S dílnou: navíc vlastní zásoby a od verze V1 vybavení a provozní spotřeba. Při zahájení výrobku uživatel zvolí vlastní nebo školní materiál.
- Jeden výrobek má jeden zdroj materiálu. Kombinování zdrojů není v navržených verzích.
- Školní materiál neovlivňuje vlastní sklad. U hotového školního výrobku lze ručně zadat skutečnou cenu materiálu / odkoupení, i dodatečně. Cena ani odhad nejsou povinné. Jejich absence není chyba ani neúplný výrobek; lze je dobrovolně doplnit kdykoli později. Nezadaná cena není nula.
- Návrh: vypnutí dílny data nemaže. Před vypnutím je nutné vyřešit aktivní rezervace; staré výrobky a ceny zůstávají dostupné.

## 3. Dokumentace a pracovní postupy
### Dokument
Obecná poznámka nebo nahraný soubor. Název, obsah či soubor a volitelná kategorie/štítky podle verze. Podporované přílohy: PDF, DOCX a Markdown. Vlastní dokument má editovatelný text se základním formátováním a obrázky vloženými do obsahu. Fotografie papírových poznámek se vkládají do dokumentu; netvoří samostatné dokumentové položky ani galerii výrobků.

MVP umožní stažení původní přílohy; nevyžaduje editor Wordu ani převod PDF na strukturovaný text. Vlastní poznámky se píší v jednoduchém WYSIWYG editoru: formátovaný text, nadpisy, tučné písmo, kurzíva, seznamy, odkazy a vložené obrázky. Žádný zobrazený Markdown kód ani rozdělení editor/náhled. Markdown zůstává podporovaný jako příloha a export podporovaného formátování.

### Pracovní postup
Samostatný strukturovaný typ: název, popis, seřazené textové kroky bez fotografií, materiálový seznam a volitelné přílohy na úrovni celého postupu. Fotografie patří do poznámek, deníku a galerie výrobku, nikoli do kroků. Materiálový řádek určuje specifikaci a jednotku; množství je volitelné. I použitelný postup může mít neznámá množství, například při první výrobě. Aplikace rozliší, zda lze materiál rezervovat, a umožní začít bez rezervace.

Příloha sama neplní strukturovaný seznam materiálů. Materiál z papíru/PDF se v MVP zadává ručně. Postup zůstává použitelný i bez vlastního skladu. Při výrobě z vlastních zásob se jeho materiálové požadavky přiřadí ke konkrétním skladovým položkám.

Z postupu lze založit plánovaný výrobek s odkazem na vzor. Při přechodu do in progress se uloží samostatná kopie tehdy potvrzených kroků a materiálového seznamu včetně neznámých množství. Před zahájením aplikace ukáže aktuální vzor a případné změny proti plánu k potvrzení, aby nepřepsala vlastní úpravy. Pozdější aktualizace vzoru tuto kopii nemění. Úpravy konkrétní výroby a skutečná spotřeba se ukládají u výrobku, nemění automaticky vzor. Kopie u výrobků nezávisí na budoucí historii verzí vzoru.

## 4. Výrobky a deník
Jeden záznam znamená jeden šperk, pár náušnic nebo součástku, například zapínání. Nezavádí se výrobní dávky.

Údaje: název, stav, zdroj materiálu, volitelný postup, materiálový seznam, poznámky, deník, fotografie průběhu a hotového výrobku. Deník obsahuje datované zápisy s textem a volitelnými fotografiemi. Připomínka mistrové může být běžný zápis; nevyžaduje další formulář.

Přesně tři stavy:
- planned: nápad nebo plán, bez rezervace;
- in progress: probíhající výroba, s rezervací známých vlastních materiálů nebo bez rezervace;
- done: potvrzená skutečná spotřeba a uvolněné rezervace, případně ruční školní cena.

Výrobek bez postupu je povolen. Materiály lze zadat přímo. Při neznámých množstvích v postupu i přímo ve výrobku lze začít bez rezervace a spotřebu doplnit zpětně. Lze rezervovat pouze známé položky, nebo zvolit zahájení zcela bez rezervace. Aplikace ukáže neutrální informaci „Bez rezervace – spotřebu doplníte později“. U vlastního výrobku se při dokončení doplní a vypořádá skutečná spotřeba. Školní výrobek lze dokončit bez ceny i odhadu.

Po dokončení zůstává možné doplnit fotografie a deník. Oprava spotřeby musí opravit sklad i cenu jedním řízeným krokem a zachovat historii, nikoli vytvořit druhou spotřebu.

### Výrobek bez vzorového postupu a průběh
Formulář nabízí „Z pracovního postupu“ a „Bez pracovního postupu“. V druhé variantě uživatel zadá název, volitelný popis, materiály s množstvím nebo neznámým množstvím a volitelný seznam textových kroků. Materiály lze doplnit až během práce; neznámá množství neblokují zahájení bez rezervace.
V in progress se kroky konkrétního výrobku zobrazují jako checkboxy. Průběh je počet dokončených kroků / počet všech kroků, nikoli odhad času. Bez kroků se zobrazí „Bez kroků“, ne 0 % nebo 100 %. Checkbox nemění sklad ani původní vzor; 100 % automaticky neoznačí výrobek done. Dokončení je samostatná akce. Při neodškrtnutých krocích lze po upozornění dokončit. Textové kroky konkrétního výrobku lze doplnit a upravit; změna počtu kroků přepočítá průběh, výchozí kopie zůstane zachovaná.
Po dokončení výrobku vytvořeného bez vzoru nabídne aplikace „Uložit jako pracovní postup“ a „Teď ne“. Předvyplní název, popis, aktuální textové kroky a materiály. Pro vlastní materiály předvyplní skutečný odběr minus použitelnou vratku (tedy materiál ve výrobku + odpad + ztráta); ukáže rozpis a umožní množství upravit pro další výrobu. U školního výrobku použije známé množství, jinak ponechá prázdné pole; cenu nepřevádí na gramy. Nepřenáší ceny, rezervace, dokončené checkboxy, fotografie ani celý deník do kroků. Uživatel formulář upraví a výslovně uloží nový vzor. Odmítnutí ani chyba uložení nevrací dokončený výrobek do výroby. Nabídka je dostupná i později z detailu. Opakované odeslání nevytvoří duplikát.
Tato nabídka nového vzoru je nově součást MVP. Rozšířený souhrn deníku a aktualizace existujícího vzoru zůstávají ve V1.

## 5. Sklad vlastních materiálů
### Karta materiálu
Kovy: druh, případně ryzost, forma (drát, plech apod.), profil a relevantní rozměry. Jednotka vždy g.
Příklad: stříbro Ag 925, kulatý drát, průměr 1 mm.
Kameny a hotové součástky: druh, rozměry a další popis, jednotka ks.
Odlišné rozměry nebo ryzosti mají odlišné karty. Nákupy stejné specifikace patří na společnou kartu.

### Nákupy a pohyby
Nákup: datum, množství, cena materiálu, dodavatel a volitelná faktura/příloha či poznámka. Jednotková cena se dopočítá. Uživatel zadává skutečnou pořizovací částku v Kč; aplikace neřeší účetnictví ani daňový režim.

Pohyby: příjem, vypořádání výrobku, samostatný odpis s důvodem (např. ztráta nebo úprava šperku), vratka a inventurní oprava. Historie ukazuje vazbu na výrobek nebo poznámku. Počáteční zásobu lze vložit bez dohledané faktury; neznámé ocenění musí být označené a nesmí vytvářet falešně přesný výsledek.

### Rezervace
Evidovaná zásoba = volné množství + rezervované množství.
Rezervace snižuje dostupné množství, ale ještě není konečnou spotřebou. Opakované otevření nebo uložení výrobku nesmí rezervaci zopakovat.

Při přechodu do in progress:
1. Zvolit zdroj materiálu, případně automaticky školní.
2. Zkontrolovat seznam, přiřadit vlastní skladové položky a množství.
3. Ukázat dostupné množství a případný nedostatek.
4. Pro známá množství vlastního materiálu vytvořit potvrzenou rezervaci a cenový podklad, nebo pokračovat bez rezervace. Pro školní materiál nevzniká skladový pohyb.
5. Uložit kopii postupu podle pravidel výše.

Při výrobě bez rezervace zůstává evidovaná dostupnost zásob do zápisu skutečnosti vyšší než fyzická dostupnost. Aplikace na to upozorní u skladu, pokud existují takové vlastní rozpracované výrobky. Dodatečný zápis spotřeby musí respektovat ostatní rezervace. Případný konflikt se řeší doplněním příjmu, opravou evidence nebo úpravou dotčených rezervací; nikdy tichým záporným skladem.

Návrh: nedostatek blokuje pouze nedostupnou rezervaci. Uživatel může doplnit příjem nebo upravit seznam; nelze tiše vytvořit záporný sklad. Změna rezervovaného množství během výroby aktualizuje rezervace o rozdíl; pouhé doplnění poznámky ani seznamu v režimu bez rezervace nevytváří rezervaci automaticky.

### Dokončení a zbytky
Odpad se zadává až při dokončení výrobku. Uživatel potvrdí nebo doplní skutečný odběr a jeho rozdělení:
- materiál ve výrobku;
- použitelný zbytek vrácený do stejné skladové položky;
- vratný zlatnický odpad (kov určený k přetavení), uložený jako údaj u dokončení a skladového odpisu;
- případná nevratná ztráta.

Pro kov platí: odběr = výrobek + vrácený zbytek + odpad + ztráta.
U kusových položek se řeší spotřebované, vrácené a ztracené kusy, nikoli hmotnost odpadu. Formulář předvyplní rezervované množství, pokud existuje, a nabídne jednoduché potvrzení beze změn. Bez rezervace uživatel zadá skutečnost a aplikace přímo provede odpis, bez dodatečného vytváření rezervace.

Příklad: zásoba 10 g, rezervace 5 g → volné 5 g. Dokončení: ve výrobku 4 g, vratka 0,5 g, odpad 0,5 g. Výsledek: volné původní zásoby 5,5 g, rezervace 0 g, odpad zaznamenaný u výrobku 0,5 g (mimo dostupné zásoby). Vypořádání odečte původní zásobu pouze jednou.

Odpad se při dokončení odečte z původního materiálu, ale nezapočítá do materiálové ceny výrobku. Uchová se jeho hmotnost a druh kovu/ryzost u výrobku a pohybu. MVP nemá samostatný sklad odpadu ani evidenci jeho prodeje či přetavení. Použitelné odstřižky nemají vlastní karty. Kontrola zásob ověřuje hmotnost a specifikaci, nikoli velikost souvislého kusu plechu.

Návrh pro návrat z in progress do planned: před uvolněním rezervace potvrdit, zda je vše vráceno; spotřebovaný materiál vyúčtovat. Smazání výrobku nesmí beze stopy odstranit skladové pohyby.

## 6. Materiálové náklady
Vlastní zásoby používají váženou průměrnou cenu. Při příjmu:
nový průměr = (dosavadní hodnota zásoby + cena příjmu) / nové množství.

Návrh cenového pravidla: cena se zachytí při rezervaci. Další rezervace během výroby zachytí tehdejší cenu. Dokončení použije tyto podklady a skutečná množství; pozdější nákup nemění historický výrobek. Vrácení zbytku vrací také jeho odpovídající hodnotu. Rezervovaná část má zachovanou hodnotu, která se novým nákupem nepřecení.

Bez rezervace se použije vážená průměrná cena v okamžiku zápisu skutečné spotřeby; zpětné přepočítávání cen k historickému datu není součástí MVP. U dodatečné spotřeby nad rezervaci se cena zachytí při jejím zápisu.

Cena materiálu výrobku = hodnota odběru minus hodnota použitelné vratky minus pořizovací hodnota vratného odpadu. Návrh: nevratná ztráta zůstává v nákladu, protože ji nelze vrátit ani prodat. Zobrazení rozliší materiál ve výrobku, vratný odpad a nevratnou ztrátu. Jde o zvolenou kalkulaci materiálu, nikoli úplný ekonomický výsledek: případný rozdíl mezi pořizovací a skutečnou výkupní hodnotou odpadu se nevyčísluje. Prodej, výkupní cenu ani přetavení odpadu MVP neřeší.

Školní výrobek může mít dobrovolně ručně zadanou celkovou materiálovou cenu. Nemusí mít cenu ani odhad v žádném stavu; může zůstat trvale bez ceny a není označen jako neúplný. U vlastního výrobku se odhad zobrazí jen při dostupných podkladech a po dokončení potvrzený náklad; chybějící cenové podklady jsou označené. Neřeší se práce, čas, marže ani prodejní cena.

## 7. Vybavení a provozní spotřeba
Od V1, pouze s vlastní dílnou:
- Nářadí: název, počet, stav dobrý / střední / na výměnu, poznámka, volitelná fotka.
- Provozní spotřeba: název, stav hodně / málo / dokoupit, poznámka, volitelná fotka.
- Vlastní kategorie, například pájení, leštění nebo skříňka A. Kategorie nemění způsob evidence: nářadí má stav opotřebení, spotřební položka stav zásoby.
- Materiál započítávaný do ceny výrobku zůstává ve skladu s g/ks. Provozní spotřeba se do ceny automaticky nerozpočítává.
- Samostatný nákupní seznam přijde ve V2.

## 8. Navržené verze
### MVP — ověření hlavního pracovního cyklu
Soukromý účet, nastavení dílny, responzivní české rozhraní. Název Craftbook, slogan „Jedna kniha vládne všem.“. Účty spravuje provozovatel přes Supabase a podpůrný provozní postup; v aplikaci není administrace ani odkaz na ni. Nastavení: zobrazované jméno, e-mail pouze pro čtení, vlastní dílna, změna hesla.
Dokumenty s vlastním textem a vloženými obrázky, nahrání PDF/DOCX/MD.
Strukturované postupy s textovými kroky bez fotografií, vytvoření výrobku z postupu i samostatně, checkboxy a průběh. Po dokončení samostatného výrobku nabídka předvyplněného nového postupu.
Tři stavy, zcela volitelná školní cena, vlastní rezervace i zahájení bez rezervace a zpětné zadání spotřeby.
Sklad g/ks, specifikace, nákupy, faktury, historie pohybů, odpisy a zápis odpadu při dokončení bez samostatného skladu odpadu.
Vážené náklady, rozlišení neznámé ceny.
Deník a fotografie přímo u výrobku.
Základní hledání podle názvu a filtrování výrobků podle stavu.
Ochrana proti dvojím pohybům, export vlastních základních záznamů a možnost získat původní přílohy.

Záměrně bez přehledu nářadí, provozní spotřeby, souhrnné galerie, kolekcí, nákupního seznamu, sdílení a AI. MVP je malé rozsahem modulů, ale musí dokončit celý hlavní pracovní cyklus.

### V1 — organizace dílny a studijních materiálů
Nářadí a provozní spotřeba, vlastní kategorie.
Štítky pro dokumenty, postupy a výrobky, podrobnější hledání a filtry.
Po dokončení nabídnout souhrn deníku a plánovaných/skutečných množství. Uživatel může podle něj upravit původní postup nebo vytvořit nový. Změny vybírá a potvrzuje ručně; žádné automatické přepsání. Tato funkce nevyžaduje AI.
Snazší opakování výrobku.
Námět k rozhodnutí před V1: historie posledních N verzí pracovního postupu. N a pravidla vytváření verzí zatím nejsou určena; nejde o závaznou funkci MVP. Odstranění starší verze nesmí poškodit kopie u výrobků.
Přehled rozpracovaných prací a chybějících údajů.

### V2 — galerie a plánování nákupů
Souhrnná galerie fotografií výrobků, oblíbené fotografie.
Kolekce jako seskupení výrobků; návrh: výrobek může patřit do více kolekcí.
Nákupní seznam pouze pro vlastní dílnu, rozdělení na výrobní materiál, nářadí a provozní spotřebu.
Ruční přidání a návrhy z nedostatku materiálu, stavu „dokoupit“ nebo „na výměnu“.
Planned nadále nic nerezervuje.
Velikost jako volitelný atribut pracovního postupu a konkrétního výrobku, například velikost prstenu či délka náramku. Navržený první rozsah: ručně definované varianty velikostí s vlastními množstvími. Obecný automatický přepočet se nepředpokládá bez uživatelem určeného pravidla. Volba velikosti se zachytí do kopie při zahájení výroby. Podrobná pravidla se upřesní před V2.

### V3 — AI až po ověření předchozích verzí
Rady pro rozpracovaný výrobek z uživatelových dokumentů, postupů a zkušeností.
Odpovědi s odkazy na konkrétní podklady a jasným označením nejistoty.
Porovnání fotografií s postupem a upozornění na možné viditelné vady; bez tvrzení, že fotografie ověřuje pevnost či skryté vady.
Případná společná odborná znalostní báze vyžaduje samostatně určit zdroje a jejich správu.
Použití dat pro AI musí být vědomá volba uživatele. AI nemění sklad ani postupy bez potvrzení.

## 9. Kritéria přijetí MVP
1. Student bez dílny vytvoří postup, výrobek, deník a hotový výrobek bez ceny i odhadu; cenu může následně dobrovolně doplnit bez zakládání skladu.
2. Majitel dílny rozliší Ag drát 1 mm od 0,8 mm a dohledá nákupy a faktury.
3. planned nemění dostupnost, in progress rezervuje potvrzené množství, nebo povolí výrobu bez rezervace; done spotřebu vypořádá právě jednou.
4. Dva rozpracované výrobky nemohou rezervovat stejné volné množství; nedostatek je viditelný.
5. Dokončení podporuje odchylku od plánu, vratku, odpad i ztrátu; množství musí souhlasit.
6. Pozdější nákup nezmění cenu hotového výrobku; neznámá cena se nepovažuje za nulu.
7. Kopie postupu vznikne při přechodu do in progress; následná změna vzoru ji nepřepíše.
8. Samostatný odpis uloží důvod a změní zásobu pouze jednou.
9. Na telefonu lze založit deníkový zápis a vložit fotografii přímo k výrobku.
10. Jiný uživatel nemá přístup k cizím poznámkám, fotografiím ani fakturám.
11. Postup s neznámými množstvími umožní zahájit výrobu bez rezervace a dokončit ji po zpětném zadání spotřeby.
12. Vratný odpad zadaný při dokončení sníží původní zásobu, ale není v materiálové ceně výrobku. Například při ceně 30 Kč/g: odběr 5 g, výrobek 4 g, použitelná vratka 0,5 g a odpad 0,5 g → odpis původní zásoby 4,5 g, cena výrobku 120 Kč.

## 10. Schválený základ a aktualizace
Dosavadní uživatelská rozhodnutí jsou zachována. Nové návrhy v tomto dokumentu vyžadují schválení zejména v těchto bodech:
- rozsah a pořadí MVP, V1, V2 a V3;
- přímý materiálový seznam výrobku bez postupu;
- rozlišení použitelné vratky, odpadu a ztráty;
- zachycení ceny při rezervaci, případně při zápisu spotřeby bez rezervace; vratný odpad je z ceny vyloučen, návrhem k potvrzení zůstává zahrnutí nevratné ztráty;
- online MVP, čeština a Kč.

Technická architektura, konkrétní služby, datový model implementace, harmonogram a prompt pro Codex budou následovat až po schválení produktu.


Revize 0.3: zapracované připomínky k UI; oblíbené položky nadále mimo MVP.
