Craftbook — prompt pro Codex, etapa 6
Implementuj etapu 6: materiály, nákupy a skladová historie v existujícím repozitáři Craftbook. Uživatelka potvrdila dokončení etapy 5. Proveď implementaci i ověření, nikoli pouze návrh. Komunikuj česky.
1. Kontext a rozsah
Nejprve přečti AGENTS.md, docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md a docs/ui-guidelines.md. Zkontroluj git status, aktuální modely, migrace, autentizaci, soubory, decimal knihovnu a testy.

Navazuj na skutečný stav repozitáře. Schválené výchozí revize jsou produktová 0.3, technická 0.2 a plán 1.1; novější schválená rozhodnutí mají přednost. Nevracej starší návrhy admin UI ani Markdown zdrojového editoru. Zachovej dosavadní školní cyklus, soukromé soubory a oprávnění.

Výsledkem je funkční vlastní sklad:
- materiálové karty,
- počáteční zásoba,
- nákupy s dodavatelem, cenou a přílohou faktury,
- odpis s důvodem,
- inventurní korekce,
- neměnná historie pohybů,
- přesné zůstatky a ocenění včetně neznámých cen.
Neimplementuj rezervace ani spotřebu navázanou na výrobky. Ty patří etapám 7–8. Výrobu se zdrojem own nadále blokuj na serveru; školní výrobky se skladem nepropojuj. Neimplementuj vratný odpad z dokončení, opravy vypořádání výrobku, vybavení, boraxovou stupnici, nákupní seznam, AI, import faktur ani účetní/daňový systém.

Pracuj lokálně se Supabase. Bez cloudových migrací, nasazení, push, nových služeb a změn Heroku. Neresetuj existující data. Zachovej nesouvisející změny, verze závislostí a npm.
2. Přístup pouze s vlastní dílnou
Každá skladová stránka a serverová operace vyžaduje platnou relaci, aktivní účet a has_workshop=true. Platí to také pro přímé požadavky, vydání odkazu na fakturu a dokončení uploadu připojovaného k nákupu.

Vypnutí vlastní dílny nesmí smazat skladová data. Po opětovném zapnutí se znovu zpřístupní. Zabraň obejití přes přímou URL, podvržené ID nebo alternativní souborový endpoint. Obecné dokumenty zůstávají dostupné i bez dílny.

Používej stávající omezenou runtime DB roli, transakční kontext, RLS a vazby vynucující stejného vlastníka. Žádné běžné dotazy pod postgres/service role.
3. Materiálové karty
Zprovozni seznam, hledání, filtry typu, detail, vytvoření, úpravu a archivaci.

Typy a jednotky:
- kov: g, nezávisle na formě,
- kámen: ks,
- hotová součástka: ks.
U kovů eviduj podle potřeby kov/slitinu, ryzost, formu (drát, plech apod.), profil a rozměry. Například „Ag 925 — kulatý drát Ø 1 mm“ a „Ag 925 — plech 0,8 mm“ jsou odlišné karty. U kamenů a součástek umožni popis a rozměry odpovídající typu. Nevytvářej složitý globální katalog ani automatické převody délky na hmotnost.

Jednotka plyne z typu a nesmí se měnit po prvním pohybu. Karty s historií nesmějí změnou typu nebo specifikace začít představovat jiný fyzický materiál. Dovol opravu názvu/popisu; významnou změnu řeš novou kartou. Historické řádky musí zachovat důležité údaje v okamžiku operace.

Karty s historií archivuj místo mazání. Archivované karty zůstávají v historii a přehledu existující zásoby, ale nenabízej je pro nové pohyby, dokud je uživatel neobnoví. Archivace nesmí skrýt hodnotu zásob nebo vynulovat zůstatek.
4. Před kódem konkretizuj skladový model
Přidej potřebné InventoryItem, Purchase, PurchaseLine, InventoryBalance, InventoryMovement a Operation, případně použij již existující kompatibilní mechanismus idempotence. AssetLink rozšiř o skutečný FK na Purchase, nikoli polymorfní neověřovaný řetězec.

Do docs/decisions.md nejprve napiš fyzické sloupce a invarianty zůstatků a historie:
- volné fyzické množství,
- oceněná část volného množství,
- hodnota oceněné části,
- neoceněná část volného množství,
- oddělené údaje potřebné pro pozdější rezervované množství a jeho ocenění.
Historie musí umožnit přesnou rekonstrukci všech složek, nikoli jen obecné quantity_delta/value_delta. Rezervační složky mohou být nyní nulové; neimplementuj předčasně rezervační workflow ani tabulky výrobního vypořádání.

InventoryBalance je transakčně udržovaný souhrn. InventoryMovement je append-only zdroj historie. Jedna operace zapisuje pohyby i souhrn ve stejné DB transakci. Existující pohyby runtime role nesmí přepisovat ani mazat. Přidej kontrolu shody souhrnu s historií; případný diagnostický příkaz nesmí potichu „opravovat“ data.

Vynucuj nezáporné zůstatky, součet oceněné a neoceněné části rovný volnému množství a nulovou hodnotu při nulovém oceněném množství. U nulové zásoby nesmí zůstat zaokrouhlovací hodnota.
5. Přesná čísla a ocenění
Dodrž specifikované numeric typy (výchozí množství numeric(18,3), peníze/hodnoty numeric(20,6)), přenášej decimal jako řetězce a používej přesnou aritmetiku. Autoritativní výpočty nesmějí používat JS Number. Částky zobrazuj v CZK, konečné částky zaokrouhluj pro zobrazení na dvě místa.

Fyzické ks jsou celé. Účetní rozdělení oceněné/neoceněné části může být zlomkové i u ks: nesmí znemožnit odepsání jednoho kusu ze smíšené zásoby. Zvol a zdokumentuj dostatečnou přesnost těchto účetních podílů, deterministické zaokrouhlení a přiřazení zbytku. Součty se musejí přesně zachovat.

Ocenění je vážený průměr volné zásoby. U plně oceněné zásoby:
- 10 g za 300 Kč + 10 g za 400 Kč = 20 g v hodnotě 700 Kč,
- průměrná cena = 35 Kč/g,
- odpis 2 g = úbytek hodnoty 70 Kč,
- zbývá 18 g v hodnotě 630 Kč.
Null cena není 0. Eviduj odděleně oceněné a neoceněné množství. Je-li část zásoby neoceněná, nezobrazuj známou hodnotu jako úplnou hodnotu skladu a neděl známou hodnotu celkovým množstvím jako údajný plný průměr. Zobraz známou část a upozornění na neúplné ocenění.

Odpis smíšené zásoby převádí oceněnou a neoceněnou část poměrně, v souladu se schváleným modelem. Například 10 g za 300 Kč + 10 g s neznámou cenou; odpis 4 g odebere 2 g oceněných v hodnotě 60 Kč a 2 g neoceněných. Zůstává 16 g, z toho 8 g oceněných v hodnotě 240 Kč a 8 g neoceněných. Náklad celého odpisu zůstává neúplný.

Nový nákup neoceňuje zpětně staré neoceněné pohyby ani školní výrobky. Nezaváděj dodatečné historické přecenění.
6. Počáteční zásoba a nákup
Po založení karty nabídni zadání počátečního množství s volitelnou známou pořizovací hodnotou. Bez ceny vznikne neoceněná zásoba, nikoli zásoba za nula Kč. Počáteční zásobu zapiš jako zvláštní evidovaný pohyb, ne falešný nákup u dodavatele a ne přímou editaci balance.

Nákup má datum, dodavatele jako text, volitelnou poznámku, materiálové řádky a volitelné přílohy faktury. Jedním nákupem lze přijmout více materiálů.

Řádek má kartu, kladné množství a celkovou pořizovací cenu nebo výslovně neznámou cenu. Za autoritativní považuj celkovou cenu řádku; jednotková cena je odvozená. Pokud UI umožní zadat jednotkovou cenu, převod definuj jednoznačně a nepřijímej dvě vzájemně rozporné hodnoty. Nula Kč je povolená skutečná známá hodnota.

Cena zde znamená uživatelem zadaný materiálový náklad; neimplementuj DPH ani automatické rozdělování dopravy. Fakturu neparsuj a nedopočítávej z ní ceny.

Přijetí celého nákupu, jeho řádků, změn zůstatků, pohybů a Operation je atomické. Neplatný jediný řádek nesmí zanechat částečně přijatý nákup. Stejná karta na více řádcích se musí promítnout správně, se společným zamčením zůstatku.

Přílohy využívají hotový souborový modul. Upload probíhá mimo DB transakci; k nákupu připojuj jen ověřené ready assety stejného vlastníka. Neúspěšné připojení nebo neodeslaný formulář ošetří existující úklid. Nesmaž sdílený asset při odstranění jedné vazby. Používej jen již podporované bezpečné formáty.

Po zaúčtování nákupu nedovol přímou editaci množství/cen ani smazání jeho pohybů. Pokud specifikace nepožaduje plný opravný nákupový workflow už nyní, v této etapě jej nepřidávej: nabídni transparentní inventurní korekci s důvodem a odkazem na původní nákup. Úprava poznámky nebo přílohy nesmí měnit ocenění historie.
7. Odpis a inventurní korekce
Odpis:
- kladné množství a povinný důvod, například „úprava šperku“ nebo „ztráta“,
- pouze z volné zásoby,
- ocenění z aktuálního volného fondu, včetně poměrné neoceněné části,
- odmítnutí nedostatku bez částečného zápisu,
- žádné záporné fyzické množství.
Inventurní korekce:
- uživatel zadá skutečně zjištěnou volnou zásobu a povinný důvod,
- server spočítá rozdíl vůči očekávanému aktuálnímu zůstatku,
- při souběžné změně vrať konflikt, ne tichý přepočet vůči jinému základu,
- záporný rozdíl se oceňuje stejně jako odpis,
- kladný rozdíl má explicitně známou celkovou hodnotu přírůstku, jinak je přírůstek neoceněný,
- nikdy nepřepisuj staré pohyby ani přímo nenastavuj zůstatek bez nového pohybu.
Výše uvedené výchozí pravidlo korekce použij, pokud aktuální schválené podklady neobsahují konkrétnější pravidla. Zaznamenej volbu. Nedělej skryté přecenění zbývající zásoby. Nový pohyb má vazbu na opravovanou operaci, pokud jde o nápravu chyby.

Opravu staršího pohybu neřeš slepým obrácením, které by mohlo porušit pozdější operace. Plné historické přepočty nejsou tato etapa.
8. Transakce, souběh a idempotence
Každá změna zásoby je serverový příkaz. Znovu použij existující vzory; UI není autorita.
- Klient posílá request_key, server ukládá jeho normalizovaný payload hash a výsledek v rámci stejné transakce jako doménové změny.
- Stejný klíč se stejným payloadem vrátí stejný výsledek i po ztrátě odpovědi; s jiným payloadem vrátí konflikt.
- Klíč je oddělen podle vlastníka a příslušného rozsahu operace. Ošetři i dva souběžné první požadavky.
- Dotčené balance řádky zamykej ve stabilním pořadí. Dostupnost a ocenění přepočítej po získání zámku.
- Ošetři první zápis na nové kartě, souběžné nákupy a odpisy i vícepoložkové nákupy v opačném pořadí.
- Chyba ruší celou operaci. Omezené opakování transakce nesmí vytvořit dvojí příjem.
- Obchodní datum nákupu odděl od neměnného pořadí skutečného zaúčtování. Zpětně zadané datum nesmí automaticky přepočítat dřívější historii.
Nevytvářej neomezené retry smyčky ani držení DB transakce během nahrávání souboru.
9. Rozhraní
Zprovozni stávající Materiály → Zásoby / Nákupy / Pohyby.

Zásoby:
- název, specifikace, jednotka a volné množství,
- srozumitelné ocenění a označení neznámých cen,
- detail karty s historií a akcemi příjem, odpis, inventura, archivace,
- přehled rezervovaného množství zatím pouze pokud odpovídá reálnému modelu: v této etapě nula, bez funkční akce rezervace.
Nákupy:
- seznam s dodavatelem, datem a úplnou/neúplnou cenou,
- formulář více řádků,
- detail s přílohami a odkazy na vzniklé pohyby.
Pohyby:
- typ, materiál, změna množství, známá hodnota/neúplné ocenění, důvod, datum zaúčtování a původ,
- filtry podle materiálu, typu a data, stabilní stránkování,
- jasné označení počátečního stavu a inventurní korekce.
Nesčítej gramy a kusy do jednoho množstevního KPI. Případnou celkovou hodnotu skladu označ jako částečnou, pokud něco nemá cenu. Nepřidávej falešná data.

Přijímej běžný český desetinný vstup, validuj ho jednoznačně na serveru a zobrazuj české formátování. Zachovej přístupnost, fokus, chybové stavy, potvrzení odpisu/korekce a mobil 375 px. Interní ledgerové složky nevysvětluj v běžném formuláři, pokud uživateli nepomáhají rozhodnout.
10. Povinné ověření
Použij skutečný lokální PostgreSQL, Auth a Storage; RLS ověř skutečnou runtime rolí. Testy mají vlastní izolovaná data.

Ověř:
1. Příjem 10 g / 300 Kč a 10 g / 400 Kč → 20 g / 700 Kč / 35 Kč za g; odpis 2 g → 18 g / 630 Kč.
2. Smíšené ocenění podle příkladu výše; null není 0. Odepsání celé zásoby odstraní i přesné účetní zbytky.
3. Smíšená kusová zásoba dovolí odpis 1 ks při zachování zlomkových účetních podílů. Fyzických 0,5 ks server odmítne.
4. Přesnost při opakovaných malých příjmech/odpisech bez driftu; limity numeric a odmítnutí nepovolené přesnosti.
5. Počáteční zásoba se zapíše do historie a dvojí odeslání ji nezdvojnásobí.
6. Duplicitní request_key se stejným payloadem i souběžně má jediný účinek; jiný payload je konflikt.
7. Dva souběžné odpisy nemohou přečerpat zásobu. Souběžný příjem a odpis zachovají konzistentní množství a hodnotu.
8. Chyba u jednoho řádku vícepoložkového nákupu vrátí celou transakci. Opakovaná karta na více řádcích funguje.
9. Inventura s neaktuálním očekávaným zůstatkem je konflikt; odpis/korekce bez důvodu se odmítne.
10. Rekonstrukce všech balance složek z historie přesně souhlasí po příjmech, odpisech a korekcích. Runtime role nemůže změnit/smazat historii.
11. Uživatel A nezíská data ani fakturu B, nepodvrhne vazbu a nemůže volat sklad bez vlastní dílny. Vypnutí/zapnutí dílny zachová data.
12. Archivovaná karta s historií a zásobou se neztratí; změna jednotky/type s historií je zakázaná.
13. Soukromé faktury, neúspěšný upload, úklid a sdílené reference fungují jako v etapě 4.
14. Školní výrobky z etapy 5 se chovají stejně a neprovádějí skladové pohyby; podvržený source=own je stále odmítnut.
15. Desktop a 375 px: karta → nákup s fakturou → odpis → inventura → historie → nové přihlášení.
Spusť lint, typecheck, build a relevantní regresní testy. Neověřené kontroly označ jako neověřené, nikoli úspěšné. Při blokátoru pokračuj nezávisle a konkrétně ho popiš.
11. Předání
Aktualizuj docs/progress.md, docs/decisions.md, README a případně dokumentaci skladového modelu. Zachovej historii etap. Uveď migrační postup, invarianty, pravidla neznámých cen, zaokrouhlení, souběhu a korekcí.

Závěrečný report česky: hotové funkce, výsledky testů, omezení a přesný ruční scénář s 10 g / 300 Kč + 10 g / 400 Kč a odpisem 2 g. Nevypisuj tajné hodnoty.

Po dokončení etapy 6 se zastav. Rezervace a zahájení vlastní výroby patří do dalších etap.