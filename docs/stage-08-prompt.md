Craftbook — prompt pro Codex, etapa 8
Implementuj etapu 8: dokončení vlastní výroby, spotřeba, vratky, odpad a opravy vypořádání v existujícím repozitáři Craftbook. Uživatelka potvrdila dokončení etapy 7. Proveď implementaci a testy; nezůstávej u návrhu. Komunikuj česky.
1. Kontext a rozsah
Nejprve přečti AGENTS.md, docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md a docs/ui-guidelines.md. Ověř git status a skutečné implementace etap 5–7: snapshoty, školní dokončení, rezervační cenové části, ledger, balance, idempotenci a pořadí zámků.

Novější schválená rozhodnutí mají přednost. Navazuj na existující služby, decimal aritmetiku a autorizaci. Zachovej data, nesouvisející změny, npm a kompatibilní závislosti. Žádné přegenerování projektu, plošné upgrady nebo destruktivní reset.

Cíl:
- dokončit vlastní výrobek s rezervací i bez rezervace,
- zaznamenat skutečnost a spočítat materiálový náklad,
- uvolnit přebytečnou rezervaci a vrátit použitelný materiál,
- oddělit vratný odpad a nevratnou ztrátu,
- opravovat vypořádání auditovatelně,
- bezpečně řešit návrat do plánování a omezení mazání,
- zpřístupnit celý vlastní výrobní cyklus v běžném UI.
Školní výrobky dál fungují bez skladu a bez povinné ceny. Jeden výrobek má jediný zdroj school/own; směs zdrojů neimplementuj.

Neimplementuj exporty a provozní zálohy z etapy 9, cloudový pilot, pracovní čas, prodejní cenu/marži, vlastní sklad odpadu, jeho prodej, vybavení ani AI.

Pracuj lokálně se Supabase. Bez cloudových migrací, push, nasazení, nových služeb a změn Heroku.
2. Datový model a rozhodnutí před implementací
Přidej ProductSettlement, SettlementLine a nezbytné vazby/rozšíření dle aktuální specifikace. Vypořádání má revizi, vazbu na předchozí revizi, aktuální platnost, časy, důvod opravy a zachované cenové podklady.

Do docs/decisions.md před kódem konkretizuj:
- přesný význam odběru, materiálu ve výrobku, vratky, odpadu a ztráty,
- přiřazování odběru k cenovým částem rezervací a volnému fondu,
- rozdělení hodnoty mezi výsledné kategorie a zaokrouhlovací zbytky,
- neoceněný podíl a stav úplnosti nákladu,
- kompenzační opravy a ochranu pozdějších operací,
- návrat do planned při nulovém i nenulovém skutečném odběru.
Zachovej oddělení neměnného plánu, pracovních dat, skutečné spotřeby a historie vypořádání. Snapshot původního plánu se nepřepisuje. Historické revize a ledger jsou neměnné; běžná runtime role je nesmí přepsat nebo smazat.

Používej owner-scoped FK, RLS, omezenou runtime roli a současný transakční kontext. Bez aktivní relace, účtu a vlastní dílny nejsou vlastní skladové mutace dostupné. Vypnutí dílny nesmí smazat rozpracovanost, rezervace ani historii; po opětovném zapnutí musí být možné pokračovat.
3. Formulář skutečnosti
Před dokončením ukaž materiály, potvrzený plán, aktuální rezervaci a možnost zadat skutečnost. U každého kovového materiálu platí:

odběr = ve výrobku + použitelná vratka + vratný odpad + nevratná ztráta
- Ve výrobku: materiál, který zůstává součástí šperku.
- Použitelná vratka: materiál vrácený na stejnou kartu a použitelný ve stejné specifikaci.
- Vratný odpad: odstřižky/piliny určené například k přetavení; opouští evidovanou zásobu a není v ceně výrobku.
- Nevratná ztráta: materiál, který nelze získat zpět; vstupuje do nákladu výrobku.
Nepovažuj rozdíl automaticky za ztrátu nebo odpad. Formulář může odběr dopočítávat ze složek, ale server vždy ověří rovnici a vstupy. Nepřijímej dva rozporné součty.

Vratka na stejnou kartu znamená skutečně použitelnou stejnou formu/specifikaci. Zbytky jiné formy automaticky nezvyšují například kartu nového plechu. Převody mezi různými materiálovými kartami nejsou součást této etapy.

U kamenů a součástek jsou fyzické hodnoty celé ks a vratný odpad je 0. Poškozený nepoužitelný kus patří do nevratné ztráty.

Pro own dokončení musí být skutečnost všech použitých řádků známá a mapovaná na správné vlastní karty. Uživatel může výslovně potvrdit plán jako skutečnost nebo označit řádek jako nepoužitý s nulami. Nepoužívej null jako skrytou nulu. Dovol doplnit skutečně použitý materiál, který v plánu nebyl; původní snapshot zůstává stejný. Chybějící ocenění dokončení neblokuje, chybějící skutečné množství ano.

Školní dokončení tímto zpřísněním neomezuj.
4. Vypořádání rezervací a přímého odběru
Rozšiř stávající příkaz dokončení podle source; nebuduj dvě paralelní implementace společných pravidel.

Pro own v jedné transakci:
1. Ověř vlastnictví, aktivní účet, dílnu, in_progress a očekávanou verzi.
2. Zamkni výrobek, příslušné rezervace a zůstatky v pořadí kompatibilním s etapami 6–7.
3. Znovu ověř dostupnost a kompletní skutečnost.
4. Přiřaď skutečný odběr k vlastním rezervacím, případný rozdíl k volnému fondu.
5. Uvolni nevyužité rezervace, proveď vratky a odpisy příslušných kategorií.
6. Ulož vypořádání, cenové podklady, ledger, balance a výslednou cenu/úplnost.
7. Nastav done a completed_at, ulož výsledek idempotentní operace.
Odběr menší než rezervace uvolní přebytek v původním ocenění. Vyšší odběr čerpá pouze rozdíl z aktuálního volného fondu. Výrobek bez rezervace čerpá celý odběr z volného fondu. Rezervace jiných výrobků jsou nedotknutelné.

Odběr přiřazuj rezervovaným cenovým částem v pořadí jejich vzniku dle specifikace. Přebytek/uvolnění respektuje pravidla etapy 7. Přímé navýšení odběru má aktuální ocenění volného fondu. Souhrn více řádků pro stejnou kartu kontroluj společně.

Při nedostatku vrať srozumitelný konflikt a nezapiš žádnou část dokončení. Neumožni skryté přečerpání s argumentem, že se část vzápětí vrátí: pokud specifikace neříká jinak, skutečný hrubý odběr musí být dostupný před vratkou.

Dokončení musí vypořádat všechny aktivní rezervace výrobku, včetně řádku potvrzeného jako nepoužitý. Po done nezůstane aktivní rezervace.
5. Cena a zachování hodnot
Používej přesnou decimal aritmetiku a účetní podíly z etap 6–7. Fyzické ks jsou celé, účetní části ocenění mohou být zlomkové. Autoritativní výpočty nepoužívají JS Number.

Hodnotu skutečného odběru poměrně rozděl mezi materiál ve výrobku, vratku, vratný odpad a ztrátu podle schváleného modelu. Zachovej jednotlivé cenové podklady a neoceněné podíly; zaokrouhlovací zbytek přiřaď deterministicky, aby všechny součty přesně seděly.

Materiálový náklad výrobku = hodnota ve výrobku + hodnota nevratné ztráty.

Použitelná vratka vrací množství i odpovídající původní hodnotu do volného fondu. Vratný odpad má auditní záznam a úbytek zásoby, ale jeho hodnota není v nákladu výrobku. Nezakládej odpadový sklad ani výkupní cenu.

Neznámá cena není nula. Uchovej známou část nákladu, neoceněný podíl a cost_status. Úplnost výsledného nákladu odvoď od kategorií vstupujících do nákladu, nikoli pouze od existence jakéhokoli neoceněného materiálu v celé operaci. Nový nákup nesmí zpětně změnit cenu hotového výrobku.

Povinný příklad:
- počáteční zásoba 10 g za 300 Kč,
- rezervace/odběr 5 g,
- ve výrobku 4 g, vratka 0,5 g, vratný odpad 0,5 g, ztráta 0,
- po dokončení volných 5,5 g v hodnotě 165 Kč, rezervováno 0,
- náklad výrobku 120 Kč; odpadová hodnota 15 Kč není v nákladu.
Další příklad: odběr 5 g za 30 Kč/g; ve výrobku 4 g, vratka 0,3 g, odpad 0,5 g, ztráta 0,2 g → náklad 126 Kč.

Výsledek zobraz jako materiálový náklad, nikoli prodejní cenu. Fotografie, deník ani 100 % kroků nejsou podmínkou dokončení.
6. Oprava hotového vypořádání
Nabídni samostatnou akci Opravit spotřebu s povinným důvodem a očekávanou aktuální revizí. Neměň done obecným přepínačem. completed_at původního dokončení zachovej; oprava má vlastní čas.

Oprava:
- uchová předchozí revizi,
- zapíše nové kompenzační pohyby a novou revizi atomicky,
- mění jen aktuální výsledek daného výrobku,
- zachová původní cenové podklady pro původní množství,
- dodatečné nové množství ocení aktuálně,
- nepřepočítává historické nákupy, jiné výrobky ani novější rezervace.
Nedělej slepé „vrátit vše do dnešního průměru a znovu odebrat“. Uchovej dostatečný původ hodnot pro přesnou kompenzaci. U opravy rozdělení stejného odběru mezi výrobek, odpad, vratku a ztrátu použij původní cenové podklady.

Pokud oprava nemůže bezpečně zachovat nezáporné složky a pozdější rezervace, odmítni ji jako konflikt s konkrétním vysvětlením. Neobcházej problém zápornou zásobou nebo přeceněním jiných záznamů. Rozhodnutí o přípustnosti prováděj pod zámky, ne pouze před formulářem.

Ověř i opravu po nákupu za jinou cenu, po další rezervaci a opakovanou opravu již opravené revize. Stará revize ani starý request nesmí přepsat novější opravu.

Po opravě výrobku neměň dříve vytvořený vzor pracovního postupu. Úprava existujících vzorů podle souhrnu je pozdější funkce.
7. Návrat do planned, mazání a archivace
Implementuj schválený bezpečný návrat z in_progress do planned:
- před návratem zjisti a vypořádej skutečný odběr,
- automaticky uvolni pouze materiál potvrzený jako nepoužitý,
- spotřebu, odpad či ztrátu nemaž,
- zachovej původní snapshot, deník a historii.
Když se nic nepoužilo, explicitní potvrzení nulového odběru umožní uvolnit rezervace a vrátit stav. Pokud už se materiál zpracoval, použij evidované vypořádání; pouhé uvolnění rezervace by nepravdivě vrátilo spotřebovaný materiál.

Pro nenulový odběr před opětovným zahájením konkretizuj v decisions minimální návaznost na aktuální vypořádání: již evidovaná spotřeba se nesmí při dalším dokončení odečíst podruhé. Pokud podklady neurčují přesný datový postup, použij konzistentní revize vypořádání a jednoznačnou definici, zda formulář zadává kumulativní skutečnost. Nezaváděj nové výrobní stavy. Nenechávej tuto část jako nefunkční placeholder.

Výrobek s rezervacemi nebo skladovou historií se nesmí smazat tak, že zmizí ledger či cenové podklady. Pro zachování historie použij archivaci podle specifikace; ta sama o sobě neznamená spotřebu ani uvolnění. U plánovaného výrobku bez historie lze zachovat dosavadní bezpečné smazání. Sdílené přílohy a snapshotové reference chrání pravidla Asset modulu.
8. Zpřístupnění vlastního cyklu v UI
Po implementaci a ověření dokončení otevři own workflow, které etapa 7 držela mimo veřejné mutace:
- uživatel bez dílny automaticky school,
- uživatel s dílnou při zakládání/zahájení výslovně zvolí school nebo own,
- vlastní výrobek lze vytvořit ze vzoru i ručně,
- před zahájením mapování karet, kontrola dostupnosti a dobrovolná rezervace,
- během práce přehled rezervací, změny množství, deník a fotografie,
- při dokončení skutečnost a náhled očekávaného skladového i cenového výsledku,
- done ukazuje náklad/úplnost, vypořádání, historii oprav a hotové fotografie.
Náhled není autoritativní příslib dostupnosti; server vše ověřuje při potvrzení. Při konfliktu zachovej zadání a nabídni aktualizaci výsledku.

Znovu použij checkboxy a průběh z etapy 5. Dokončení je samostatné potvrzení. Školní cena je dál volitelná a ruční; vlastní náklad se nevkládá do pole školní ceny.

Zachovej nabídku uložení nového postupu z ručně založeného výrobku i pro own:
- nabídka až po úspěšném dokončení,
- editovatelný formulář a idempotentní uložení,
- potřebné vstupní množství podle specifikace, nikoli automaticky čistá hmotnost šperku,
- bez přenosu cen, rezervací, fotek a dokončených checkboxů,
- selhání uložení vzoru nesmí vrátit dokončení.
UI česky, jasně odlišuje použitelnou vratku, vratný odpad a nevratnou ztrátu. Zachovej přístupnost, fokus, pending/chybové stavy a 375 px. Nepřidávej účetní interní detaily do běžných formulářů.
9. Transakce a povinné testy
Všechny skladové změny používají stávající Operation/request_key/payload hash a ochranu souběhu. Dokončení, oprava i návrat jsou atomické. Opakování stejného příkazu vrací původní výsledek; jiný payload se stejným klíčem je konflikt. Použij row_version/aktuální revizi a společné pořadí zámků s etapami 6–7.

Testuj skutečný lokální PostgreSQL, Auth a Storage s izolovanými daty a omezenou runtime rolí. Spusť relevantní regrese, lint, typecheck a build.

Povinné scénáře:
1. Oba číselné příklady výše včetně množství, hodnot a nulové zbývající rezervace.
2. Odběr menší než rezervace, přesně rezervace a nad rezervaci; cenové části z různých okamžiků.
3. Dokončení bez rezervace a doplnění původně neznámých množství; nezmapovaný skutečný materiál se odmítne.
4. Neúplné ocenění, skutečná nulová cena a úplně nulový odběr; přesné účetní zbytky a celočíselné fyzické ks.
5. Více řádků stejné karty, více karet a nedostatek u jedné: úplný rollback bez done a bez částečných pohybů.
6. Dvojklik, ztracená odpověď a souběžné dokončení: jediný účinek. Souběh s nákupem, odpisem a rezervací nepřečerpá volný fond.
7. Oprava stejného odběru mezi kategoriemi, zvýšení/snížení odběru, opakovaná oprava a konflikt staré revize.
8. Oprava po nákupu za jinou cenu a po další rezervaci zachová cizí hodnoty; neproveditelná oprava se celá odmítne.
9. Návrat do planned s nulovou i nenulovou skutečností, opětovné zahájení a dokončení bez dvojí spotřeby či druhého snapshotu.
10. Archivace/mazání neodstraní skladovou historii, rezervace ani sdílené soubory.
11. A nemůže vypořádat výrobek B nebo použít cizí kartu/rezervaci; neaktivní účet, stará relace a vypnutá dílna se odmítnou i přímým požadavkem.
12. Po všech operacích rekonstrukce ledgeru odpovídá balance, aktivním rezervacím a aktuálnímu vypořádání. Ostatní výrobky zůstávají beze změny.
13. Školní dokončení bez ceny dál funguje a nevytváří skladové pohyby.
14. Ruční own výrobek po dokončení nabídne nový vzor bez duplicit, s upravitelným potřebným vstupem.
15. Desktop a mobil 375 px: nový own výrobek → rezervace → deník/foto → skutečnost s vratkou a odpadem → dokončení → oprava → nové přihlášení.
Neoznačuj nespouštěné kontroly za úspěšné. Při blokátoru pokračuj v nezávislé práci a uveď konkrétní chybějící ověření. Zpřístupnění own cyklu nepovažuj za hotové bez integračních testů dokončení.
10. Předání
Aktualizuj docs/progress.md, docs/decisions.md, skladovou dokumentaci a README podle potřeby. Zachovej historii etap. Popiš nové migrace, pravidla výpočtu, opravy a návrat do planned, výsledky testů a blokátory.

Závěrečný report česky: co funguje, jak ověřit školní i vlastní cyklus a jak ručně projít příklad 10 g / 300 Kč → odběr 5 g → výrobek 4 g + vratka 0,5 g + odpad 0,5 g → náklad 120 Kč.

Po dokončení etapy 8 se zastav. Export, zálohy, celkové dotažení MVP a nasazení patří dalším etapám.