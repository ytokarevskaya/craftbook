# Sklad a rezervace — stav po etapě 8

Autorita produktu: product-spec 0.3, technical-spec 0.2 a zadání etap 6–7. SQL migrace a serverové služby vynucují pravidla; UI je pouze zadává a zobrazuje.

## Fondy a historie

InventoryBalance obsahuje free_quantity/reserved_quantity (numeric 18,3), free_known_quantity/free_unknown_quantity/reserved_known_quantity/reserved_unknown_quantity (numeric 30,15) a free_known_value/reserved_known_value (numeric 20,6). Pro každý fond known + unknown = fyzické quantity; nulové known má nulovou hodnotu. Fyzické ks jsou celé, účetní podíly mohou být zlomkové.

InventoryMovement je append-only a obsahuje samostatné delty všech osmi složek, Operation, případně PurchaseLine, Product a Reservation. Pořadí zaúčtování určuje sequence; obchodní datum nákupu historii nepřepočítává. Příjem, odpis a inventura mění jen volný fond. Reserve/release převádějí opačné delty mezi fondy, množství i všechny účetní složky se přesně zachovají.

## Cenové části

Každé navýšení vytvoří Reservation s neměnnou původní quantity/known_quantity/unknown_quantity/known_value, historickou specifikací karty a samostatnou identitou/pořadím. Remaining složky evidují zbývající rezervaci; released řádky zůstávají v auditu. Nákup starou část nepřecení.

Snížení uvolňuje nejnovější části jako první (LIFO). Vrací se původní poměr a hodnota konkrétní části. Účtování používá BigInt, half-up na 15 míst pro podíl a 6 míst pro hodnotu; neznámá část je přesný zbytek. Úplný přesun přebírá všechny zbývající složky. CZK se až pro zobrazení zaokrouhluje na 2 místa. Známá nula není null cena.

Příklad: 10 g / 300 Kč → rezervovat 5 g / 150 Kč → nakoupit 5 g / 200 Kč → volný fond 10 g / 350 Kč → navýšit o 2 g / 70 Kč → rezervováno 7 g / 220 Kč, volných 8 g / 280 Kč. Uvolnění 3 g vrátí 2 g / 70 Kč z nové části a 1 g / 30 Kč ze staré. Plné uvolnění obnoví volných 15 g / 500 Kč.

## Příkazy, souběh a autorizace

Každý příkaz vyžaduje ověřenou relaci, aktivní účet, dílnu a vlastníka. Operace ukládá normalizovaný hash, request_key a výsledek ve stejné transakci jako změny. Stejný klíč/payload vrátí výsledek bez opakování; jiný payload je konflikt. Každý serverový pokus má jednu transakci; klient může bezpečně zopakovat původní klíč po nejisté odpovědi.

Pořadí zámků: profil SHARE → výrobek UPDATE → idempotentní klíč → části rezervací → karty a jejich balance po UUID. Samostatný sklad nečeká na výrobek ani rezervaci a zamyká karty/balance ve stejném pořadí. Při změně více karet se pod těmito zámky nejprve vrátí všechny snižované části, pak proběhne nové čerpání. Selhání celé transakce vrací i již provedená uvolnění. Dva řádky jedné karty používají postupně aktualizovaný zamčený fond.

Aktualizace přijímá celý požadovaný stav řádků a row_version výrobku. Null znamená bez rezervace, známé množství lze vědomě nerezervovat. Nedostatek žádný režim automaticky nepřepíná. Typ/jednotka a dostupné strukturované požadavky musí odpovídat; volba karty vyžaduje potvrzení a její očekávanou verzi. Snapshot obsahuje požadavek i původní potvrzenou kartu.

RLS, složené FK a omezené granty chrání vlastníka i vazbu materiál–výrobek–část–karta. Odložené triggery kontrolují při commitu rezervovaný fond proti částem. `GET /api/inventory/reconcile` navíc porovnává oba fondy s ledgerem; reportuje odchylky a nic neopravuje.

## Vypořádání od etapy 8

Platí taken = in_product + returned + scrap + lost. Všechny složky jsou explicitní
známé řetězce; null nenahrazuje nulu. Ks jsou celé a scrap=0. Neznámá cena je
přípustná, neznámá skutečná množství dokončení blokují. Nepoužitý řádek má potvrzené nuly.

Odběr používá zachované původní podklady aktuální revize, poté vlastní rezervace FIFO
a zbytek volný fond. Nepoužitý zbytek rezervací se uvolní v původním ocenění.
Dodatečný hrubý odběr všech řádků musí být dostupný před vratkami a kladnou kompenzací
spotřeby. Nepoužité rezervace téhož výrobku lze uvolnit, cizí rezervace se nemění.

Celá hodnota a podíly odběru se poměrně rozdělí v pořadí in_product, returned,
scrap, lost. Poslední nenulová kategorie přebírá zbytky. Materiálový náklad je
in_product + lost. Scrap sníží zásobu bez nákladu výrobku, returned vrací přesné
množství/podíly/hodnotu na tutéž kartu. Cost_status určuje pouze neoceněný podíl
kategorií v nákladu; neoceněný odpad při nulovém nákladu sám nezpůsobí incomplete.

ProductSettlement a SettlementLine jsou append-only. Předchozí revize, cenové části,
rozdělení kategorií, čistý efekt a snímky požadavku/karty zůstávají zachované.
Aktuálnost určuje Product.current_settlement_id. Material_cost je úplný náklad nebo
null, known_material_cost známá část, cost_status complete/incomplete.
School_cost je oddělená školní cena. Completed_at opravy nemění.

## Opravy a návrat do plánování

Skutečnost je kumulativní od začátku výrobku. Oprava vyžaduje aktuální revizi,
row_version, klíč a důvod. Zachovává prefix cenových částí pro původní množství;
nový dodatečný odběr čerpá aktuální fond. Snížené množství vrací původní hodnotu
kompenzací. Pozdější zvýšení již vráceného množství je nový odběr z aktuálního fondu.

Ledger zaznamená nový hrubý odběr a rozdíl starého/nového čistého efektu
(odběr minus vratka), kompenzovaný o právě odebranou dodatečnou část.
Stejný odběr rozdělený jinak mezi kategorie se nepřeceňuje dnešním průměrem.
Záporné množství, účetní podíl nebo hodnota po kompenzaci způsobí CORRECTION_CONFLICT.
Nulový oceněný podíl nesmí zanechat hodnotu. Oprava může být odmítnutá i při dostatku
fyzického množství, pokud chybí původní účetní podklad; nepřecení cizí rezervace.

Return zapíše kumulativní skutečnost a nastaví planned. Nulové potvrzení uvolní
nepoužité rezervace, nenulový odběr zůstane evidovaný. Restart nevytvoří druhý snapshot
ani původní spotřebu. Případné rezervace po restartu jsou pro další odběr.
Další dokončení zadává celkovou skutečnost a mění sklad pouze o rozdíl.

## Náhled, idempotence a integrita

Náhled provádí totožný výpočet v rollbackované transakci. UI při potvrzení posílá
verze fondů z náhledu. Změna zásoby nebo ocenění vyvolá STOCK_CHANGED a vyžádá nový
náhled při zachování zadání. Podklady lze aktualizovat bez ztráty množství.
Nejistou ztracenou odpověď lze opakovat se stejným klíčem a obsahem.

Operation identifikuje neměnný výsledek konkrétní revize včetně stock_result.
Starý úspěšný požadavek nic nepřepíše a nevrací jinou novější revizi.
Nový klíč se starou revizí je konflikt. Zámky navazují na etapy 6–7, Storage síťová
operace nikdy neběží uvnitř finanční transakce.

RLS a FK chrání vlastníka, výrobek, materiál, kartu a vypořádaný řádek.
Runtime nesmí přepsat nebo smazat revize a ledger. Odložené triggery kontrolují
fond rezervací, posloupnost revizí a souhrn nákladu řádků. Diagnostika porovnává:

- balance s ledgerem ve všech složkách;
- rezervace s rezervovaným fondem;
- kumulativní čistý efekt aktuálního vypořádání s historií;
- náklad Product s aktuální revizí.

Diagnostika nic neopravuje. Fyzická a účetní aritmetika dál používá BigInt,
15 míst pro podíly, 6 míst pro hodnoty a half-up; CZK se zobrazuje na dvě místa.

## Rozsah po etapě 8

Web umožňuje vlastní i školní cyklus. Bez dílny je source automaticky school a own
server odmítne. S dílnou se zdroj výslovně vybírá; existující zdroj se nemění.
Archivace nemaže historii, rezervace ani soubory a sama nic neuvolňuje.
Pro finanční akce se výrobek obnoví. Hard DELETE zůstává zakázané.

Nevznikl sklad odpadu, prodejní cena, převod materiálu mezi kartami, účetnictví,
export ani zálohy. Školní cena nadále může zůstat null po dokončení a nevytváří
skladové pohyby. Nasazení není součást etapy 8.
