Craftbook — prompt pro Codex, etapa 4
Implementuj etapu 4: dokumenty, WYSIWYG poznámky a soukromé soubory v existujícím repozitáři Craftbook. Podle uživatelky je etapa 3 dokončená. Proveď implementaci i ověření, ne pouze návrh. Komunikuj česky.
1. Výchozí stav a závazná rozhodnutí
Nejprve přečti AGENTS.md a docs/product-spec.md, docs/technical-spec.md, docs/implementation-plan.md, docs/progress.md, docs/decisions.md a docs/ui-guidelines.md. Zkontroluj git status, aktuální kód, migrace a testy z etap 2–3. Nejnovější stav ověř v repozitáři; tento prompt nepředpokládá konkrétní názvy již implementovaných helperů.

Výchozí schválené revize jsou produktová 0.3, technická 0.2 a plán 1.1. Starší kopie dokumentů mohou obsahovat překonané návrhy. Platí následující pozdější rozhodnutí:
- Editor je jednoduchý WYSIWYG, bez zobrazování Markdown zdroje a bez split náhledu.
- Správa účtů je mimo aplikaci. Nevytvářej admin UI ani aplikační admin roli.
- Fotografie patří do obsahu poznámek; samostatná galerie ani oblíbené nejsou součástí této etapy.
- Pracovní postup je samostatný strukturovaný typ pro další etapu. Neimplementuj jej jako obyčejný dokument. Kroky postupů budou textové, bez fotografií.
Zachovej novější schválené změny, existující vzhled, npm a kompatibilní verze závislostí. Nepřegenerovávej aplikaci, neprováděj plošné upgrady ani nesouvisející refactoring. Významné implementační volby zaznamenej do decisions.

Pracuj s lokálním Supabase. Nespouštěj cloudové migrace, supabase link, nasazení, push ani změny Heroku. Nevytvářej placené služby. Neprováděj destruktivní reset existujících lokálních dat.
2. Výsledek této etapy
Uživatel s aktivním účtem, s dílnou i bez dílny, může:
1. Vyhledávat a procházet své dokumenty.
2. Vytvořit, číst, upravit a smazat vlastní textovou poznámku.
3. Vkládat obrázky přímo do poznámky.
4. Nahrát PDF, DOCX nebo MD jako samostatný dokument s názvem.
5. Zobrazit detail nahraného dokumentu, stáhnout soubor, upravit název a dokument smazat.
6. Po odhlášení, opětovném přihlášení a restartu aplikace získat stejná uložená data.
Není potřeba editor DOCX, převod příloh na poznámky, OCR, extrakce textu, historie verzí, sdílení, složky, štítky, AI, galerie ani oblíbené. Nevytvářej výrobky, postupy či skladové tabulky předčasně.
3. Datový model a migrace
Přidej Document, Asset a AssetLink podle aktuální specifikace:
- Document: vlastník, název, druh note/file, obsah poznámky nebo vazba na hlavní soubor, časové údaje a prostředek pro detekci souběžné úpravy.
- Asset: vlastník, unikátní storage key, původní jméno, ověřený typ a velikost, stav pending/ready/deleting, časové údaje a další atributy požadované specifikací.
- AssetLink: skutečné vazby na existující Document a Asset, role a případné pořadí.
Zvol jednu autoritativní reprezentaci vazby hlavní přílohy a zajisti její konzistenci. Nedrž dvě nezávisle měnitelné pravdy. U druhu file vynucuj správnou hlavní přílohu; poznámka musí mít platnou strukturu obsahu.

U AssetLink zatím vytvoř pouze vazby na existující entity. Další cíle přidají další migrace. Nepoužívej neověřované polymorfní entity_type/entity_id ani nezakládej budoucí tabulky jen kvůli FK.

Vazby musí vynucovat stejného vlastníka, ideálně složenými cizími klíči. Zapni RLS, minimální granty a indexy pro seznam a hledání podle vlastníka a názvu. Použij současný transakční kontext a omezenou runtime DB roli. Bez kontextu žádný přístup. Migrační oprávnění nepatří do běžného provozu.
4. WYSIWYG editor a ukládání
Použij udržovanou otevřenou knihovnu kompatibilní s existujícím React/Next.js; pokud už projekt editor vybral, navazuj na něj. Ověř API v oficiální dokumentaci. Nepotřebujeme placený editor ani vlastní implementaci contentEditable od nuly.

Lišta má základní formátování: odstavce/nadpisy, tučné, kurzíva, seznamy, odkaz, obrázek a zpět/vpřed. Rozsah drž jednoduchý.

Zkontroluj zvolený kanonický formát obsahu v technické specifikaci a decisions. Pokud není rozhodnuto, zvol verzovaný validovaný strukturovaný formát editoru a volbu zdokumentuj. Není potřeba udržovat paralelně HTML, Markdown a JSON. Podpora MD souboru jako přílohy nevyžaduje Markdown zdroj v editoru.

Obrázky ukládej jako odkazy na Asset ID, nikdy jako expirovatelné URL, base64 ani blob URL v trvalém obsahu. Server při každém uložení ověří strukturu dokumentu, limity obsahu a vlastnictví i stav všech odkazovaných assetů. Odkazy v obsahu a AssetLink aktualizuj konzistentně v jedné DB transakci.

Pro MVP stačí explicitní Uložit, indikace neuložených změn a upozornění při opuštění editace. Neukládej soukromé poznámky do localStorage. Selhání uložení nesmí vymazat rozepsaný obsah. Nezaváděj autosave, pokud už není schválené a implementované.

Při úpravě ze dvou záložek nesmí dojít k tichému přepsání novějšího obsahu. Vrať srozumitelný konflikt, zachovej lokální rozepsanou verzi a nabídni načtení aktuální verze.

Validuj vstup i výstup rendereru. Nepovol libovolné HTML, skripty, nebezpečné URL protokoly nebo neověřené atributy. Vložený HTML obsah z clipboardu normalizuj na podporovanou strukturu. Externí obrázky automaticky nestahuj ani nepřidávej proxy libovolných URL; obrázky se nahrávají do soukromého Storage.
5. Soukromé Storage a upload
Vytvoř reprodukovatelnou lokální konfiguraci soukromého bucketu. Soubory nikdy nejsou veřejné ani trvale uložené na disku Next.js/Heroku.

Navrhni a zdokumentuj tok:
1. Server ověří aktuální účet, relaci, vstup a případný cílový dokument.
2. Připraví pending Asset a serverem určený unikátní storage key v prostoru vlastníka.
3. Vydá krátkodobé oprávnění pro upload pouze na tento objekt.
4. Prohlížeč nahraje soubor přímo do Storage.
5. Server při finalizaci ověří skutečný objekt, velikost, typ a dostupnou signaturu.
6. Teprve ověřený Asset přejde do ready a může být připojen k uloženému dokumentu.
Klient nesmí určit cizí owner ID, libovolný bucket/key ani sám přepnout stav ready. Název souboru nepoužívej jako důvěryhodnou cestu. Zakaž přepis existujícího ready objektu; případná změna souboru používá nový Asset. Ověř, že opakované použití upload oprávnění neumožní změnit obsah po validaci.

Finalizace musí být opakovatelná a bezpečná po ztrátě odpovědi. U připojení k dokumentu znovu ověř aktuální oprávnění i to, že nebyl mezitím smazán. Nenechávej DB transakci otevřenou během síťového přenosu.

Povol PDF, DOCX a UTF-8 MD jako dokumenty; JPEG, PNG a WebP pro vložené obrázky. Nepodporované formáty včetně HEIC vysvětli uživateli, pokud projekt již nemá ověřenou podporu převodu. Aktivní SVG/HTML nepovoluj.

Limity použij ze specifikace. Pokud nejsou konkrétně rozhodnuté, nastav konfigurovatelný výchozí limit 5 MB pro výsledný obrázek a 10 MB pro dokument. Nastav také konečný limit vstupní fotografie, pixelů a velikosti editorového obsahu. Fotografie před odesláním přiměřeně zmenši a komprimuj se zachováním orientace a čitelnosti. Zobrazení limitů v UI nenahrazuje jejich serverové vynucení.

MIME a přípona od klienta nestačí. Ověř signatury, validitu obrázků a odpovídající strukturu DOCX s omezenými prostředky; MD validuj jako omezený text. Netvrď, že toto představuje antivirovou kontrolu. Paměť i čas validace musejí být omezené.
6. Čtení, stahování a oprávnění
Každé čtení dokumentu, vydání upload/download odkazu, finalizace, editace a mazání musí ověřit aktivní účet, aktuální relaci a vlastnictví pomocí mechanismů z etap 2–3. Povinnou změnu hesla ani deaktivaci nelze obejít přes souborové endpointy.

Privilegovaný Storage klient smí být pouze v úzkém serverovém adaptéru po autorizaci; nepoužívej jej pro obcházení RLS aplikačních tabulek. Přímé požadavky s veřejným klíčem nebo běžným JWT nesmějí obejít aplikační pravidla. Ověř Storage politiky, nejen soukromý příznak bucketu.

Krátkodobé podepsané odkazy neukládej do DB, logů ani sdílené cache. Zvol krátké konfigurovatelné TTL a bezpečné obnovení odkazu při expiraci. Dokumentuj, že již vydaný bearer odkaz může zůstat funkční do své expirace i po deaktivaci účtu; neslibuj okamžité odvolání odkazu. Nový odkaz po deaktivaci nebo zneplatnění relace vydat nelze.

Pro PDF/DOCX/MD stačí bezpečný detail s metadaty a stažením. Inline PDF náhled je volitelný, jen pokud nezkomplikuje zabezpečení. Nahraný MD nikdy nevykonávej jako HTML. DOCX nekonvertuj. Dbej na bezpečné hlavičky při doručování souboru a správné chování privátní cache.
7. Mazání a úklid
DB a Storage netvoří jednu transakci. Implementuj opakovatelný lifecycle pending → ready → deleting a zdokumentuj nápravu selhání:
- Neúspěšný upload se nezobrazí jako hotový dokument.
- Opuštěný upload a ready soubor bez reference lze uklidit až po ochranné lhůtě.
- Odebrání obrázku z editoru smaže při uložení příslušný odkaz, nikoli automaticky soubor používaný jinde.
- Mazání dokumentu nesmí odstranit asset odkazovaný jiným dokumentem stejného vlastníka.
- Asset ve stavu deleting nelze nově připojit. Kontrola referencí, označení stavu a připojování musejí být chráněné před souběhem.
- Selhání smazání objektu je opakovatelné; mazání již neexistujícího objektu musí být bezpečné.
Přidej omezený dávkový údržbový příkaz s dry-run a lokálními ochrannými kontrolami. Není potřeba worker, cron služba ani veřejný údržbový endpoint. Ochranná lhůta musí zohlednit platnost upload tokenů, aby úklid nezanechal nový objekt po opožděném uploadu. Řeš i sirotky po selhání finalizace a opakování úklidu.
8. Rozhraní
Zprovozni existující sekci Dokumenty:
- tlačítka Nová poznámka a Nahrát dokument,
- seznam s názvem, typem a datem změny,
- hledání podle názvu a serverové stránkování se stabilním řazením,
- rozlišení prázdného seznamu, nulového výsledku hledání a chyby,
- detail poznámky, editace a potvrzení smazání,
- detail přílohy, změna názvu, stažení a potvrzení smazání,
- srozumitelné stavy nahrávání, ověřování, úspěchu, opakování a chyby.
Poznámky jsou dostupné i studentovi bez vlastní dílny. Zachovej barvy, sdílené komponenty, české texty, klávesnici a mobilní navigaci. Editor i lišta musejí fungovat na 375 px bez horizontálního přetečení.

Pokud Přehled už obsahuje sekci posledních dokumentů, napoj ji na skutečná vlastní data. Nepředělávej celý dashboard a nevytvářej ukázkové záznamy vydávané za reálné.
9. Povinné testy a akceptace
Použij skutečný lokální PostgreSQL, Auth a Storage. Testy izoluj od uživatelských dat. RLS ověřuj omezenou runtime rolí; mocky mohou doplnit simulaci poruch, ale nenahrazují integraci.

Ověř minimálně:
1. Vytvoření, úpravu, hledání, stránkování a smazání poznámky/přílohy; zachování po novém přihlášení a restartu aplikace.
2. Obrázek v poznámce přežije uložení/reload; obsah obsahuje Asset ID, nikoli dočasnou URL.
3. A nemůže číst, měnit, mazat, finalizovat, připojit ani získat odkaz k dokumentu nebo assetu B, ani podvržením ID či přímým Storage požadavkem.
4. Bez kontextu, s neaktivním účtem, pending_password nebo zneplatněnou relací není přístup. Zachování testů izolace spojení z etapy 2.
5. XSS a nebezpečný odkaz se nespustí při vložení, uložení ani renderování; cizí Asset ID v obsahu server odmítne.
6. Nadlimitní soubor, falešný MIME/přípona, neplatná signatura a nepodporovaný formát jsou odmítnuty i při obejití klientské validace.
7. Přerušený upload, ztracená odpověď a opakovaná finalizace nevytvoří duplicitní dokument ani falešně ready přílohu.
8. Ready objekt nelze přepsat; pending/deleting asset nelze připojit. Test souběhu finalizace/připojení s úklidem.
9. Selhání Storage mazání a jeho opakování; sdílená reference chrání soubor, úklid nemaže čerstvé rozpracované uploady.
10. Konflikt dvou editací nevede k tiché ztrátě obsahu.
11. Expirace podepsaného odkazu a jeho autorizované obnovení; po deaktivaci nevznikne nový.
12. Desktop a mobil 375 px: celý tok poznámky s obrázkem i PDF, chybové stavy, neuložené změny a klávesnice.
Spusť lint, typecheck, build a relevantní regresní a integrační testy. Nezaváděj testy pouze na existenci nadpisu. Neoznačuj nespouštěné testy za úspěšné. Při blokátoru pokračuj na nezávislých částech a přesně popiš, co nebylo ověřeno.
10. Předání
Aktualizuj README, .env.example, docs/progress.md a docs/decisions.md; přidej stručný návod k souborům a údržbě. Uveď:
- migrace a reprodukovatelnou lokální přípravu bucketu/politik,
- konfiguraci limitů a TTL bez tajných hodnot,
- formát obsahu a pravidla odkazů,
- údržbové příkazy a nápravu přerušených operací,
- skutečně spuštěné testy a jejich výsledky,
- jednoduchý ruční scénář: poznámka → obrázek → uložení → nové přihlášení → nahrání PDF → stažení → smazání.
Závěrečný report napiš česky. Netvrď, že byla ověřena antivirová ochrana nebo okamžité odvolání již vydaných odkazů. Uveď případná omezení. Po etapě 4 se zastav; nezačínej pracovní postupy ani výrobky.