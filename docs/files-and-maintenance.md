# Dokumenty, soukromé soubory a údržba

## Lokální příprava

Použijte Node 24 a běžící Docker. Konfiguraci účtů z etap 2–3 zachovejte.

```sh
npm ci
npm run local:stop
npm run local:start
npm run db:migrate
npm run local:storage
npm run dev
```

Stop/start při přechodu z etapy 3 zapne nově přidaný Storage kontejner a zachová volumes i data. Při prvním založení prostředí spusťte před `local:storage` také `npm run local:env`. Pro běžné další spuštění není nutné stack zastavovat. Nepoužívejte db reset, mazání volumes ani supabase link.

Migrace `20261117000100_documents.sql` přidává Document, Asset, AssetLink, indexy, složené vlastnické FK, RLS a kontrolu hlavní přílohy. `20261117000200_document_shape.sql` zpřesňuje SQL kontrolu JSON kořene. Pouze AssetLink(role=main) je autoritou hlavní přílohy; file dokument musí mít právě jednu, note žádnou. Aplikační tabulky nejsou vystavené v Data API.

`local:storage` idempotentně připraví soukromý bucket `craftbook-private`, limit 10 MiB, whitelist MIME a restriktivní Storage politiku odmítající anon/authenticated přístup do tohoto bucketu. Z lokálního provozního klíče doplní serverové `STORAGE_SECRET_KEY` do ignorovaného `.env.local`, pokud tam není. Hodnoty nevypisuje. Příkaz před připojením odmítne vzdálené prostředí. Skript obsahuje reprodukovatelné DDL politiky, které závisí na existujícím Storage schématu služby; doménové SQL migrace se tím nenahrazují.

Privilegovaný klient je uzavřený v serverovém Storage adaptéru. Data dokumentů používají omezenou roli craftbook_runtime, současný ověřený účet, relaci a transakčně lokální kontext. Samotný veřejný klíč nebo uživatelský JWT nestačí ani pro přístup do vlastního bucket prefixu.

## Limity a formát

| Konfigurace | Výchozí hodnota / hranice |
| --- | --- |
| FILE_IMAGE_BYTES | 5 MiB, lze snížit; horní mez 5 MiB |
| FILE_DOCUMENT_BYTES | 10 MiB, lze snížit; horní mez 10 MiB |
| NOTE_CONTENT_BYTES | 256 KiB JSON, lze snížit; horní mez 256 KiB |
| FILE_DOWNLOAD_TTL | 60 s, rozsah 1–300 s |
| FILE_GRACE_HOURS | 24 h, rozsah 24–720 h |

Vstupní fotografie: nejvýše 20 MiB / 40 megapixelů. Prohlížeč respektuje orientaci, zmenší delší stranu na nejvýše 2000 px a vytvoří WebP s kvalitou 0,86. Server ověří skutečný výsledek včetně dekódování, limitu pixelů a typu. Podporované obrázky JPEG/PNG/WebP; HEIC je potřeba předem exportovat do JPEG. Originál fotografie se neukládá, jen optimalizovaná kopie. Animované obrázky se nepodporují.

Přílohy PDF, DOCX a UTF-8 MD se ukládají beze změny. Validace kontroluje deklaraci a skutečný obsah: PDF hlavičku/konec; DOCX omezený ZIP s XML a povinnými OOXML částmi; MD striktní UTF-8 bez binárních řídicích znaků. ZIP má nejvýše 512 položek, 20 MiB celkem po rozbalení, 5 MiB na položku a 1 MiB na XML. Čtení Storage má 15 s timeout; validace obrázku a ZIP 5 s. SVG/HTML a makra v DOCX se nepodporují. **Nejde o antivirovou kontrolu.** Přílohy se nekonvertují ani nerenderují jako HTML.

Poznámka je pouze `{version:1,doc:<podporovaný Tiptap JSON>}`. Žádné paralelní HTML nebo Markdown. Nejvýše 5000 uzlů a hloubka 12. Podporované bloky: odstavec, nadpis 2/3, seznamy a assetImage; značky bold/italic/link, hardBreak. Odkazy pouze http/https/mailto. Obrázek má `assetId` a krátký alt, nikdy URL/base64/blob. Server validuje vstup i obsah před bezpečným React rendererem a atomicky aktualizuje AssetLink. Clipboard normalizuje schéma editoru; externí obrázky se neimportují.

Ukládání je explicitní, bez localStorage a autosave. row_version brání tichému přepsání ze druhé záložky; při konfliktu se rozepsaný obsah zachová a lze vědomě načíst aktuální verzi. UUID nového dokumentu zůstává stejné při retry; stejné vytvoření vrací původní dokument. Změněný payload pod stejným ID vrací konflikt, nikoli tiché přepsání.

## Upload a čtení

1. Server ověří aktivní účet/relaci, deklaraci a případný cílový dokument. Založí pending Asset s náhodnou cestou `owner/asset/original`.
2. Vydá signed upload pouze pro tuto cestu, vždy upsert=false. Supabase má pro tento token pevné TTL **2 hodiny**, API jej neumožňuje zkrátit. Token je znovupoužitelný, ale nesmí přepsat existující objekt; testováno i s podvrženou upsert hlavičkou.
3. Prohlížeč posílá bajty přímo do Storage. Následuje autorizovaná finalizace: omezené načtení a kontrola bajtů mimo DB transakci, nová autorizace a row lock, checksum a ready. Opakovaná finalizace vrací stejný Asset.
4. Až explicitní uložení dokumentu připojí ready asset; aktuální vlastnictví, dokument a stav se ověří znovu. Pending/deleting se nepřipojí. Souběžné připojení a úklid zamykají stejný řádek.

Přerušená odpověď po úspěšném uploadu/finalizaci se řeší tlačítkem **Opakovat ověření**. Pokud přenos neproběhl, vyberte soubor znovu. Opuštěný pending/ready záznam odstraní údržba po ochranné lhůtě. Bez ready souboru nevznikne hotový file dokument.

Obrázky i stažení mají vlastní autorizovaný `/api/assets/:id/content` endpoint. Ten používá krátkodobý signed Storage odkaz **interně**, načte omezené bajty a doručí ověřený MIME s `Cache-Control: private, no-store`, `nosniff` a sandbox CSP; PDF/DOCX/MD navíc jako attachment. Nový požadavek vždy znovu ověří relaci a získá nový interní odkaz. Důvod: metadata cache u přímého uploadu ovládá klient a hlavičky signed odpovědi se liší mezi verzemi Storage. Soukromé URL nejsou v DB, HTML, logu ani sdílené cache. Tato cesta znamená provoz souborů přes Next při čtení, zatímco upload zůstává přímý.

Již vydaný Storage bearer odkaz může technicky zůstat použitelný do expirace i po deaktivaci; neslibujeme jeho okamžité odvolání. Web prohlížeči download token neposkytuje a pro nový požadavek po deaktivaci odmítne přístup.

## Mazání a náprava

Smazání dokumentu odstraní jeho odkazy; soubor odkazovaný jiným dokumentem stejného vlastníka zůstává. Odebrání obrázku se projeví až uložením poznámky. Fyzický úklid se provádí zvlášť:

```sh
npm run files:cleanup
npm run files:cleanup -- --dry-run
npm run files:cleanup -- --apply
```

Výchozí režim je dry-run. Každý běh posoudí nejvýše 50 nejstarších kandidátů. Používá lokální ops přístup a odmítá vzdálené cíle; není veřejný endpoint, worker ani cron.

Kandidát musí být bez odkazů, po ochranné lhůtě od vytvoření/odpojení a po uložené expiraci upload tokenu s rezervou. Po získání zámku se podmínky a reference zkontrolují znovu. DB označí deleting a commitne; teprve pak se mimo transakci smaže Storage objekt a následně řádek Asset. Selhání ponechá deleting pro další běh. Už neexistující objekt lze smazat opakovaně. V této době se soubor nedá nově připojit.

Objekt se nesmí odstranit před expirací upload oprávnění: jinak by starý token mohl cestu znovu vytvořit. Proto se fyzicky nemažou ani čerstvé ready sirotky. Běžný lifecycle nikdy nezapomene řádek před smazáním Storage; výpadek finalizace proto zůstane dohledatelný. Neprovádějte ruční mazání Asset řádků nebo objektů mimo tento postup.

## Ruční průchod

Přihlásit se aktivním účtem → Dokumenty → Nová poznámka → název a formátovaný text → Vložit obrázek → počkat na ověření → Uložit → reload → odhlášení/přihlášení → ověřit text a obrázek → Nahrát dokument → PDF → Uložit → Stáhnout soubor → Upravit název → Smazat dokument. Vyzkoušet také 375 px, Tab, chybný PDF a konflikt dvou otevřených editací.

Automaticky: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:integration`, `npm run test:e2e`. E2E vyžaduje Chrome a volné porty 3100/3102; druhý port slouží skutečnému restartu Next v testu persistence. Testy vytvářejí vlastní náhodné účty a úklid omezují na jejich UUID. Žádný reset databáze ani cloudové operace.

## Reference od etapy 5

`AssetLink` má právě jeden skutečný cíl: dokument, postup, výrobek, zápis deníku nebo původní kopii plánu výrobku. Složené FK vyžadují stejného vlastníka assetu a cíle. Přílohy celého postupu/plánu nejsou fotografie jednotlivých kroků; produktové fotografie mají role průběh/hotový výrobek, deník používá dosavadní Asset ID v bezpečném obsahu.

První zahájení vytvoří samostatné chráněné snapshotové vazby. Úprava/archivace vzoru, změna pracovního plánu či smazání zápisu je neodstraní. Stávající úklid kontroluje všechny řádky AssetLink bez ohledu na cíl a soubor s libovolnou referencí nesmaže. Runtime nemůže snapshot ani jeho vazby měnit nebo mazat. Ostatní lhůty, upload/finalize/retry a soukromé čtení zůstávají stejné. Prohlížeč neobdrží privilegované klíče ani trvalé veřejné URL.

## Faktury od etapy 6

Purchase má skutečnou vlastnickou FK z AssetLink (role invoice). Připojit lze pouze vlastní ověřený ready soubor. Při přípravě faktury nebo prvním připojení k nákupu se asset trvale označí workshop_only: bez vlastní dílny jej nelze číst ani finalizovat přes obecné endpointy. Příznak nelze runtime snížit; i soubor použitý zároveň jako dokument podléhá přísnějšímu omezení faktury. Ostatní dokumenty zůstávají dostupné. Úklid zachovává všechny reference včetně nákupních; nepřipojené uploady používají dosavadní ochranné lhůty.
