Craftbook — prompt pro Codex, etapa 7
Implementuj etapu 7: rezervace materiálu a ocenění v transakcích v existujícím repozitáři Craftbook. Uživatelka potvrdila dokončení etapy 6. Proveď implementaci i testy. Komunikuj česky.
1. Výchozí stav a hranice etapy
Nejprve přečti AGENTS.md, docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md a docs/ui-guidelines.md. Ověř git status, skutečný skladový model etapy 6, idempotenci, zamykání, decimal aritmetiku a školní cyklus etapy 5.

Navazuj na existující implementaci; neduplikuj autorizační ani skladové služby. Novější schválená rozhodnutí mají přednost. Zachovej data, nesouvisející změny a používané verze závislostí. Nepřegenerovávej projekt.

Cíl:
- mapování materiálových požadavků na vlastní skladové karty,
- atomické zahájení vlastní výroby s neměnnou kopií a rezervacemi,
- změna a uvolnění rezervací,
- uchování původních cenových podkladů,
- viditelná volná a rezervovaná zásoba a příslušná historie.
Dokončení vlastní výroby, skutečná spotřeba, vratky, odpad a opravy vypořádání patří etapě 8.

Dodrž dosavadní plán zpřístupnění: běžná vlastní výroba se v UI otevře až po celém cyklu v etapě 8. V této etapě implementuj a integračně ověř vlastní výrobní služby a příkazy, ale nepovol běžným webovým požadavkům vytvářet rozpracované vlastní výrobky bez možnosti dokončení. Odděl interní služby od veřejného vstupu: dostupnost own kontroluj na hranici webových mutací, autorizaci a pravidla také uvnitř služby. Testy volají skutečné služby s ověřeným kontextem v izolovaném prostředí; nepřidávej veřejný testovací endpoint ani skrytý uživatelský bypass.

V běžném UI zpřístupni skladové přehledy rezervací, které budou později použitelné i s produkčními daty. Nepředstírej aktivní vlastní výrobní akce; potřebné komponenty připrav pro zapojení v etapě 8. Školní cyklus musí fungovat dál.

Pracuj lokálně se Supabase. Bez cloudových migrací, push, nasazení, nových služeb, změn Heroku a resetu uživatelských dat.
2. Model rezervace a invarianty
Před migracemi zaznamenej do docs/decisions.md:
- návaznost Reservation na ProductMaterial a InventoryItem,
- fyzické a účetní složky rezervace,
- cenové části při opakovaném navyšování,
- pořadí uvolňování částí,
- zámky a kontrolu souběhu,
- hranici interního own workflow a jeho pozdějšího zpřístupnění.
Použij existující InventoryBalance, InventoryMovement a Operation. Přidej Reservation a jen nezbytná rozšíření modelu. Není potřeba ProductSettlement ani skutečná spotřeba.

Rezervace přesouvá množství i cenu z volného fondu do rezervovaného. Celková evidovaná zásoba se rezervací nemění. Zobrazení a ledger musí rozlišovat volné a rezervované množství, oceněné/neoceněné části a známou hodnotu obou fondů.

Reservation uchovává původní ocenění, nikoli pouze FK na kartu s aktuálním průměrem. Každé navýšení vytvoří samostatně identifikovatelnou cenovou část. Původní části nepřecenuj.

Vynucuj stejného vlastníka mezi všemi vazbami, příslušnost rezervace ke konkrétnímu výrobku a materiálovému řádku, nezáporné složky a konzistenci souhrnu s aktivními rezervacemi i historií. Bez transakčního kontextu žádný přístup. Runtime role neobchází RLS, nevlastní tabulky a nemění historii.
3. Mapování požadavků
Materiálový požadavek vzoru zůstává nezávislý na skladu. Konkrétní výrobek může mapovat svůj materiálový řádek na vlastní kartu.

Server ověří:
- vlastnictví a aktivitu karty,
- jednotku a kompatibilní typ,
- kov/ryzost a další strukturované parametry, pokud jsou dostupné,
- množství a zvolený režim rezervace.
Pouhá shoda názvu není důkaz kompatibility. Pokud nelze některý rozměr spolehlivě porovnat ze strukturovaných dat, nevymýšlej přesný automatický matcher: zobraz specifikace a vyžaduj výslovné potvrzení volby, ale nepovol změnu jednotky nebo typu. Převody délky na hmotnost nepřidávej.

Zachovej specifikaci požadavku i vybrané karty v potvrzeném plánu. Pozdější přejmenování karty nesmí změnit historické údaje.

Neznámé množství null nebo výslovně vypnuté rezervování znamená zahájení bez rezervace daného řádku. Null není nula. Rezervovaný řádek vyžaduje konkrétní kartu a kladné známé množství. Známé množství může uživatel vědomě nezarezervovat; nesmí to být skrytý fallback při nedostatku.

Při nedostatku vrať konflikt a nic nezměň. Uživatel může následně explicitně potvrdit jiný plán nebo práci bez rezervace. Neprováděj tichou částečnou rezervaci.
4. Atomické zahájení
Rozšiř existující službu zahájení podle source, bez zdvojení školní implementace.

Pro own v jedné transakci:
1. Ověř aktivní účet, vlastní dílnu, vlastnictví, stav planned a očekávanou row_version.
2. Ověř očekávanou revizi vzoru a potvrzený plán; konflikt nesmí přepsat ruční úpravy.
3. Zamkni výrobek a potřebné zůstatky ve stabilním pořadí.
4. Znovu ověř dostupnost a kompatibilitu po získání zámků.
5. Vytvoř neměnný snapshot, pracovní materiály/kroky, rezervace a ledgerové přesuny.
6. Nastav in_progress a čas zahájení, ulož výsledek idempotentní operace.
Selhání kteréhokoli materiálu vrací celý příkaz včetně snapshotu, kroků a stavu. Více řádků čerpajících stejnou kartu posuzuj souhrnně, aby každý zvlášť „neviděl“ tutéž zásobu. Neznámé množství smí zahájení projít bez rezervace.

Snapshot a checkboxy zachovej dle etapy 5. Pro opětovné zahájení již existujícího snapshotu použij schválená pravidla; nikdy nevytvářej druhou kopii nebo nevracej původní rezervace pouhým opakováním starého příkazu.

Vlastní dokončení musí zatím služba odmítat, ne zpracovat jako školní done. Změna source po zahájení není cesta k obejití skladových pravidel.
5. Ocenění a přesná aritmetika
Používej decimal řetězce, přesnou aritmetiku a účetní přesnost z etapy 6. Fyzické ks jsou celé; oceněné/neoceněné účetní podíly mohou být zlomkové i u ks.

Rezervace přebírá aktuální vážené ocenění volného fondu. Nový nákup mění volný fond a jeho průměr, nikoli již rezervované části. Neznámá cena zůstává neznámá.

Kontrolní příklad:
- 10 g za 300 Kč.
- Rezervace 5 g: volných 5 g / 150 Kč, rezervováno 5 g / 150 Kč.
- Nákup 5 g za 200 Kč: volných 10 g / 350 Kč, rezervace stále 5 g / 150 Kč.
- Navýšení rezervace o 2 g: nová část 2 g / 70 Kč; celkem rezervováno 7 g / 220 Kč, volných 8 g / 280 Kč.
- Úplné uvolnění: volných 15 g / 500 Kč, rezervováno 0; neoceňuj všech 7 g posledním průměrem.
Při smíšené zásobě převáděj oceněnou a neoceněnou část poměrně podle etapy 6. Při částečném rozdělení zachovej součty a deterministické zaokrouhlení; poslední část převezme zbytek. Úplným přesunem fondu přenes všechny jeho zbytky.

Zobrazená hodnota rezervace není konečná cena výrobku. U neoceněné části musí být označena jako neúplná. Nákup později nedoceňuje historické rezervace.
6. Změny a uvolnění
Příkaz aktualizace přijímá požadovaný cílový stav rezervací a očekávanou verzi, ne nechráněný slepý increment. Retry stejného příkazu nesmí množství znovu navýšit.

Navýšení čerpá jen dostupný volný fond a vytváří novou cenovou část. Snížení vrací množství i původní hodnotu konkrétní části. Použij pořadí ze specifikace; pokud není stanoveno, uvolňuj nejnovější části jako první a rozhodnutí zdokumentuj. Pro budoucí spotřebu zachovej identitu a pořadí vzniku částí.

Při změně karty převeď starou rezervaci zpět a vytvoř novou atomicky, s novým oceněním podle cílového volného fondu. Selhání cílové rezervace musí vrátit i uvolnění původní. Snapshot se tím nepřepisuje; změna patří do pracovních dat a historie.

Uvolnění není odpis ani skutečná spotřeba. Stav rezervace a historie musejí umožnit audit, ne smazání původních řádků.

Nespotřebovávej ani neuvolňuj rezervaci jiného výrobku. Archivovaná karta nesmí bránit bezpečnému uvolnění existující rezervace, ale nemá umožnit nové čerpání či navýšení bez obnovení.

Nezaváděj nyní obecný návrat vlastní rozpracované výroby do planned jako potvrzení, že nebyl žádný skutečný odběr. Bezpečný návrat s vypořádáním patří etapě 8. Samostatné uvolnění rezervace nesmí vymazat historii nebo změnit stav výrobku.
7. Souběh s existujícím skladem
Rozšiř testy a pravidla etapy 6:
- odpis a záporná inventurní korekce čerpají pouze volnou zásobu,
- inventurní formulář jednoznačně uvádí, zda zadává volné množství; rezervované nepřepisuje,
- příjem mění jen volný fond,
- archivace, změna specifikace a vypnutí dílny nemažou rezervace,
- souhrny oceňují a rekonstruují oba fondy odděleně.
Příkazy zamykají výrobek, rezervace a balance ve zdokumentovaném jednotném pořadí společném se skladem. Ověř lock-order také u přesunu mezi kartami a u dvou výrobků. Použij očekávanou verzi pro změny plánů/rezervací a serverovou kontrolu dostupnosti uvnitř transakce.

Využij Operation z etapy 6: request_key, normalizovaný payload hash, uložený výsledek a unikátnost podle vlastníka. Stejný klíč/jiný obsah je konflikt, včetně souběžných prvních požadavků. Retry transakce má omezený počet pokusů.
8. UI a integrační hranice
Ve skladu ukaž:
- volné, rezervované a celkové evidované množství v jednotce karty,
- známou hodnotu a případnou neoceněnou část,
- rezervace rozdělené podle výrobků s odkazy na jejich detail,
- pohyby rezervace/navýšení/uvolnění s původem a cenovým podkladem.
Pro detail vlastního výrobku připrav znovupoužitelné části:
- potvrzení mapování karet,
- známé požadavky vs řádky bez rezervace,
- přehled aktuálních rezervací a jejich neúplného ocenění,
- formulář cílových množství a akci uvolnění.
Dokud není etapa 8, nezpřístupňuj běžnému uživateli own workflow ani veřejnou mutaci obcházející tento zákaz. Nezakládej demo data v uživatelském účtu. Připravené komponenty lze ověřit v existujícím izolovaném testovacím nástroji projektu; nezaváděj nový katalog komponent jen pro tento účel.

Zachovej české texty, přístupnost, mobil 375 px, chybové a pending stavy. Žádné automatické dokončení při 100 % checkboxů.
9. Povinné testy
Použij skutečný lokální PostgreSQL, Auth a omezenou runtime roli. Testy interních služeb mají vlastní izolované uživatele a data. Mocky nenahrazují souběžné transakce.

Ověř:
1. Číselný příklad rezervace, nákupu, navýšení a úplného uvolnění výše.
2. Částečné uvolnění z více cenových částí vrací přesně původní hodnotu podle stanoveného pořadí.
3. Smíšené ocenění a null cena; rezervace 1 ks ze smíšeného fondu fyzicky celých kusů. Opakovaná malá rozdělení nezanechají nesrovnalosti.
4. Dva výrobky soupeří o poslední zásobu: nemohou ji oba zarezervovat. Neúspěch nezanechá snapshot, krok ani částečný přesun.
5. Dva řádky stejného výrobku pro stejnou kartu nepřečerpají souhrnnou dostupnost.
6. Rezervace souběžně s nákupem, odpisem, inventurou a uvolněním zachová invarianty i účetní hodnoty.
7. Selhání u jedné z více karet a přesunu mezi kartami vrací celou operaci.
8. Idempotence při dvojkliku, ztrátě odpovědi a souběhu; stejný klíč s jiným payloadem je konflikt. Stará verze požadavku se odmítne.
9. Null množství a explicitně vypnutá rezervace umožní zahájení bez rezervace; nedostatek sám tento režim nezapne.
10. A nemůže mapovat kartu B, číst/upravovat cizí rezervaci ani uvolnit rezervaci jiného vlastního výrobku pod jiným řádkem. Ověř FK i přímé požadavky.
11. Bez dílny, s neaktivním účtem, pending_password a zastaralou relací jsou skladové služby nepřístupné.
12. Rekonstrukce obou fondů z ledgeru odpovídá balance i aktivním rezervacím po každé operaci.
13. Archivace nebrání uvolnění; vypnutí/zapnutí dílny zachová data.
14. Změna vzoru neovlivní existující snapshot, rezervaci ani checkboxy.
15. Běžný web stále odmítne own workflow, interní služby ho v izolovaných testech skutečně realizují. Own dokončení je odmítnuté, školní cyklus funguje beze změny.
16. Skladové přehledy rezervací na desktopu a 375 px bez přetečení a úniku dat.
Spusť lint, typecheck, build a relevantní regresní/integrační testy. Nespouštěné kontroly neoznačuj jako úspěšné. Při blokátoru pokračuj nezávisle a konkrétně popiš chybějící ověření.
10. Předání
Aktualizuj README podle potřeby, docs/progress.md, docs/decisions.md a skladovou dokumentaci. Zachovej historii etap. Uveď nové migrace, invarianty, pravidla částečného uvolňování, cenové části, integrační testovací příkazy a co přesně etapa 8 musí otevřít v UI.

Závěrečný český report: co je hotové, výsledky kontrol, omezení a jak ověřit rezervace lokálními testy. Jasně rozliš dostupné skladové přehledy a zatím nepovolený vlastní výrobní cyklus.

Po dokončení etapy 7 se zastav. Neimplementuj dokončení, skutečnou spotřebu, odpad ani opravy vypořádání.