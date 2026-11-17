# Technická rozhodnutí

## 16. 11. 2026 — Etapa 1

- Původní složka obsahovala pouze AGENTS.md, bez aplikace a Git metadat. AGENTS.md zachován. Dodané dokumenty zkopírovány beze změn: produkt 0.3, technika 0.2, plán 1.1 a prompt 1.1. Pozdější schválení v promptu má přednost před starým označením „návrh“ uvnitř specifikací.
- Next.js 16.4.6 App Router, React/React DOM 19.3.1, TypeScript 5.9.3 strict, Node 24.x (lokálně 24.16.0), npm a lockfile. Verze frameworku a React ověřené v npm registry. TypeScript 5.9 zachovává kompatibilitu s vybranou konfigurací.
- ESLint 9.39.5 a eslint-config-next 16.4.6. npm označuje řadu ESLint 9 za nepodporovanou; ponechána kvůli deklarované kompatibilitě tranzitivních pluginů import/jsx-a11y/react. ESLint 10 aktuální konfigurace deklarativně nepodporuje. Při další údržbě přejít společně s podporovanými pluginy; nepřepisovat peer dependencies naslepo. Jde pouze o vývojový nástroj.
- Použité oficiální podklady: [instalace Next.js](https://nextjs.org/docs/app/getting-started/installation), [Next CLI: typegen, build, start a PORT](https://nextjs.org/docs/app/api-reference/cli/next), [nativní dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog). Lint samostatně, typecheck generuje routy i na čisté instalaci.
- `src/app` směruje stránky; sdílené UI v `src/components`. `src/server` a `src/modules` mají jen stručně popsané budoucí hranice, žádné spekulativní třídy či tabulky. Drizzle/pg/Supabase přidat podle dalších etap.
- CSS tokeny a systémová písma bez UI knihovny a externích fontů. Drobné inline SVG ikony neobsahují nové logo. Mobilní dialog využívá nativní Escape a modalitu s explicitním cyklem Tab/Shift+Tab pro udržení fokusu; při přechodu na desktop se zavře.
- Etapa 1 zobrazuje Materiály jako výslovný náhled struktury, jak umožňuje prompt. Nenahrazuje autorizaci nebo profil. Vlastní dílna je vizuálně vypnutá, na Přehledu není skladový souhrn.
- Pole přihlášení jsou deaktivovaná, bez formulářového odesílání, klientského stavu či loggeru. Žádná identita, fallback backend ani přepínač přeskočení Auth. Před připojením dat musí etapa 2 zavést skutečnou serverovou autorizaci.
- Pro ověření využit dočasný Playwright mimo projekt a již instalovaný Chrome. Testovací framework se nepřidává do závislostí statického základu.

- `next.config.ts` nastavuje `agentRules: false` podle lokální dokumentace Next 16.4.6, aby `next dev` nepřidával generované instrukce do původního AGENTS.md. Blok vytvořený při ověření odstraněn; vlastní obsah zachován.

## 16. 11. 2026 — Etapa 2: bezpečnostní hranice před implementací

- SQL v `supabase/migrations` je jediný autoritativní migrační řetězec (Supabase CLI, lokálně). Drizzle poskytuje typovaný model a dotazy, nepoužívá druhý migrační ledger ani schema push. Migrace zahrnují role, granty, funkce a RLS.
- Runtime `craftbook_runtime`: LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, bez členství v jiných rolích; max. 5 spojení. Vlastníkem tabulek je migrační role. Runtime pouze čte vlastní UserAccount a čte/upravuje běžná pole vlastního profilu.
- UserAccount SELECT RLS porovnává pouze ověřené ID s transakčním `app.user_id`, nezávisí na profilu ani na vlastní politice. Tím nevzniká rekurze. Běžný přístup vyžaduje profil a aktivní účet bez pending/expirace/povinné změny. Profilové RLS navíc kontrolují aktivní účet a platnou relaci.
- Ověření identity pomocí Supabase getUser a ověřených claims → transakce → `set_config(..., true)` pro user ID a session ID → stav účtu/relace → dotazy. Žádné ID z klientského payloadu není autoritou. Kontext po COMMIT i ROLLBACK zmizí.
- `sessions_valid_after`: relace musí mít původní `auth.sessions.created_at >= sessions_valid_after`. Identita a session_id jsou z ověřeného tokenu; existence relace a vazba user ID se kontrolují v DB. Refresh zachovává session_id i created_at a neobchází zneplatnění. Nové přihlášení vytvoří novou relaci. Zrušená relace bez řádku nemá přístup ani se stále kryptograficky platným JWT.
- Úzká SECURITY DEFINER funkce bez argumentů vrací pouze čas založení vlastní aktuální relace (ne cizí údaje), má `search_path = ''`, plně kvalifikované objekty a EXECUTE pouze runtime. Vlastník se využívá jen uvnitř této funkce pro čtení auth.sessions, nikdy jako běžné aplikační spojení.
- Mutace přes Route Handlers s přesnou kontrolou Origin proti APP_URL, JSON vstupy a serverovou validací. Osobní odpovědi no-store; každá stránka i API ověřuje účet samostatně. Proxy obnovuje cookies, není jedinou autorizační hranicí.
- Lokální fixtures mohou vytvářet aktivní účty pouze na loopback Auth/DB; běžný provisioning konkrétního Auth ID vytváří pending_password + expiraci 48 h. Existující účty ani hesla se nepřepisují. Plný ops lifecycle a změna hesla zůstávají etapě 3.

- Ověřené lokální prostředí: Docker Engine 29.9.3 běží, Supabase CLI 3.2.0 (v3 `migration up` je lokální bez dřívějšího `--local`), PostgreSQL 17. Přidané knihovny: @supabase/ssr 0.12.7, supabase-js 2.119.0, Drizzle 0.45.4, pg 8.23.1, Zod 4.6.7; verze uzamčené lockfile. Next/React/ESLint beze změny.
- Runtime konfigurace a lokální provozní konfigurace jsou v oddělených ignorovaných souborech. Lokální wrapper potlačuje výstup CLI obsahující klíče. Heslo fixture účtu zadává uživatel interaktivně se skrytým vstupem, testy generují hesla jen v paměti.
- Přihlašování používá pevné interní cíle `/` a `/account-blocked`; uživatelské návratové URL se nepřijímá. Logout provede plnou navigaci, která zahodí předchozí paměťovou Router Cache. Cookies HttpOnly, SameSite=Lax, na HTTPS Secure; klient nepotřebuje přímý Supabase klient.
- Testy používají skutečné lokální Auth a DB se samostatnými náhodnými účty. RLS kontroly se provádějí připojením craftbook_runtime, včetně stejného fyzického spojení a rollbacku. Testovací úklid se omezuje na ID vytvořená daným během; žádný reset databáze.
- Oficiální podklady ověřené při realizaci: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [relace a session_id](https://supabase.com/docs/guides/auth/sessions), [CLI konfigurace](https://supabase.com/docs/guides/local-development/cli/config), [Drizzle transakce](https://orm.drizzle.team/docs/transactions) a lokální Next 16.4.6 dokumentace.

## 16. 11. 2026 — Etapa 3: průběh operací před implementací

- Zachováváme Auth SSR, transakčně lokální kontext, RLS a `sessions_valid_after` vůči původnímu času relace. Žádný privilegovaný Auth klíč ve webu.
- AccountProvisionOperation zaznamená UUID, cílové UUID, typ, stav/fázi, idempotency klíč, provozní referenci a bezpečný chybový kód. Žádné heslo, hash hesla, token ani odpověď Auth. Create si předem přidělí Auth UUID (podporované AdminUserAttributes.id), takže lze dohledat výsledek i po výpadku odpovědi; duplicitní e-mail se automaticky nepřebírá.
- Operace na cílovém účtu drží stejný PostgreSQL advisory lock přes všechny Auth/DB kroky. Zápisy fází a blokace jsou samostatně commitované. Zámek spojení se vždy uvolní nebo se spojení zničí; uživatelský kontext je i zde pouze transakčně lokální. Aktuální operation_id v UserAccount brání dokončení zastaralé operace. Nová reset/deaktivace superseduje staré nedokončené operace; deaktivovaný účet reset neodblokuje.
- Založení: evidence → Auth createUser s předem určeným ID, email_confirm=true, bez pozvánky → atomický pending_password účet/profil, povinná změna, 48 h, dílna false. Existující úplný účet/profil provisioning nepřepisuje. Při Auth úspěchu a DB selhání není běžný přístup; opakování stejného klíče dohledá vlastní rezervované ID.
- Povinná změna: úzký password-only průchod pro existující profil, platnou relaci a neexpirovaný pending účet. Po blokaci se změní heslo přes uživatelské Auth API, odhlásí všechny relace a teprve pak úzká DB funkce aktivuje vlastní účet s novou hranicí relací. Nové přihlášení je povinné. Při jakémkoli mezikroku selhání zůstává účet zablokovaný; provozovatel provede explicitní reset (nikoli slepou aktivaci).
- Běžná změna: ověřit současné heslo novým přihlášením v odděleném klientu bez cookies, ověřit shodu Auth ID; po blokaci změnit heslo s čerstvou reautentizací, globální signOut, DB dokončení a nové přihlášení. Nesprávné současné heslo nic nemění.
- Reset: DB inactive + nová hranice relací → Admin updateUserById(password) → přihlášení novým dočasným heslem jen v paměti a podporovaný global signOut → DB pending_password + 48 h a nová hranice. Resume po nejistém Auth výsledku vyžaduje znovuzadání dočasného hesla a je výslovně resetovací operací. Disabled účet zůstane disabled a reset se odmítne.
- Deaktivace: nejprve DB disabled a hranice relací, poté podporovaný Auth ban_duration. Ověřit zneplatnění refresh relací lokálním testem; aplikační kontrola odmítá starý access token nezávisle na Auth. Profil se nemaže. Neúspěšný Auth krok lze opakovat, DB zůstává disabled.
- Runtime nemá přímá práva k provozní evidenci ani zápisu chráněných polí. Má jen úzké SECURITY DEFINER funkce pro vlastní změnu hesla, s prázdným search_path, explicitním vlastníkem/relací a fází. Uživatel přes web nemůže zadat cílové UUID ani operační fázi. Ops zůstává v lokálním CLI s odmítnutím vzdálených cílů.
- Pravidla hesel: minimum 12 znaků podle stávajícího Auth, maximálně 72 UTF-8 bajtů (bez tichého bcrypt zkrácení), shodné potvrzení. Secure password change zůstává zapnuté; stará dočasná Auth relace může vyžadovat nové přihlášení bez SMTP.


### Etapa 3 — ověření a upřesnění implementace

- Deaktivace používá Admin updateUserById s ban_duration a náhodným nezachovávaným heslem. Samotný ban nezaručuje odstranění relací; změna hesla přes Admin API je ruší. Integrační test ověřuje i nulový počet původních auth.sessions. Disabled zůstává aplikačně trvalé, profil se nemaže.
- Secure password change zůstává zapnuté. Pending relace starší než 23 hodin dostane před jakoukoli změnou výzvu k odhlášení a novému přihlášení dočasným heslem; tím se vyhne požadavku na e-mailové opětovné ověření po 24 hodinách. Expirace dočasného přístupu nadále činí 48 hodin.
- Runtime má jen úzké password_access / begin_password_change / advance_password_change funkce. Identitu a úspěch Auth autoritativně ověřuje server; HTTP nepřijímá cílové ID, fázi ani ID operace. Funkce kontrolují vlastníka, původní actor_session_id, stav a operation_id. Tabulka operací má RLS a nemá runtime granty.
- Ověřeno proti instalovanému supabase-js 2.119.0 a oficiálním podkladům: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [signOut](https://supabase.com/docs/reference/javascript/auth-signout), [relace](https://supabase.com/docs/guides/auth/sessions), [implementace Auth modelu](https://github.com/supabase/auth/blob/master/internal/models/user.go). Globální odhlášení neanuluje kryptografickou platnost vydaného JWT; Craftbook proto nadále kontroluje existenci a původní čas relace i stav účtu při každém přístupu.
- Password operace po nejistém výsledku neopakujeme automaticky. Zůstává blokovaná a náprava je explicitní provozní reset. Ops resume zachovává původní idempotency klíč; create dohledá jen předem rezervované UUID, reset výslovně znovu nastavuje heslo. Žádný obecný workflow framework ani cloudový přepínač.

## 17. 11. 2026 — Etapa 4: dokumenty a soubory

- Editor Tiptap 3, otevřený StarterKit omezený na odstavce, nadpisy 2/3, tučné, kurzívu, seznamy, odkazy, undo/redo a vlastní obrazový uzel s assetId. Kanonický formát `{version:1,doc:…}`; server validuje celou povolenou strukturu, počet uzlů, hloubku a bajty. HTML ani URL obrázků se neukládají. Renderer vytváří pouze povolené React elementy.
- Document má optimistic row_version; hlavní příloha je autoritativně AssetLink(role=main), nikoli druhý nezávislý sloupec. Odložený constraint ověří přesně jeden main pro file, žádný pro note. Vazby mají složené FK vlastníka. Připojení zamyká asset, odmítá pending/deleting; úklid používá stejný zámek a znovu kontroluje reference.
- Upload: pending záznam → signed upload bez upsert na náhodný neměnný klíč → omezené stažení/validace na serveru mimo DB transakci → nová autorizovaná transakce, ready. Odpověď finalizace lze opakovat. Souborový dokument vznikne až samostatným idempotentním uložením s klientským UUID, takže výpadek nevytvoří duplicitní dokument. Název souboru nikdy neurčuje cestu.
- Privilegovaný Storage klíč je oddělená serverová konfigurace STORAGE_SECRET_KEY, použitá pouze adaptérem. App DB nadále běží jako craftbook_runtime. Bucket je soukromý, přímé anon/authenticated operace jsou zakázané; prohlížeč používá pouze přesně autorizované podepsané oprávnění.
- Výchozí limity: obrázek 5 MiB, dokument 10 MiB, vstupní fotografie 20 MiB / 40 megapixelů, výsledná delší strana 2000 px, editor 256 KiB / 5000 uzlů / hloubka 12. Obrázky před uploadem orientuje a zmenšuje prohlížeč, server dekóduje a ověřuje výsledné rozměry. PDF signatura, DOCX omezený ZIP/XML, MD platné UTF-8 bez nul; nejde o antivirus.
- Download TTL 60 sekund, bez uložení URL; při expiraci se vyžádá nový autorizovaný odkaz. Již vydaný bearer odkaz může fungovat do expirace po deaktivaci. Úklid má ochrannou lhůtu nejméně 24 hodin (delší než upload token), bounded batch a dry-run; deleting je trvalý a opakovatelný stav. Síťový přenos nedrží DB transakci.

### Etapa 4 — ověřené detaily Storage a doručování

- Signed upload má v instalovaném API pevné TTL 2 hodiny. Upsert=false je podepsaná vlastnost; podvržená hlavička upsert ji nepřepíše (ověřeno proti lokálnímu Storage). Po fyzickém smazání by stále platný token mohl znovu vytvořit objekt: úklid proto respektuje expiraci s rezervou i u ready/deleting, nejen pending.
- Čtení jde přes autorizovaný content endpoint. Signed download používá pouze server interně a při každém požadavku vytvoří nový. Důvodem jsou hlavičky/cache metadat ovládané uploaderem a rozdílné chování signed route mezi verzemi Storage. Endpoint vynucuje ověřený MIME, private/no-store, nosniff, CSP sandbox a attachment pro dokumenty. Upload zůstává přímý z prohlížeče; čtení zatěžuje Next provozem do maximálně 10 MiB na požadavek. Nejde o proxy libovolné URL.
- Instalované nové knihovny: Tiptap 3.34.0, sharp 0.35.5 (již tranzitivně přítomný, nyní přímá závislost), yauzl 3.4.0, fast-xml-parser 5.12.1. Framework/Auth/ORM bez upgradu. npm audit při instalaci: 0 hlášených zranitelností.
- Oficiální podklady: [Tiptap Next.js](https://tiptap.dev/docs/editor/getting-started/install/nextjs), [vlastní uzly](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node), [signed upload](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [uploadToSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl), [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [sharp limity](https://sharp.pixelplumbing.com/api-constructor/), [yauzl](https://github.com/thejoshwolfe/yauzl), [XML validátor](https://github.com/NaturalIntelligence/fast-xml-parser). Lokální integrace ověřuje skutečné chování používaného stacku, nejen předpoklad z dokumentace.

## 17. 11. 2026 — Etapa 5: školní cyklus, model před migrací

- Jediný povolený zdroj je school, včetně účtů s vlastní dílnou. Server i SQL odmítají own. Bez skladových tabulek, rezervací, pohybů a automatického výpočtu ceny.
- Procedure má revision_counter, textové kroky a samostatné materiály (metal/g, stone nebo component/ks). Null znamená neznámé množství. Reference na vzor mají stejného vlastníka; všechny postupy se místo destruktivního mazání archivují. Archivovaný postup nelze nově vybrat, existující vazby zůstávají.
- ProductMaterial rozlišuje planned_quantity, actual_quantity a explicitní actual_confirmed. Nový plán automaticky nepotvrzuje skutečnost. Materiály lze doplnit a skutečnost upravit i později, s kontrolou row_version. Desetinné vstupy jsou řetězce, numeric(18,3), fyzické ks celé. School_cost numeric(20,6) je null nebo přesný nezáporný řetězec; žádné Number finanční výpočty.
- ProductStep je pracovní seznam s explicitním completed boolean. Podle produktu 0.3 lze texty i počet kroků měnit během výroby; done je pouze pro čtení. Struktura a stav pracovních kroků se nemění při návratu do planned ani při novém zahájení. Průběh bez kroků je null/„Bez kroků“.
- První zahájení v jedné transakci zamkne výrobek, zkontroluje verzi a revizi vzoru, uloží ProductProcedureSnapshot(version=1) z potvrzeného pracovního plánu a reference příloh. Snapshot nelze runtime přepsat ani smazat. Pozdější změny vzoru/work steps/materiálů do něj nezasahují. Návrat do planned zachová snapshot, started_at, pracovní historii a checkboxy; opětovné zahájení nevytváří novou kopii.
- Změněný vzor před prvním zahájením vrací konflikt. UI ukáže aktuální vzor a umožní vědomě potvrdit jeho revizi se zachováním vlastního návrhu; bez automatického přepsání. Archivace nemění již uložený plán ani snapshot.
- Zahájení a dokončení mají vlastní poslední request_key + hash payloadu v Product a optimistic row_version. Row lock a unikátní snapshot/product zaručují jediný účinek; opakování stejného klíče a payloadu vrátí výsledek, jiné zadání pod stejným klíčem je konflikt. Žádný obecný workflow framework.
- Ruční původ je trvalý created_without_procedure. Dobrovolný nový vzor vzniká až samostatnou transakcí po done; Product.saved_procedure_id a row lock chrání před dvojím vytvořením. Původní procedure_id ani snapshot se nemění. Předvyplnění: známá explicitně potvrzená skutečná vstupní spotřeba, jinak plán, jinak null; zdroj množství UI vysvětlí. Bez checkboxů, cen, fotografií, deníku a časů.
- AssetLink dostane skutečné složené FK pro Procedure, Product, JournalEntry a ProductProcedureSnapshot a kontrolu právě jednoho cíle. Snapshotové přílohy mají vlastní chráněné vazby viditelné existujícímu úklidu; odebrání přílohy ze vzoru je neodstraní. Úklid nadále zamyká asset a respektuje všechny reference.
- JournalEntry používá stejný validovaný WYSIWYG JSON, renderer a upload jako poznámky. Fotografie výrobku jsou jen jeho vlastní progress/finished vazby, bez globální galerie. Deník/fotografie lze doplňovat po done bez změny dokončení nebo kopie plánu. Mazání výrobku se v této etapě nenabízí.

### Dokončená implementace etapy 5

- Dodatečný skutečný materiál má planned_quantity=null, vlastní ID a explicitně zadanou skutečnost; lze jej přidat i po done. Celkem nejvýše 200 řádků. Opravy a doplnění jsou pod zámkem výrobku s row_version a nemění completed_at.
- Předvyplnění nového vzoru hledá původní množství podle stabilního ID ve snapshotu; i původní null zůstává null, není přepsáno pozdějším pracovním plánem. Známá potvrzená vstupní skutečnost má přednost. U dodatečných řádků bez snapshotu se použije dostupný pracovní plán nebo null.
- Formulář dokončení se otevře explicitním tlačítkem; během jeho vyplňování jsou checkboxy/přechod zpět zablokované, aby obnovení serverové verze nesmazalo rozepsanou spotřebu. Chyby zachovají vstup, konflikty nabízejí vědomé načtení aktuální verze.
- Použité API a knihovny navazují na etapu 4; bez nových závislostí. Migrace je autorita pro RLS, kontrolní podmínky a složené FK; Drizzle modely dokumentují odpovídající sloupce a přesné numeric řetězce.

## 17. 11. 2026 — Etapa 6: skladový model před migrací

- InventoryItem: id/owner_id, name, description, type, unit (metal/g, stone/component/ks), alloy, fineness, form, profile, dimensions, archived_at, row_version, creation_hash. Po prvním pohybu se nemění fyzická specifikace ani typ/jednotka; opravit lze název a popis. Archivace/obnova nemění zásobu.
- InventoryBalance: item_id/owner_id, free_quantity numeric(18,3), free_known_quantity a free_unknown_quantity numeric(30,15), free_known_value numeric(20,6); obdobné reserved_quantity/reserved_known_quantity/reserved_unknown_quantity/reserved_known_value zatím povinně 0. row_version. Vše nezáporné, known+unknown=quantity; known=0 implikuje value=0. Ks fyzicky celé, účetní podíly smějí být zlomkové.
- InventoryMovement: UUID, globální monotónní posting_sequence (mezery po rollbacku jsou přípustné), owner/item/operation/purchase_line, kind, reason, immutable item_snapshot, posted_at, osm samostatných podepsaných delta sloupců výše uvedených složek. Historie je append-only (runtime jen SELECT/INSERT). Stejná transakce zapisuje pohyb i balance; diagnostika sčítá všechny složky a pouze hlásí odchylku. Historický snapshot specifikace je nezávislý na pozdější opravě názvu.
- Přesná aritmetika bude úzký fixed-point modul s BigInt (žádná stávající decimal knihovna není instalována): fyzické množství 3 místa, účetní podíly 15 míst, hodnoty 6 míst, zobrazení CZK 2 místa. Poměrný známý podíl se zaokrouhlí half-up na 15 míst a omezí na dostupné složky; neznámý podíl je přesný zbytek odpisu. Hodnota odpisu = známá hodnota × odebraný známý podíl / dostupný známý podíl, half-up na 6 míst. Poslední odebraná část přebírá celý zbytek hodnoty. Při vyčerpání celé zásoby se převedou všechny složky přesně a nezůstane prach. Převody, validace limitů i zobrazovací zaokrouhlení nepoužívají Number.
- Purchase: datum obchodu, dodavatel, poznámka, row_version, operation_id; PurchaseLine: item_id, position, quantity, total_cost nullable, snapshot. Jedinou autoritou ceny je celková cena řádku. Známá 0 je oceněný příjem, null neoceněný. Duplicity karty na více řádcích jsou povolené. Obchodní datum nemění pořadí zaúčtování.
- Operation: owner_id, scope, request_key, payload_hash, result_json, created_at; unique(owner,scope,key). Transakční advisory lock pro tuto trojici serializuje i první souběžné požadavky; uložený výsledek se vrací pro stejný normalizovaný payload. Odlišný payload je konflikt. Operace a pohyby jsou neměnné. Zámky karet/balancí ve stabilním pořadí UUID; balance vzniká atomicky s kartou, dostupnost se kontroluje až pod zámkem. Bez síťového uploadu v transakci a bez automatických neomezených retry.
- Počáteční stav je samostatný příjem pouze před prvním pohybem. Odpis má kladné množství a důvod. Inventura vyžaduje očekávanou verzi balance a skutečné množství; nulový rozdíl je odmítnut, záporný se oceňuje jako odpis, kladný explicitní hodnotou přírůstku nebo null. Oprava může odkázat na původní Operation stejného vlastníka. Žádné přepsání starších pohybů ani zpětné přecenění.
- Skladové tabulky mají RLS owner + aktivní účet + has_workshop. Služby navíc zamykají profil FOR SHARE po dobu skladové operace: vypnutí dílny se serializuje se skladovou mutací. Žádné rezervace ani vazby na výrobky, own zůstává zakázané.
- AssetLink.purchase_id je skutečný složený FK, role invoice, právě jeden cíl. Asset získává trvalý workshop_only příznak při přípravě faktury nebo prvním připojení k nákupu. RLS assetu vyžaduje dílnu i přes obecné read/finalize/document endpointy. Příznak nelze runtime snížit: sdílená kopie faktury zůstává chráněná i po odebrání vazby. Obecné dokumenty a jejich běžné assety zůstávají bez dílny dostupné; pokud je tentýž soubor použit i jako faktura, platí přísnější pravidlo pro tento soubor. UI to při uploadu vysvětluje. Úklid respektuje všechny reference; žádný nový souborový systém.

- Migrace 20261117000400_inventory.sql aplikována lokálně bez resetu. Přesná aritmetika používá vestavěný BigInt, proto TypeScript target ES2020 (Node 24 beze změny), bez nové závislosti. Runtime historie a operace mají pouze SELECT/INSERT. Výsledek skladového příkazu je předem přidělené UUID operace (u nákupu současně jeho ID), uložené před doménovými zápisy ve stejné transakci.
- Starší regresní test etapy 5 nově ověřuje absenci skladových pohybů svého školního uživatele, nikoli neexistenci skladových tabulek, která byla platná pouze před etapou 6.

## 17. 11. 2026 — Etapa 7: rezervace před migrací

- Reservation je samostatná cenová část (UUID, monotónní sequence), owner_id, product_id, product_material_id, item_id, operation_id, původní quantity/known_quantity/unknown_quantity/known_value, zbývající remaining_* a stav active/released. Fyzické množství numeric(18,3), účetní podíly numeric(30,15), hodnota numeric(20,6). Složené FK vynucují vlastníka i příslušnost materiálu k výrobku. Původní ocenění a identita části jsou neměnné; snižují se pouze zbývající složky. Každé navýšení vytvoří novou část.
- Uvolnění postupuje od nejnovější části (LIFO), budoucí spotřeba může použít zachované pořadí vzniku. Částečný přesun používá stejný BigInt poměr a half-up jako odpis etapy 6, poslední část převede přesné zbytky. Návrat do volného fondu vrací původní ocenění části, nikoli dnešní průměr.
- ProductMaterial má inventory_item_id, reserve_enabled a potvrzenou specifikaci karty. Strukturované požadavky mohou obsahovat alloy/fineness/form/profile/dimensions; jejich neprázdné hodnoty musí přesně odpovídat kartě. Bez strukturovaného rozměru je povinné výslovné potvrzení volby a očekávaná verze karty. Typ/jednotka se kontrolují vždy. Požadavek zůstává nezávislý na kartě; snapshot obsahuje obě specifikace.
- Operation rozšíří scope own_start/reservations. Společný transakční mechanismus ukládá normalizovaný hash a výsledek, i souběžné první požadavky. Zámky: profil SHARE, výrobek UPDATE, idempotentní klíč, jeho rezervace podle sequence, všechny dotčené InventoryItem a Balance v pořadí UUID (karta a její balance jako pár). Sklad nemá zámek výrobku a nečeká na rezervaci: používá stejné pořadí karet/balancí. Nikdy nezamykat cílové karty až po uvolnění staré karty.
- Zahájení own používá stávající startProduct/snapshot cestu; rezervace, pohyby, snapshot a změna stavu jsou jedna transakce. Cílové množství je explicitní, null nebo reserve_enabled=false znamená vědomě bez rezervace. Nedostatek nesmí spustit fallback. Aktualizace vyžaduje úplný seznam materiálových řádků a row_version výrobku. Změna karty nejprve vrátí původní části a čerpá cílový fond uvnitř stejné transakce. Archivace brání navýšení, nikoli uvolnění.
- Vlastní výroba zůstává zakázaná na všech webových mutacích. Interní saveProduct/startProduct a updateReservations jsou server-only služby s ověřeným účtem/dílnou. Žádný testovací endpoint ani skrytý bypass. Own dokončení, skutečná spotřeba a obecný návrat do planned jsou odmítnuté. Obecná úprava zahájeného own plánu se zatím blokuje, aby nemohla odstranit rezervované řádky; cílové rezervace mají vlastní příkaz.
- Ledger rozšíří reserve/release, product_id a reservation_id. Všechny složky převodu jsou zachované, fyzický součet free+reserved se nemění. Diagnostika ověří historii i součet zbývajících cenových částí. Dosavadní příjem/odpis/inventura nadále mění pouze free fond. Bez rezervací nelze own dokončit ani změnit source.

### Ověřená implementace rezervací

- Původní migrace etap 5–6 se nemění. 20261117000500_reservations.sql rozšířila fondy/model; 20261117000600_reservation_integrity.sql přidala přesný FK ledger → owner/item/product/reservation a odloženou kontrolu součtu všech zbývajících částí proti rezervovanému fondu. Runtime nemůže tuto kontrolu obejít přímou změnou balance. Oprávnění UPDATE původních cenových složek Reservation nejsou udělena.
- Při více mapovaných řádcích se pod společnými zámky nejprve provede všechno uvolnění a teprve potom všechno nové čerpání. To umožní výměnu karet uvnitř jednoho výrobku bez závislosti na pořadí řádků. Dostupnost každého dalšího řádku používá již aktualizovaný zamčený fond; souhrn nelze přečerpat.
- Null množství normalizuje reserve_enabled na false, i když klient původně požádal o rezervování. Není to fallback při nedostatku: známý požadavek s nedostatkem vždy selže. Nula s explicitním reserve_enabled=true je neplatná; pro uvolnění se posílá false.
- Interní startProduct vrací a v Operation ukládá ID výrobku; updateReservations ukládá ID operace. Retry stejného start klíče po pozdějším uvolnění neobnoví rezervaci. Každý serverový pokus používá jednu transakci, bez automatického opakování; po přerušení lze bezpečně zopakovat tentýž klíč/payload. Neexistuje neomezená retry smyčka.
- Bezpečné samostatné uvolnění nemění stav in_progress ani snapshot. V této etapě nelze vlastní výrobek vrátit do planned; tím nemůže opětovné zahájení nechtěně vytvořit nové původní části.
- Read-only komponenty InventoryFunds/ReservationSummary jsou připojené ve skladu a detailu own. ReservationTargetsForm přijímá callback a volitelné initialTargets pro budoucí zapojení; nemá vlastní HTTP endpoint a běžně se nemountuje. Web kontroluje school na hranici saveProduct i všech existujících produktových mutací. Interní služby jsou server-only a vyžadují aktivní účet, dílnu, vlastníka a verzi.

## 17. 11. 2026 — Etapa 8: vypořádání před implementací

- Skutečnost je vždy kumulativní od začátku výrobku: taken = in_product + returned + scrap + lost, všech pět množství je explicitně známých. Ks celá a scrap=0. Nulový nepoužitý řádek lze potvrdit bez karty; nenulový odběr vyžaduje ověřenou vlastní kompatibilní kartu. Další materiál dostane vlastní pracovní řádek, snapshot se nemění. Vratka vždy na tutéž kartu/specifikaci.
- ProductSettlement/SettlementLine jsou append-only revize s previous_id, operation_id, reason, recorded_at, mode complete/correct/return a zachovanými cenovými částmi. Aktuálnost určuje Product.current_settlement_id, nikoli přepis příznaku historické revize. Product uchová oddělený známý materiálový náklad, nullable úplný náklad a cost_status. Školní cena se nepoužívá.
- Cena kumulativního původního odběru pochází ze zachovaných částí předchozí revize v pořadí vzniku. Dodatečný odběr čerpá vlastní aktivní rezervace FIFO a potom volný fond. Snížený odběr ponechá původní prefix cenových částí; odstraněný konec se vrátí kompenzací v původních hodnotách. Každá původní i dodatečná část uchová množství, známý/neznámý podíl, hodnotu a specifikaci karty.
- Hodnota celého odběru se poměrně rozdělí v pevném pořadí in_product, returned, scrap, lost. Rozdělení je účetní: 15 míst podíly, 6 místa hodnota, half-up; poslední nenulová kategorie převezme zbytky. Náklad = in_product + lost, neoceněnost jen těchto kategorií určuje complete/incomplete. Scrap může být neoceněný, aniž automaticky zneúplní nulový náklad. Vratka vrací přesné odpovídající podíly a hodnotu.
- Pod společnými zámky se nejprve rozdělí aktivní rezervace na použitou FIFO část a nepoužitý zbytek; nepoužité se uvolní v původním ocenění. Dodatečný hrubý odběr všech řádků musí být dostupný před jakoukoli vratkou nebo kladnou kompenzací spotřeby. Nelze čerpat rezervaci jiného výrobku ani spoléhat na budoucí vratku.
- Oprava nevrací celé původní vypořádání do dnešního průměru. Ledger zaznamená dodatečný hrubý odběr a přesný rozdíl starého a nového čistého efektu (odběr minus vratka), doplněný o právě odebranou dodatečnou část. Stejný odběr používá stejné cenové podklady i po novém nákupu. Záporná kompenzace vratek musí být kryta volným fyzickým množstvím, známými/neznámými podíly i hodnotou; jinak CORRECTION_CONFLICT. Rezervovaný fond jiných výrobků zůstane nedotčený. Stará revize/payload nemůže přepsat novější revizi; opakování stejného úspěšného klíče pouze vrátí výsledek.
- Návrat do planned vyžaduje stejnou explicitní kumulativní skutečnost včetně nul. Zapíše revizi mode=return, vypořádá odběr, uvolní rezervace a zachová snapshot/deník/kroky. Opětovné zahájení používá tentýž snapshot; nové rezervace jsou pro další, dosud neevidovaný odběr. Další dokončení zadává opět celkovou kumulativní skutečnost a zapisuje pouze rozdíl. completed_at vznikne při prvním skutečném dokončení a opravy ho nemění.
- Zámky zůstávají profil SHARE → výrobek UPDATE → Operation klíč → rezervace → všechny karty/balance po UUID. Settlement a cenové podklady čteme až po zamčení výrobku. Vše v jedné transakci, bez sítě a neomezeného retry. Náhled používá tentýž výpočet v rollbackované transakci, bez trvalého účinku; výsledek potvrzení vždy nově ověří aktuální stav.
- Produkt se nemaže: archivace/obnova mění pouze archived_at, zachovává rezervace, cenové podklady i soubory. Archivace není uvolnění ani dokončení. Nové finanční akce vyžadují obnovení výrobku. Původní runtime DELETE zákaz zůstává.

### Upřesnění etapy 8 při integraci

- Cílové množství rezervace může být jiné než odhad plánu i před prvním zahájením (například plán 5 g, rezervace 2 g). Odhad plánu se tím nepřepíše; snapshot navíc uchová explicitní rezervované množství ve vazbě na kartu. Dokončení odebere rozdíl z volného fondu. Neznámý odhad může mít následně explicitně známou rezervaci, pouze pokud uživatel zadá konkrétní kladný cíl a potvrdí kartu.
- Veřejné own mutace otevřeny až po integračním ověření dokončení. Uživatel s dílnou musí při založení výslovně vybrat zdroj; bez dílny zůstává automaticky school a přímý own požadavek je 403. Zdroj existujícího výrobku zůstává neměnný.
- Neměnný výsledek skladového náhledu se uchová ve stock_result vypořádání. Opakovaný starý klíč načítá původní revizi podle Operation, nikoli dnešní aktuální pointer; nevrací novější výsledek pod původním klíčem a nic nepřepisuje. Náhled sám má nový dočasný klíč a kompletní transakci rollbackuje.
- SettlementLine uchovává také vlastní snímek požadavku (specifikace, typ, jednotka), včetně nulových nepoužitých řádků bez karty. Nové omezení předchůdce brání větvení revizí; odložené kontroly porovnávají souhrn nákladu s řádky a pořadí revizí. FK ledgeru zahrnuje vlastníka i výrobek vypořádaného řádku.
- Diagnostika nyní ověřuje i celkový efekt ledgeru daného materiálového řádku vůči čistému efektu aktuálního vypořádání a shodu nákladu Product s aktuální revizí. Sklad varuje u rozpracované vlastní práce, jejíž odhad není kryt již evidovaným odběrem a aktivní rezervací.

- UI potvrzení vypořádání posílá verze všech fondů z posledního náhledu. Změněná zásoba nebo ocenění vrací STOCK_CHANGED, místo tichého přijetí jiné ceny. Aktualizace podkladů zachová rozepsaná množství a doplní nové pracovní řádky; odstraněný rozepsaný řádek může zůstat jako další skutečný materiál. Potvrzení je pak nutné obnovit.
- Síťová/nejistá chyba po potvrzení ponechá původní náhled a klíč k bezpečnému retry. Známý HTTP konflikt náhled zneplatní. Společný klientský API helper nyní zachovává code/status jako ApiError při stejném českém message rozhraní; ostatní formuláře dál používají Error.message.

## 17. 11. 2026 — Etapa 9: export a lokální obnova

- Uživatelský export je verzovaný JSON + CSV + manifest + ZIP32 bez nové
  knihovny. UUID cesty, SHA-256, UTF-8 BOM a ochrana CSV vzorců. Decimal a bigint
  se převádějí na řetězce už v SQL, null zůstává null. Není to import ani ops záloha.
- Úzká SECURITY DEFINER funkce má pevný seznam doménových tabulek a vlastníka
  pouze z ověřeného transakčního kontextu. Neotevírá běžnou skladovou RLS.
  Export zahrne vlastní historii a soubory i bez dílny. Nedává runtime migrační práva.
- Databázový snapshot REPEATABLE READ READ ONLY končí před čtením Storage.
  Chybějící nebo poškozený ready soubor zruší plný archiv. Pending/deleting soubor
  je uveden v manifestu a brání příznaku complete. Žádné dočasné URL v archivu.
- Jeden globální export přes DB lease na 120 s, požadavek včetně přenosu nejvýše
  95 s, SQL nejvýše 8 s. Nejvýše 10 000 řádků / 8 MiB SQL JSON, 16 MiB čitelného
  JSON, 24 MiB JSON+CSV a 32 MiB příloh. Sekvenční čtení, omezené buffery,
  bez disku dyno. Větší soubory lze získat jednotlivě vedle záznamů.
- Ops záloha: pg_dump 17 --schema=app --format=custom; zvlášť pevná definice
  runtime role, migrace, Auth konfigurace a skutečné Storage objekty přes API.
  Nikdy neprovádí COPY do auth.users nebo storage.objects. Ověřené podklady:
  https://www.postgresql.org/docs/17/app-pgdump.html,
  https://www.postgresql.org/docs/17/app-pgrestore.html,
  https://supabase.com/docs/guides/platform/backups,
  https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore.
- Auth obnovujeme podporovaným Admin createUser s původním UUID (podporuje
  instalovaný auth-js AdminUserAttributes i dosavadní ops:create). Hesla, hashe,
  tokeny a relace nekopírujeme. Náhodné nové heslo se neukládá ani nevypisuje.
  Aktivní účty přejdou do pending_password a vyžadují řízený ops reset a změnu
  hesla podle etapy 3; inactive/disabled se zachová. sessions_valid_after se obnoví.
- Zdroj zálohy musí mít potvrzené okno bez zápisů a úklidu včetně Storage/Auth.
  SHARE zámky aplikačních tabulek trvají přes dump i kopii souborů; rozpracované
  uploady/úklid nebo aktivní export zálohu odmítnou. Seznam a bajty Storage se
  kontrolují znovu před dokončením. Nejde o atomický online backup DB+Storage.
- Restore je povolen jen v označeném /private/tmp/craftbook-recovery-UUID/target,
  s odpovídajícím krátkým project ID, Docker štítky a porty 56321/56322. Běžný
  lokální projekt i vzdálené cíle jsou odmítnuté. Existující schéma/identity/soubory
  nebo marker předchozí obnovy se nepřepisují; retry používá nový izolovaný cíl.
- Serverové čtení Auth URL/veřejného klíče je dynamické přes Reflect.get(process.env,…),
  aby produkční build při testu obnovy skutečně používal oddělený lokální Auth,
  nikoli hodnoty vložené při buildu. Samotný alias env byl v Turbopack 16.4.6
  navzdory dokumentaci stále inlinovaný; Reflect.get je ověřený v sestavených
  serverových chunkech a následným přihlášením do obnoveného projektu. Podklad:
  https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser.

## 17. 11. 2026 — Etapa 10: nasazení uzavřeného pilotu

- Cíle jsou výslovně povolený ref vayxezlkyognarkqebbg a API ověřená osobní EU
  Heroku craftbook-app / e1b8d94d-af33-4b0d-b45d-a9f2bb3a8de7. Přesný app name
  nebyl odhadnut z generované domény. Staré aplikace/projekty se nemění.
- Samostatné cloudové ops bez automatického dotenv míchání. parseEnv čte jen
  0600 .env.ops.cloud.local; setup má skrytý vstup. Cloud Admin/migrační hodnoty
  nepatří do Heroku webu. Web potřebuje jen runtime, Storage a veřejné Auth údaje.
- pg přes session pooler :5432, jméno role.ref, malý pool a explicitní TLS
  rejectUnauthorized=true + servername + projektová CA. V URL zakázané SSL/query
  parametry, aby pg nepřepsal TLS objekt. První TLS pokus korektně odmítl
  SELF_SIGNED_CERT_IN_CHAIN; uživatelka doplnila CA z Dashboardu. Kontrola nebyla
  vypnutá. Password builder explicitně percent-encoduje i doslovné %.
- SSL enforcement zapnutý pouze pro tento prázdný projekt; poté ověřeno i
  pooler → PG TLS. Samotné pg_stat_ssl neprokazuje TLS klient → pooler, to
  vynucuje a ověřuje driver. Supabase postgres je NOSUPERUSER/BYPASSRLS;
  runtime zůstává NOSUPERUSER/NOBYPASSRLS, bez vlastnictví/členství.
- Cloud migrace používají původní SQL, transakci pro soubor, advisory lock a
  neveřejnou app.schema_migration s SHA-256. Neznámý stav nebo změněná historie
  se odmítá. První bootstrap byl prázdný v DB/Auth/Storage. Opakování nemění
  existující hesla, účty ani dokončené migrace. Další změny vyžadují čerstvou
  ověřenou zálohu a zastavený web. Žádný db reset nebo automatické migrace startu.
- Runtime role má vlastní generované heslo odlišné od postgres; uložení pouze
  v ignorovaném ops souboru. První osobní účet přes sdílenou ops logiku pending
  na 48 h, dočasné údaje pouze v 0600 .env.pilot-login.local, bez SMTP a admin UI.
- Auth uzavřený, přesný HTTPS origin, bez callback/redirect wildcardu. Storage
  craftbook-private soukromý, přímé anon/JWT operace uzavřené. Data API zůstává
  vypnuté; žádné doménové supabase.from/rpc. Dva INFO advisory nálezy pro ops
  tabulky bez politik jsou záměrný deny; WARN leaked-password protection se
  řeší dokumentací stávající politiky, nikoli zapnutím placené služby.
- Heroku oficiální Node buildpack, Node 24.x, heroku-postbuild bez DB, Procfile
  web přes start.mjs / 0.0.0.0 / PORT. HTTPS redirect staví URL z APP_URL,
  nikdy z Host/X-Forwarded-Host. Config Vars připravené před buildem.
- Nasazovací cesta je oficiální Heroku Sources/Build API s git archive přesného
  čistého HEAD; source_blob.version je SHA, soukromé signed URL se nelogují.
  GitHub obsah se nesmí zaměnit za necommitnutou práci. Automatic Deploys
  uživatelka potvrdila vypnuté; žádné jiné releasy nebo aplikace se nemění.
- Síťový pg_dump má dočasný 0600 pgpass/CA a lokální jednorázový Docker,
  žádná hesla v argv ani nové nástroje/služby v cloudu. Konkrétní transport
  prošel skutečnou izolovanou obnovou DB/Auth/Storage a vykreslením 1440/375.
- Dva syntetické cloudové účty a ponechání jejich testovacího ledgeru byly
  výslovně schválené uživatelkou. Testy nesmějí sahat na osobní první účet,
  mazat pohyby nebo importovat lokální skutečná data; po testu účty deaktivovat.

### Dokončení technického pilotu

- Živý release v5/e41fd0f; další ops/dokumentace nejsou implicitně webový deploy.
- Cloudový backup zachycuje whitelist netajné Auth politiky a exposed schemas
  jako referenci; žádné klíče/hesla/session. Skutečný pilotní dump byl obnoven
  pouze izolovaně. Cloudový cleanup je tenký wrapper stejné doménové logiky.
- Dva schválené syntetické účty jsou deaktivované, ledger zachován. Osobní
  pending účet a jeho heslo se automatickým průchodem nemění.
