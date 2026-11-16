# Zlatnická dílna — technická specifikace a objektový model
Revize 0.2 · 16. 11. 2026 · Návrh ke schválení
Navazuje na produktovou specifikaci revize 0.3. Implementační plán ani prompt pro Codex nejsou součástí tohoto dokumentu.

## 1. Rozhodnutí a rozsah
Modulární monolit: Next.js App Router + TypeScript, serverový Node.js runtime, PostgreSQL v Supabase, Supabase Auth a soukromé Storage. Hosting: jedna Heroku Eco web dyno ve stávajícím předplatném. Render zůstává alternativou; MongoDB se nepoužívá.

Nové produktové upřesnění: uzavřený pilot bez veřejné registrace. Julia spravuje účty mimo Craftbook přes Supabase Dashboard a provozní skript. Přihlášení e-mailem a heslem bez SMTP; prvotní předání a obnova hesla probíhají osobně přes administrátora. Craftbook neobsahuje administraci ani administrační roli. Přístup vlastníka projektu do Supabase je provozní privilegium a může zahrnovat data; nejde o oprávnění běžného uživatele Craftbooku.

MVP bez vlastního administračního UI. V1–V3 se nyní neimplementují. Všechna další implementační rozhodnutí níže jsou návrhem ke schválení.

## 2. Služby a provoz
- Heroku: jedna Eco web dyno, bez workeru, doplňkové databáze a placených add-onů. Stávající Eco předplatné je již placené; cílem je nulový přírůstek nákladů, nikoli bezplatné Heroku.
- Eco sdílí 1 000 hodin měsíčně mezi aplikacemi. Před nasazením ověřit starou aplikaci a spotřebu; její vypnutí vyžaduje samostatné rozhodnutí uživatelky. Žádné automatické změny existující aplikace.
- Druhý bezplatný Supabase projekt je izolovaný od prvního projektu. Vývoj lokálně, cloudový projekt pro pilot. Lokální Supabase vyžaduje dostupný Docker; pokud nebude, způsob vývojového prostředí upřesnit před plánem.
- Volit kompatibilní evropské regiony. Výchozí HTTPS doména hostingu, bez nákupu domény.
- Eco se uspává; první načtení může být pomalejší. Supabase Free se může pozastavit při neaktivitě. Nepoužívat umělé keep-alive požadavky.
- Fotografie a dokumenty nikdy neukládat trvale na disk dyno.
- Zdrojový kód v Git repozitáři. Poskytovatele repozitáře není nutné vybírat s hostingem; možné nasazení přes Heroku Git.
- Node LTS kompatibilní s vybranou stabilní verzí Next.js; přesné verze uzamknout při inicializaci, nikoli používat neomezené „latest“.
- Drizzle ORM + pg pro typované SQL, transakce a migrace; Zod pro serverovou validaci. Jde o knihovny v projektu, nikoli nové placené služby.
- Žádné Redis, fronty, mikroservisy ani vektorová databáze v MVP.

## 3. Hranice aplikace
Prohlížeč posílá příkazy serveru Next.js. Server ověří identitu, oprávnění a vstup a provede aplikační operaci. Zůstatky a ceny nikdy neurčuje prohlížeč.

Moduly:
- identity: relace, přihlášení, změna hesla;
- ops skripty mimo webovou aplikaci: provision účtů, deaktivace a reset;
- documents: poznámky, dokumenty a odkazy na soubory;
- procedures: vzorové postupy a požadavky na materiály;
- products: stavy, kopie postupu, deník a dokončení;
- inventory: příjmy, rezervace, spotřeba, ocenění a odpisy;
- files: autorizace nahrávání a stahování;
- shared: přesná čísla, validace, transakční kontext, chybové odpovědi.

UI nesmí obsahovat jedinou autoritativní implementaci obchodních pravidel. Serverové služby se volají z Route Handlers nebo Server Actions; nepřidávat druhou paralelní implementaci stejných pravidel.

## 4. Přihlášení bez SMTP, správa mimo aplikaci
Supabase Auth uchovává hesla a ověřuje přihlášení. Dashboard má Authentication > Users. Craftbook nemá /admin ani odkaz „Správa uživatelů“, žádné veřejné endpointy pro zakládání cizích účtů a nepotřebuje aplikační admin roli.

Provozovatel založí uživatele v Dashboardu s heslem a potvrzením identity, pokud je tato volba v používané verzi dostupná. Nepoužívá e-mailovou pozvánku, která vyžaduje SMTP. Alternativní jednorázový lokální ops skript použije Auth Admin createUser s password a email_confirm=true. Auto-confirm není důkaz vlastnictví schránky.

Samotné založení identity v Auth nestačí: ops skript pro konkrétní user ID idempotentně vytvoří UserAccount/UserProfile, nastaví pending_password, must_change_password=true a expiraci dočasného přístupu 48 hodin. Bez záznamu UserAccount je přístup odmítnutý. Skript umí založení i inicializaci provést společně. Nové dočasné heslo se předá osobně, neukládá se do logů, souborů, DB aplikace ani argumentů shellu. Veřejné registrace jsou vypnuté.

Při prvním přihlášení aplikace povolí pouze změnu hesla a odhlášení. Po úspěšné změně se účet aktivuje. Pravidlo kontroluje server, nezávisle na UI. Běžný uživatel nesmí měnit chráněné příznaky přes profil ani Auth metadata. V nastavení lze změnit vlastní heslo po ověření současného. E-mail je pouze pro čtení.

Zapomenuté heslo řeší provozovatel ops skriptem: zablokovat aplikační přístup, změnit heslo přes Auth Admin, zrušit obnovovací relace, nastavit sessions_valid_after, dočasnou expiraci a povinnou změnu. Staré tokeny odmítá aplikace podle platnosti relace i před jejich expirací. Samostatný reset v Dashboardu bez synchronizace aplikačních příznaků není celý provozní postup. Deaktivace nejdřív zablokuje UserAccount, poté Auth; nové podepsané odkazy na soubory se nevydávají.

AccountProvisionOperation uchovává fáze operace bez hesel; Auth a DB nejsou jedna transakce. Částečné selhání ponechá účet bez přístupu a lze je bezpečně opravit. Vlastník provozuje skripty mimo nasazenou aplikaci s oddělenými tajemstvími. Ostatní uživatelé nemají účet ani pozvánku do Supabase Dashboardu.

## 5. Autorizace a databázové připojení
Doménové tabulky leží ve vlastním schématu app, které není vystavené přes Supabase Data API. Prohlížeč k nim nemá přímý přístup. Auth a Storage zůstávají službami Supabase.

Server ověřuje uživatele u Supabase; nedůvěřuje pouze neověřenému obsahu cookie. Používá podporovaný SSR mechanismus relací, HTTPS, bezpečné atributy cookies a ověření originu u mutací. Soukromé odpovědi se nesmějí sdílet mezi uživateli přes cache.

Připojení Drizzle přes Supabase session pooler s TLS a malým pg poolem (návrh max 5 spojení na proces). Každý požadavek má jednu transakci pro potřebná DB čtení/zápisy a transakčně lokální kontext ověřeného user ID. Kontext nesmí přetéct do dalšího spojení v poolu.

Běžná runtime role nemá BYPASSRLS a nevlastní tabulky. Vlastnické RLS politiky ve schématu app porovnávají owner_id s transakčně nastaveným ověřeným uživatelem; bez kontextu odmítají přístup. Serverové služby navíc filtrují podle vlastníka. Migrace používají oddělené oprávnění. Provozní oprávnění pro identity existují pouze mimo veřejnou aplikaci; webový runtime nemá rozhraní pro správu cizích účtů.

Žádné spoléhání na auth.uid() u přímého ORM spojení bez předání kontextu. RLS nelze testovat pouze pod privilegovaným postgres účtem. Před produkcí ověřit i reuse spojení uživatele A následovaný uživatelem B.

Supabase privilegovaný klíč je pouze v serverovém adaptéru pro Auth Admin a soukromé soubory; nikdy NEXT_PUBLIC proměnná. Veškeré vydání odkazu na soubor vyžaduje kontrolu aktuálního účtu a vlastnictví.

## 6. Konvence objektového modelu
UUID jako ID. Doménové objekty mají owner_id, created_at a updated_at, kde to dává smysl. Čas UTC v DB, zobrazení Europe/Prague. Vazby mezi doménovými objekty musí zachovat stejného vlastníka, ideálně složeným cizím klíčem (owner_id, id).

Množství numeric(18,3), pro ks kontrola celého čísla. Cena a hodnota numeric(20,6), měna MVP CZK. Přenos desetinných hodnot jako řetězce; aritmetika přes přesné desetinné výpočty, nikoli běžný JS Number. Zaokrouhlení na 2 místa až při zobrazení konečné částky.

Null množství znamená neznámé, nula je skutečná nula. Neznámá cena je oddělená od nulové ceny. Specifikace kovu a ryzost zůstávají zachované ve snímcích i po změně názvu katalogu.

## 7. Objektový model MVP
Níže jsou logické objekty a podstatné atributy. Schéma databáze musí zachovat uvedené vazby a omezení.

| Objekt | Hlavní atributy | Vazby / význam |
|---|---|---|
| AuthUser | Supabase ID, email, spravované heslo | Externě spravovaná identita |
| UserAccount | auth_user_id, status, must_change_password, temp_expires_at, sessions_valid_after | 1:1 k AuthUser; pouze chráněná změna |
| UserProfile | user_id, display_name, has_workshop=false | Běžné nastavení uživatele |
| AccountProvisionOperation | operator_reference, target_id, kind, status, request_key, error_code | Obnova částečně dokončených operací; bez hesel |
| Document | title, kind note/file, body_json, schema_version nebo asset_id | Vlastní poznámka nebo nahraný PDF/DOCX/MD |
| Procedure | title, description, revision_counter, archived_at | Aktuální vzor, počitadlo změn není historie verzí |
| ProcedureStep | procedure_id, position, text | 1:N kroky, unikátní pořadí |
| ProcedureMaterial | procedure_id, specification, unit, quantity nullable | Požadavek nezávislý na existenci skladu |
| Product | title, description, created_without_procedure, saved_procedure_id nullable, status, source school/own, procedure_id nullable, row_version, school_cost nullable, started_at, completed_at | Jeden výrobek/pár/součástka |
| ProductProcedureSnapshot | product_id unique, source_id nullable, source_revision, schema_version, content_json | Neměnná kopie potvrzeného postupu při zahájení |
| ProductStep | product_id, source_step_id nullable, position, text, is_completed, completed_at, row_version | Pracovní checkboxy oddělené od neměnné kopie; bez obrázků |
| ProductMaterial | product_id, specification_snapshot, unit, planned_quantity nullable, inventory_item_id nullable, reserve_enabled | Pracovní seznam a mapování na sklad |
| JournalEntry | product_id, occurred_at, body_json, schema_version | 1:N zápisů; poznámky a zkušenosti |
| Asset | storage_key, original_name, mime, bytes, state pending/ready/deleting, checksum | Metadata soukromého souboru |
| AssetLink | asset_id, právě jeden document_id/procedure_id/product_id/journal_entry_id/purchase_id, role, position | Vložení obrázku, příloha, průběh nebo hotová fotka |
| InventoryItem | name, type metal/stone/component, unit, metal, fineness, form, profile, dimensions, archived_at | Skladová karta konkrétní specifikace |
| Purchase | supplier_text, date, note | 1:N nákupních řádků, přílohy faktury |
| PurchaseLine | purchase_id, inventory_item_id, quantity, total_cost nullable, unit_cost | Příjem; cena se neodvozuje z ceny na internetu |
| InventoryBalance | inventory_item_id unique, free_qty, free_known_qty, free_known_value, free_unknown_qty | Zamykatelný souhrn; ověřitelný proti historii |
| Reservation | product_material_id, inventory_item_id, quantity, known_quantity, known_value, unknown_quantity, status | Více cenových částí při navyšování v různých okamžicích |
| InventoryMovement | item_id, operation_id, kind, free_qty_delta, reserved_qty_delta, known_value_delta, unknown_qty_delta, purchase_line_id/product_id nullable, reason, reversal_of nullable | Neměnný záznam historie pohybů |
| ProductSettlement | product_id, revision, completed_at, supersedes_id nullable, cost_status | Revize vypořádání |
| SettlementLine | settlement_id, product_material_id, taken_qty, in_product_qty, returned_qty, scrap_qty, lost_qty, cost_breakdown_json, cost nullable | Skutečnost a cenový podklad; vratný odpad bez ceny výrobku |
| Operation | owner_id, request_key, payload_hash, kind, result_reference | Unikátní opakovatelný příkaz bez dvojího účinku |

AssetLink používá kontrolu právě jednoho cíle a skutečné cizí klíče, nikoli neověřovaný obecný řetězec entity_type/entity_id. Vložený obrázek v editorovém JSONu odkazuje na asset ID, ne na expirovatelnou URL. Jeden soubor může mít více odkazů stejného vlastníka; mazání respektuje všechny odkazy včetně kopií postupů.

### Klíčové vztahy
- Uživatel vlastní N dokumentů, postupů, výrobků a skladových karet.
- Postup má N kroků a N materiálových požadavků; může založit N výrobků.
- Výrobek má 0..1 neměnnou kopii postupu, N materiálových řádků, N zápisů a N revizí vypořádání.
- Materiálový řádek má 0..N rezervací. Školní výrobek rezervaci nemá.
- Karta materiálu má N příjmů, rezervací a pohybů.
- Vypořádání má N řádků a jednu aktuální revizi na výrobek.

## 8. Postup a jeho kopie
planned uchovává vazbu na vzor a případný pracovní návrh. Před zahájením se ověří revision_counter vzoru. Pokud se od otevření formuláře změnil, server vrátí konflikt a uživatel potvrdí novou podobu; nesmí dojít k tichému přepsání.

Přechod do in progress atomicky uloží snapshot, vlastní seznam materiálů, potvrzené rezervace a stav. Snapshot je immutable JSON s verzí struktury, obsahuje kroky, specifikace, množství včetně null a odkazy na přílohy. Změny skutečného provádění patří do deníku a pracovních dat výrobku, nikoli do původního snapshotu.

Návrat do planned u zahájeného výrobku nesmí smazat původní kopii ani historii. Návrh MVP: kopie zůstane a při opětovném zahájení se použije znovu; pro jiný vzor založit nový výrobek. Před návratem vypořádat skutečný odběr a uvolnit jen nepoužité rezervace. done se neupravuje obecným přepnutím stavu, ale opravou vypořádání.

### Kroky a procenta průběhu
ProcedureStep i ProductStep jsou textové, bez fotografií a bez obrazových uzlů. ProductStep se při zahájení odvodí z potvrzené kopie nebo z ručně zadaných kroků. Snapshot se checkboxy nemění. Ručně vytvořený výrobek nemá source_id; při zahájení lze uchovat výchozí podobu ručně zadaného plánu v tomtéž snapshot formátu.
Průběh = completed / total * 100, zobrazení zaokrouhlené na celé procento spolu s „X z Y kroků“. Při total=0 je průběh null a UI „Bez kroků“. Změna kroků používá row_version; krok se odškrtne na explicitní false/true, nikoli nebezpečným opakovatelným toggle. Check nemění sklad. 100 % nespouští dokončení. Chybějící checky jsou upozornění před dokončením, ne tvrdý zákaz. Při done je checklist pouze pro čtení.

### Vytvoření bez vzoru a uložení nového postupu — MVP
Formulář: název, popis, materiály s g/ks a množstvím/null, zdroj school/own a volitelné textové kroky. Zdroj school automaticky bez vlastní dílny. „Uložit plán“ a „Zahájit výrobu“ jsou rozdílné akce. Chybějící množství umožní pokračovat bez rezervace.
Po dokončení createProcedureFromProduct připraví editovatelný formulář, nikoli automatický zápis. Předvyplní title, description, aktuální ProductStep.text/position bez checkboxů a materiály: vlastní taken_qty-returned_qty (včetně odpadu/ztráty) s vysvětlením a možností úpravy; školní známé skutečné množství, jinak plán, jinak null. Neexportuje ceny, skladová ID jako podmínku použití, fotografie kroků ani celý deník.
Uložení nového Procedure je samostatná idempotentní transakce s vazbou na zdrojový výrobek. Uloží saved_procedure_id, nemění původní procedure_id ani snapshot či cenu. Chyba nebo odmítnutí nemění done. Po úspěchu nabídnout otevření uloženého postupu, ne opakovanou tvorbu. Další návrat k nabídce je možný, pokud dosud uložen nebyl. V1 nadále rozšíří souhrn a aktualizaci existujícího vzoru.

## 9. Zásoby, ocenění a neznámé ceny
Jednoznačný návrh ocenění: vážený průměr volné zásoby. Rezervace přesune množství i příslušnou hodnotu z volné zásoby do samostatně oceněné rezervace. Nový nákup přepočítá volný fond, nikoli existující rezervace. Součet volné zásoby a aktivních rezervací je evidovaná zásoba před konečným odpisem. Toto upřesňuje pojem „vážený průměr“ z produktu.

Příklad: volných 10 g za 30 Kč/g; rezervace 5 g ponechá volných 5 g za 150 Kč a rezervovaných 5 g za 150 Kč. Nákup dalších 5 g za 40 Kč/g vytvoří volných 10 g za 350 Kč, průměr 35 Kč/g; rezervace zůstává 30 Kč/g.

Neznámá cena nesmí vstoupit jako nula. Evidovat známé množství/hodnotu a neoceněné množství zvlášť. Návrh MVP při smíšené zásobě: rezervace i odběr převádějí známou a neznámou část poměrně; číslo nákladu zůstane neúplné, dokud obsahuje neznámý podíl. Rozdělení je účetní podklad, ne fyzická identifikace kusů. Zaokrouhlovací zbytek při rozdělení připadne poslední části, aby součty přesně seděly. Pro plně oceněný výsledek je vhodné nacenit počáteční zásobu před používáním.

Neoceněné historické výrobky se novým nákupem nepřecení. Dodatečné ocenění historické spotřeby je explicitní oprava s auditní stopou, ne tichá změna.

## 10. Kritické příkazy
Všechny příkazy přijímají request_key a očekávanou row_version, pokud mění existující záznam. Stejný klíč a payload vrátí stejný výsledek; stejný klíč s jiným payloadem je konflikt. Operace a doménové změny se ukládají v jedné transakci.

Zamykat produkt a dotčené InventoryBalance řádky ve stabilním pořadí ID. Dostupnost znovu ověřit po získání zámku. Unikátní omezení a serverové kontroly chrání i souběžné požadavky.

| Příkaz | Účinek |
|---|---|
| createPurchase | Zapíše nákup, příjem, hodnotu a historii v jedné transakci |
| setProductStepCompleted | Explicitně uloží true/false a vrátí přepočítaný průběh, bez skladového pohybu |
| createProcedureFromProduct | Po potvrzení formuláře vytvoří nový vzor a vazbu na hotový výrobek; idempotentně |
| startProduct | Potvrdí zdroj, uloží snapshot, případně rezervuje známé položky, změní stav |
| updateReservations | Zvýší/sníží konkrétní rezervace a přesune jejich hodnotu; bez dvojího zápisu |
| completeProduct | Doplní skutečnost, vypořádá rezervace nebo provede přímou spotřebu, uloží cenu a stav done |
| correctSettlement | Opraví předchozí vypořádání pomocí kompenzačních pohybů a nové revize |
| writeOffMaterial | Odpis volné zásoby s povinným důvodem |
| adjustInventory | Inventurní korekce; množství/hodnota a důvod, bez porušení rezervací |

### Dokončení
Pro kovy: odběr = materiál ve výrobku + použitelná vratka + vratný odpad + nevratná ztráta. U ks jsou celá čísla a scrap_qty=0; poškozený nepoužitelný kus je ztráta.

Formulář umožní potvrdit rezervaci beze změny nebo zadat skutečnost bez rezervace. Pokud je odběr menší než rezervace, přebytek se uvolní v původním ocenění. Vyšší odběr čerpá rozdíl z volné zásoby v aktuálním průměru. Odběr přes více cenových částí se přiřadí v pořadí jejich vzniku; výsledná hodnota odběru se poměrně rozdělí mezi výrobek, vratku, odpad a ztrátu. Tím je výpočet deterministický.

Cena výrobku = hodnota materiálu ve výrobku + hodnota nevratné ztráty. Vratka vrací množství i původní hodnotu do volného fondu. Vratný odpad a nevratná ztráta se odečtou ze zásoby; odpad má pouze historický záznam u vypořádání, nemá vlastní sklad ani automatickou výkupní cenu.

Bez rezervace se cena zachytí při zápisu skutečné spotřeby. Existující rezervace jiných výrobků se nesmějí spotřebovat. Nedostatek vyvolá srozumitelný konflikt a žádná část dokončení se neuloží.

Školní dokončení neprovádí skladové pohyby a nevyžaduje cenu. Ruční cena je volitelná, bez automatického výpočtu či povinného odhadu.

### Opravy
Historické pohyby nepřepisovat ani nemazat. Oprava vrací původní účinek kompenzačním pohybem a aplikuje novou revizi v jedné transakci. Zachová známé původní cenové podklady pro původní množství; nové množství ocení aktuálně. Změna dostupnosti nebo hodnoty, která by porušila novější rezervace, se zablokuje a nabídne ruční řešení. Ceny jiných hotových výrobků se nepřepočítávají.
Materiálové karty s historií se archivují. Výrobek se skladovými pohyby nelze smazat bez vypořádání.

## 11. Soubory a dokumenty
Soukromý bucket, objektová cesta owner_id/asset_id/filename. Prohlížeč dostane krátkodobý podepsaný upload/download pouze po autorizaci serverem. Přímé nahrávání do Storage omezuje provoz přes Heroku. Po uploadu server ověří existenci, velikost a povolený typ a nastaví Asset ready; teprve pak se připojí k obsahu.

Návrh limitů pilotu: obrázek po zmenšení max 5 MB, dokument max 10 MB, delší strana nové fotografie max 2 000 px. Komprese a změna formátu v prohlížeči, jasná informace o ukládání optimalizované kopie. HEIC buď podporovat ověřenou lokální konverzí, nebo zobrazit konkrétní instrukci pro JPEG; neslibovat neověřenou podporu. Limity jsou konfigurovatelné a musí se hlídat i na serveru.

WYSIWYG obsah ukládat jako validovaný JSON s verzí schématu. Podporovat odstavce, nadpisy, tučné, kurzívu, seznamy, odkazy a obrázky přes Asset ID. Povolené uzly/atributy a URL validovat serverem; bezpečný renderer bez libovolného HTML nebo skriptů. Markdown exportovat z podporované podmnožiny a MD přílohy ponechat jako soubory. Nevystavovat zdrojový Markdown, režim vedle sebe ani náhledovou záložku. Výběr open-source editoru provést při implementaci, bez placené cloudové služby. PDF/DOCX se ukládá jako původní příloha; DOCX editor, OCR a extrakce textu nejsou MVP. U nahraných souborů ověřovat příponu, MIME a dostupnou signaturu, nikoli jen deklaraci klienta. Nejde o antivirovou službu.

Asset pending a neúplné uploady se uklízejí opakovatelným údržbovým příkazem. DB a Storage nejsou jedna transakce; mazání má stav deleting a lze ho opakovat. Soubory odkazované ze snapshotů se nemažou.

## 12. UI a rozhraní
Stránky: přihlášení, změna hesla, přehled, dokumenty, postupy, výrobky, sklad/nákupy, nastavení. Sklad je dostupný pouze s vlastní dílnou; server kontroluje stejné pravidlo.

Nastavení obsahuje zobrazované jméno, e-mail pouze pro čtení, vlastní dílnu a změnu hesla. Bez odkazu do administrace. Bez registrace, rolí školy a týmového sdílení.

Chyby mají stabilní kód a českou zprávu: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, PASSWORD_CHANGE_REQUIRED, VERSION_CONFLICT, STOCK_SHORTAGE, IDEMPOTENCY_CONFLICT, UPLOAD_INCOMPLETE. Dostupnost a cena se po mutaci načtou ze serveru. Databázové a Auth detaily nesmí unikat do uživatelské chyby.

Vyhledávání MVP podle názvu, stránkování a indexy owner_id + stav/datum/název. Bez externího vyhledávače.

## 13. Nasazení, konfigurace a obnova
Konfigurace přes Heroku Config Vars: APP_URL, Supabase URL a veřejný klíč, privilegovaný serverový klíč, DATABASE_URL, limity uploadů. Oddělený migrační přístup mimo běžnou runtime konfiguraci, pokud to nasazení dovoluje. Tajné hodnoty nejsou v Git ani klientském balíčku.

Migrace verzované v repozitáři a spuštěné jednou před kompatibilním releasem; nikdy reset pilotní DB při startu serveru. Návrat ke starému kódu automaticky nevrací schéma.

Bez SMTP není samoobslužné „Zapomenuté heslo“. UI vysvětlí kontaktování správce. Není potřeba nová e-mailová služba.

Pilot: před migrací a alespoň týdně při aktivním používání export DB a souborů na vlastní zařízení; bez slibu automatických cloudových záloh. Export uživatele zahrne JSON/CSV a přílohy, ale není náhradou úplné provozní zálohy. Provozní postup musí zahrnout Auth konfiguraci a způsob obnovy účtů i mapování vlastníků; obnova hesel může vyžadovat reset. Obnovu ověřit na lokálním prostředí. Testovací osobní data neukládat do Git.

Logy: request ID, druh operace, trvání, bezpečný error code. Nikdy hesla, tokeny, celé dokumenty, faktury nebo podepsané URL. Jednoduchý health endpoint bez citlivých dat; nevyužívat k umělému udržování Eco vzhůru.

## 14. Ověření před přijetím MVP
- Dva uživatelé: zákaz křížového čtení/zápisu, příloh, exportu i smíšených cizích klíčů; žádný uživatel Craftbooku nemá přístup k cizím výrobkům.
- Přímý požadavek obcházející UI neobejde povinnou změnu hesla, deaktivaci ani reset relací.
- Neúplné vytvoření Auth účtu lze napravit, bez přístupu k datům před aktivací.
- Souběžné rezervace nepřečerpají sklad; opakované dokončení má jediný účinek.
- První výroba s null množstvím začne bez rezervace a dokončí se po doplnění skutečnosti.
- Cenový příklad 5 g při 30 Kč/g, 4 g výrobek, 0,5 g vratka, 0,5 g odpad → cena 120 Kč a úbytek zásoby 4,5 g.
- Nákup během rezervace nemění její cenu; odběr navíc používá nový průměr.
- Neznámá cena není nula, desetinné výpočty se přesně vyrovnají.
- Změna vzoru nepřepíše snapshot; změna vzoru během zahajovacího formuláře vyvolá konflikt.
- Oprava vypořádání zachová audit i ostatní rezervace.
- Školní výrobek lze dokončit bez ceny i odhadu.
- Výpadek Storage, Auth nebo DB nevytvoří falešně úspěšný výsledek.
- Ověření mobilního zápisu, uploadu a reálného spuštění na Eco v dostupné paměti.
- Bezpečná obnova ze zálohy před přidáním širší skupiny spolužáků.

- Checklist ukládá stav po obnovení stránky, 2/4 dává 50 %, bez kroků nedělí nulou; 100 % nemění sklad.
- Samostatný výrobek se dokončí i bez kroků. Předvyplněný nový vzor lze přeskočit, upravit a idempotentně uložit; školní neznámá množství zůstávají null.
- WYSIWYG uloží a znovu načte podporované formátování a vložené obrázky, bez zobrazení zdrojového kódu.

## 15. Budoucí rozšíření
V1: EquipmentItem, SupplyItem, vlastní Category a Tag, nabídka souhrnu dokončení a ruční aktualizace vzoru. ProcedureVersion s omezením N až po rozhodnutí o rozsahu; snapshot výrobku se na zachování verzí nespoléhá.
V2: Collection a ProductCollection, oblíbené fotografie, ShoppingListItem; ProcedureSizeVariant s výslovnými množstvími. Velikost se kopíruje do zahájeného výrobku.
V3: AI s vlastní autorizací přístupu ke zdrojům, bez automatického zápisu do skladu. Žádná AI infrastruktura předem.

## 16. Co potvrdit
- Heroku Eco + druhý Supabase Free projekt; žádná další služba.
- Uzavřená registrace, provozovatelem vytvořené účty mimo aplikaci, dočasné heslo a osobní reset.
- Navržená bezpečnostní hranice, objektový model a transakční zpracování.
- Upřesnění váženého průměru volného fondu, zachování hodnoty rezervací, způsob rozdělení ceny a neoceněných zásob.
- Limity souborů a ruční zálohování během pilotu.

Po schválení následuje implementační plán a prompt pro první část. Tento dokument neprovádí změny ve stávajících cloudových účtech.

## 17. Oficiální podklady
Ověřeno 16. 11. 2026; ceny a limity je nutné před nasazením znovu zkontrolovat.
- Heroku Eco: https://devcenter.heroku.com/articles/eco-dyno-hours
- Heroku konfigurace: https://devcenter.heroku.com/articles/config-vars
- Supabase limity: https://supabase.com/pricing
- Vytvoření účtu: https://supabase.com/docs/reference/javascript/auth-admin-createuser
- Přihlášení: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Správa hesla: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- PostgreSQL připojení: https://supabase.com/docs/guides/database/connecting-to-postgres
- Drizzle transakce: https://orm.drizzle.team/docs/transactions
- Zálohy: https://supabase.com/docs/guides/platform/backups


Revize 0.2: textové kroky, checklist/progress, WYSIWYG, správa mimo aplikaci a nový postup ze samostatného výrobku v MVP.
