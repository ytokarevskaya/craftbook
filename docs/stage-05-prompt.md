Craftbook — prompt pro Codex, etapa 5
Implementuj etapu 5: pracovní postupy, školní výrobky a pracovní deník v existujícím repozitáři Craftbook. Uživatelka potvrdila, že etapu 4 ručně zkontrolovala a funguje dobře. Proveď implementaci a testy; nezůstávej pouze u návrhu. Komunikuj česky.
1. Kontext a hranice etapy
Nejprve přečti AGENTS.md, docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md a docs/ui-guidelines.md. Zkontroluj git status, existující kód, migrace a testy. Aktuální podobu etapy 4 zjisti z repozitáře; nepředpokládej konkrétní editor, schéma obsahu nebo názvy helperů.

Schválené výchozí revize jsou produktová 0.3, technická 0.2 a implementační plán 1.1. Novější schválená rozhodnutí mají přednost. Starší dokumenty mohou ještě obsahovat Markdown zdrojový editor nebo admin UI; tyto návrhy byly překonány. Zachovej WYSIWYG a provozní správu účtů mimo aplikaci.

Tato etapa zpřístupní celý školní cyklus: postup nebo vlastní plán → rozpracovaný výrobek → kroky a deník → dokončení → volitelný nový vzor. Bude použitelný i pro uživatele bez vlastní dílny.

V této etapě podporuj pouze zdroj materiálu school. Také uživatel s vlastní dílnou může založit školní výrobek. Vlastní výrobu own nepředstírej jako hotovou: bude dostupná až po implementaci rezervací a vypořádání v dalších etapách. Vynucuj toto omezení i na serveru při podvrženém požadavku. Nevytvářej skladové tabulky, rezervace, pohyby ani automatické oceňování.

Nevytvářej galerii všech výrobků, oblíbené, kolekce, velikostní varianty, historii posledních N verzí vzorů, AI ani návrhy aktualizace existujícího vzoru po dokončení. Fotografie konkrétního výrobku patří do této etapy.

Pracuj lokálně se Supabase. Bez nasazení, push, cloudových migrací, nových placených služeb a změn existujících projektů. Zachovej data i nesouvisející změny; nepřegenerovávej projekt ani plošně neupgraduj závislosti.
2. Pracovní postupy
Zprovozni seznam, hledání podle názvu, stránkování, detail a formulář vytvoření/úpravy postupu.

Postup obsahuje:
- povinný název a volitelný popis,
- uspořádané textové kroky, které lze přidat, upravit, odstranit a přeuspořádat,
- materiálové požadavky: popis/specifikace, typ, jednotka a množství, které může být neznámé.
Kroky nemají fotografie. Materiály jsou nezávislé na skladu: například stříbro Ag 925, kulatý drát, průměr 1 mm; množství v g. Kameny a hotové součástky se evidují v ks, fyzické kusy pouze celé. Neznámé množství ukládej jako null, nikoli 0. Povolení práce bez známého množství je záměrné.

Nezaváděj libovolnou povinnost vyplnit přesnou spotřebu nebo alespoň jeden krok. Postup může být neúplný; rozsah povinných polí drž podle aktuální produktové specifikace.

Změna vzoru navyšuje revision_counter, ale neimplementuje historii verzí. Používej kontrolu souběžné editace a srozumitelný konflikt. Změna nebo archivace vzoru nesmí měnit již zahájené výrobky. Referencované postupy archivuj namísto destruktivního mazání. Archivované nenabízej pro nový výrobek; existující vazby zachovej.

Pokud aktuální specifikace umožňuje přílohy na úrovni celého postupu, použij existující Asset mechanismus a zahrň jejich reference do snapshotu. Nerozšiřuj tím kroky o fotografie ani nevytvářej druhý souborový systém.
3. Vytvoření výrobku dvěma cestami
Jeden výrobek představuje jeden šperk nebo logický celek, například pár náušnic či zapínání. Nepřidávej dávkovou výrobu.
Z pracovního postupu
Uživatel vybere vlastní aktivní postup a založí výrobek ve stavu planned. Uvidí název, popis, kroky a materiálové požadavky. Před zahájením musí být zřejmé, jaký plán potvrzuje.
Bez pracovního postupu
Formulář nabídne název, popis, ručně zadávané materiály s volitelným množstvím a volitelné textové kroky. Nevyžaduj nejprve vytvoření vzoru. Výrobek může začít i s neúplným seznamem materiálů a bez kroků, aby šlo skutečnost doplnit později.

Obě cesty používají stejné doménové operace a detail výrobku. Uchovej příznak created_without_procedure; nesmí se odvozovat jen z nullable FK, kterou může změnit pozdější archivace nebo jiná úprava.

V planned dovol úpravu pracovního návrhu. Jasně odlišuj úpravu konkrétního výrobku od úpravy vzoru. Neprováděj tiché změny původního postupu.
4. Stavy a neměnná kopie plánu
Stavy jsou přesně planned, in_progress a done; respektuj již zavedené názvy v kódu a mapuj je konzistentně. V UI používej české názvy Plánovaný, Rozpracovaný a Dokončený.

Při zahájení atomicky:
1. Ověř uživatele, vlastnictví, zdroj school, očekávaný stav a verzi výrobku.
2. U výrobku ze vzoru ověř očekávanou revizi postupu. Pokud se změnil, vrať konflikt a vyžádej potvrzení aktuální podoby; nezahoď tiše vlastní úpravy návrhu.
3. Ulož neměnný ProductProcedureSnapshot s verzí struktury, potvrzenými kroky a materiály včetně null množství. Kopie vzniká i u ručního výrobku, pouze bez zdrojového vzoru.
4. Vytvoř či potvrď pracovní ProductMaterial a ProductStep a nastav čas zahájení a stav in_progress.
Aktualizace vzoru nesmí přepsat snapshot, pracovní materiály ani checkboxy již zahájeného výrobku. Snapshot se neupravuje přes běžný formulář. Opravy a skutečná spotřeba se ukládají odděleně od původního plánu.

Příkazy zahájit/dokončit musí zvládnout dvojklik, retry i souběh bez druhého snapshotu nebo dvojího dokončení. Použij existující konvence idempotence, unikátní omezení a transakce. Nevytvářej rozsáhlý obecný framework.

Návrat in_progress → planned řeš podle aktuální specifikace: zachovej původní snapshot, pracovní historii a existující kroky, při opětovném zahájení je neduplikuj ani nenahrazuj novou verzí vzoru. Hotový výrobek nevracej do rozpracovaného stavu obecným přepínačem. Nezaváděj další přechody nad rámec specifikace.
5. Kroky a ukazatel průběhu
Rozpracovaný výrobek má textové kroky s checkboxy, jejichž stav je oddělený od snapshotu.
- Ukládej požadovanou hodnotu true/false, nikoli toggle.
- Průběh je počet dokončených kroků / počet všech kroků.
- Zobraz X z Y a procento; bez kroků zobraz „Bez kroků“, nikoli 0/0.
- Zaškrtnutí všech kroků výrobek automaticky nedokončí.
- Dokončení je samostatná explicitní akce. Nevyžaduj 100 % checkboxů jako novou produktovou podmínku; můžeš upozornit na zbývající kroky a nechat uživatele dokončení potvrdit.
- Po reloadu i novém přihlášení musí být stav stejný.
- Po dokončení zobraz kroky jako historii bez běžného odškrtávání.
Pokud specifikace umožňuje upravovat pracovní kroky během výroby, měň pouze pracovní kopii a zachovej snapshot. Pokud to neurčuje, drž MVP jednoduché: strukturu kroků upravuj před zahájením, za běhu checkboxy a poznámky do deníku. Volbu zdokumentuj.
6. Deník a fotografie
U výrobku implementuj chronologický deník s datem, textem, úpravou a smazáním vlastního zápisu. Uživatel sem zapíše zkušenosti, chyby nebo poznámky od paní mistrové; není potřeba klasifikace ani role učitele.

Znovu použij WYSIWYG, validaci a bezpečný renderer z etapy 4. Nepřidávej Markdown zdrojový režim. Umožni fotky v zápisech a fotografie výrobku rozlišené na průběh a hotový výrobek. Přístup k nim je pouze v kontextu konkrétního výrobku, nikoli jako nová globální galerie.

Použij existující upload, kompresi, limity, Asset ID, podepsané odkazy a lifecycle. AssetLink rozšiř o skutečné FK na nové entity s kontrolou právě jednoho cíle a stejného vlastníka. Nevytvářej polymorfní neověřované reference.

Deník a fotky lze doplnit i po dokončení, protože uživatel může později zapsat zpětnou vazbu. Tyto změny nesmějí měnit snapshot ani stav dokončení.
7. Dokončení školního výrobku
Dokončení školního výrobku neprovádí žádné skladové pohyby, rezervace ani automatický výpočet ceny.

Nabídni přehled původního plánu a možnost doplnit skutečně použité materiály/množství. Skutečnost drž odděleně od plánovaného množství ve snapshotu. Když uživatel nezná spotřebu, dovol ji ponechat neznámou; plán nepovažuj automaticky za potvrzenou skutečnost.

Cena školního výrobku:
- je zcela volitelná, bez povinného odhadu,
- může zůstat null i po dokončení,
- lze ji ručně doplnit či opravit později,
- nula je jiná hodnota než neznámá cena,
- ukládá se přesně v CZK; nepoužívej JS Number pro autoritativní peněžní výpočty.
Ulož completed_at a done transakčně. Není povinná fotografie ani vyplněný deník. Dodatečná změna školní ceny není nové dokončení. Pro pozdější opravy spotřeby zachovej původní snapshot a kontrolu souběžné editace; neimplementuj skladové vypořádání.
8. Uložení postupu z ručního výrobku
Po úspěšném dokončení výrobku vytvořeného bez předlohy nabídni „Uložit jako pracovní postup“.

Nabídka je nepovinná, lze ji přeskočit. Její selhání nesmí vrátit ani zablokovat dokončení výrobku. Umožni ji znovu otevřít z detailu, pokud ještě nový vzor uložen nebyl.

Otevři editovatelný předvyplněný formulář s názvem, popisem, textovými kroky a materiálovými požadavky:
- Vycházej z potvrzeného plánu a dostupné skutečné spotřeby podle produktové specifikace.
- Pokud v ní přesné pravidlo chybí, použij explicitně potvrzenou skutečnou vstupní spotřebu, jinak původní plán, jinak null. Původ množství vysvětli a umožni úpravu.
- Nepovažuj čistou hmotnost hotového šperku automaticky za množství potřebné k opakování výroby.
- Nepřenášej dokončené checkboxy, fotografie, deník, školní cenu, časové údaje ani budoucí rezervace.
Uložením vzniká nový samostatný vzor a vazba saved_procedure_id, nikoli změna původního snapshotu nebo zpětná změna původu výrobku. Retry/dvojklik nesmí založit dva vzory; po uložení nabídni odkaz na existující. Použij transakci a unikátní záruku. Aktualizace již existujícího vzoru na základě souhrnu patří pozdější verzi.
9. Datový model, autorizace a reference
Přidej jen potřebné entity: Procedure, ProcedureStep, ProcedureMaterial, Product, ProductProcedureSnapshot, ProductMaterial, ProductStep, JournalEntry a potřebná rozšíření AssetLink. Před migrací konkretizuj v decisions:
- rozlišení plánovaného a skutečného množství,
- oddělení neměnného snapshotu od pracovních kroků,
- vztah ručního výrobku k nově uloženému vzoru,
- ochranu příloh referencovaných snapshotem.
Znovu použij omezenou runtime DB roli, RLS a transakční kontext. Každá serverová operace ověřuje platnou relaci, aktivní účet a vlastnictví. Vlastnictví vynucují také FK; nelze připojit cizí postup, materiálový řádek, zápis ani soubor.

Snapshotové reference nesmějí existovat pouze skrytě v JSON, pokud by je úklid assetů neviděl. Zaveď odpovídající chráněné reference. Archivace/úprava vzoru ani smazání deníkového zápisu nesmí odstranit soubor stále používaný jinde. Rozšiř údržbové testy etapy 4.

Pokud nabízíš mazání výrobku, dodrž aktuální specifikaci a konzistentní odstranění jeho vlastních vazeb; nikdy nekaskáduj do sdíleného vzoru nebo cizích/sdílených souborů. Nevymýšlej složitý nový archivační workflow. Historii zachovej u přechodů stavů.
10. Rozhraní
Zprovozni Pracovní postupy a Výrobky se seznamem, hledáním podle názvu a stránkováním. U výrobků přidej filtry tří stavů.

Detail:
- planned: editovatelný návrh, materiály, kroky, zahájení,
- in_progress: checkboxy a průběh, materiály/plán, deník, průběhové fotky, dokončení,
- done: souhrn, datum dokončení, volitelná školní cena, deník a hotové fotky, případně uložení nového vzoru z ručního výrobku.
Jasně označ školní materiál a absenci skladových operací; zobraz uživatelské sdělení, ne interní technické detaily. Ostatní neimplementované funkce nepředstírej.

Pokud Přehled již má místo pro poslední rozpracovaný výrobek, napoj jej na skutečná vlastní data a odkaz do detailu. Nepředělávej celý dashboard.

Zachovej vizuální styl, české texty, focus, klávesnici a mobil 375 px. Pro přeuspořádání kroků nabídni ovladatelná tlačítka, ne pouze drag-and-drop. Ošetři prázdné/chybové stavy a neuložené změny.
11. Ověření
Testuj skutečný lokální PostgreSQL, Auth a Storage s nejméně dvěma uživateli, bez zásahů do osobních dat. Spusť lint, typecheck, build a relevantní regresní testy etap 2–4.

Povinné scénáře:
1. Postup s kroky a null množstvím → školní výrobek → zahájení → deník/fotky → dokončení bez ceny.
2. Ruční výrobek bez vzoru, bez kroků a přesné spotřeby lze zahájit a dokončit. Nabídku nového vzoru lze přeskočit.
3. Ruční výrobek s kroky/materiály → dokončení → upravený nový vzor; opakovaný požadavek nevytvoří duplikát.
4. Změna postupu před zahájením způsobí řízený konflikt; změna po zahájení nemění snapshot ani checkboxy.
5. Dvojklik a souběžné zahájení/dokončení nevytvoří dvojí účinek; návrat do planned a opětovné zahájení zachová původní kopii.
6. Explicitní nastavení checkboxu je opakovatelné, průběh přežije reload; bez kroků není dělení nulou; 100 % není automaticky done.
7. Neznámá cena není nula, dodatečná školní cena se uloží bez změny completed_at. Neznámá skutečná spotřeba není vydávána za potvrzený plán.
8. Ks jsou celé a g přijímají povolenou přesnost. Podvržený source=own server odmítne. Školní cyklus nevytváří skladové operace.
9. A nemůže číst, měnit ani spojovat objekty B; ověř také přílohy, snapshoty, deník, přímé endpointy, neaktivní účty a zneplatněné relace.
10. Archivace vzoru nezničí výrobky. Úklid souborů respektuje nové a snapshotové reference.
11. Souběžná editace nezpůsobí tichou ztrátu dat. Škodlivý text/obsah deníku se nevykoná.
12. Celý školní tok i ruční varianta v prohlížeči na desktopu a 375 px, včetně uložení fotografie a nového přihlášení.
Nespouštěné testy neoznačuj jako úspěšné. Pokud prostředí blokuje část ověření, pokračuj nezávisle a uveď konkrétní blokátor.
12. Předání
Aktualizuj docs/progress.md, docs/decisions.md a README podle potřeby. Zachovej historii etap, popiš migrace, spuštěné testy, omezení a další krok.

Závěrečný český report má obsahovat:
- co je funkční,
- jak vyzkoušet výrobek ze vzoru i ruční výrobek,
- jak vyzkoušet checkboxy, deník, fotografie a uložení nového vzoru,
- výsledky kontrol a neověřené body.
Tato etapa je první ucelený cyklus pro studium; vlastní skladová výroba ještě hotová není. Po dokončení etapy 5 se zastav. Etapu 6 nezačínej.