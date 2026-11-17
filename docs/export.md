# Export vlastních dat

V Nastavení otevřete **Export vlastních dat**.

1. **Stáhnout vše včetně příloh** vytvoří ZIP s `data.json`, složkou `csv`,
   `manifest.json` a skutečnými bajty dostupných příloh ve složce `files`.
2. Pro více než 32 MiB příloh zvolte **Stáhnout záznamy JSON a CSV** a následně
   všechny jednotlivé soubory ze seznamu. Manifest datového archivu obsahuje
   jejich UUID, původní názvy, vazby, očekávané SHA-256 a relativní download cesty.
   Tyto cesty vyžadují aktuální přihlášení; nejsou to podepsané veřejné odkazy.
3. Uložte archiv chráněně na svém zařízení. Obsahuje vaše soukromé záznamy.
   Selhané stahování opakujte; JSON chybová odpověď není platný ZIP.

JSON verze 1 je autoritativní úplná strukturovaná reprezentace doménových
záznamů, archivovaných položek a historie. Obsahuje vazby mezi UUID i obsah
poznámek/snapshotů. Decimal a bigint jsou řetězce, null zůstává null, časy
mají UTC zónu. Neobsahuje hesla, tokeny, úložištní klíče ani cizí vlastníky.
CSV jsou doplňkové přehledy jednotlivých tabulek: UTF-8 s BOM, oddělovač
středník, uvozovky a escapování. Potenciální vzorce mají prefix apostrof;
JSON hodnoty se tím nemění. Sloupce odpovídají názvům polí v JSON.

Neznámé množství a cena jsou null; nula je explicitní nula. Stav výrobku je
planned / in_progress / done, zdroj school / own. Asset_link mapuje soubory
na dokument, postup, výrobek, deník, snapshot nebo fakturu.

Manifest `complete=true` označuje pouze archiv s úspěšně ověřenými bajty
všech vlastních souborů. Datový archiv s oddělenými soubory má complete=false.
Pending/deleting soubor zůstane uveden s jeho stavem a nezahrne se jako
ověřená příloha; úplný archiv pak má také complete=false. Pokud ready objekt
chybí nebo nesouhlasí velikost/SHA-256, plné stažení selže celé (409).

DB se načítá v REPEATABLE READ READ ONLY transakci. Transakce skončí před
sítí; dlouhé čtení souborů nedrží skladové zámky. Storage nemá společnou DB
transakci: soubory jsou neměnné a při čtení se kontrolují proti snímku.
Souběžný úklid může vyvolat kontrolovanou chybu a nutnost opakovat export.
Samostatné soubory se ověřují proti novému vlastnímu snímku při stažení;
při archivaci dat a pozdějším stahování kontrolujte SHA-256 původního manifestu.

Meze: jeden současný export v celé aplikaci (lease 120 s), požadavek včetně
přenosu 95 s, SQL 8 s. Maximálně 10 000 řádků / 8 MiB SQL JSON, 16 MiB
formátovaného JSON, 24 MiB JSON+CSV a 32 MiB bajtů příloh v plném ZIP.
Jednotlivé přílohy dodržují existující limit 10 MiB. Pokud limit překročí samotné
záznamy, je nutné provozní řešení; export nikdy nevrací jen první stránku.
Žádný disk dyno, background job ani veřejné objekty. Paměť je ohraničena
limity; ZIP se připravuje před HTTP úspěchem a přenáší po blocích. Po přerušení
se uvolní lease; při tvrdém pádu procesu vyprší do dvou minut.

Export funguje i pro vlastní historická skladová data po vypnutí dílny.
Běžné skladové stránky, čtení faktur a mutace tím nejsou zpřístupněné.
Export není provozní záloha ani příslib automatického importu. Provozní
obnova je samostatná privilegovaná operace podle backup-and-restore.md.
