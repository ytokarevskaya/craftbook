# Akceptace MVP — etapa 9

Mapa založena před implementací 17. 11. 2026 s neověřenými scénáři.
Níže se zaznamenávají skutečně spuštěné kontroly; existence souborů ani starý
progress nejsou důkazem. Akceptace se týká lokálního prostředí, nikoli cloudu.

| Scénář ze zadání | Konkrétní implementace | Důkaz v etapě 9 | Stav | Blokátor |
|---|---|---|---|---|
| 1. Přihlášení, povinná změna, reset, deaktivace, staré relace | identity, ops, serverové account guardy | integration identity/accounts; E2E identity/password; recovery reset a ban | ověřeno | — |
| 2. Student: poznámka s obrázkem → postup → školní výrobek → checkboxy, deník, foto → done bez ceny | documents/files/workshop, WYSIWYG a snapshot | integration documents/workshop; E2E documents/workshop na 1440/375 | ověřeno | — |
| 3. Ruční výrobek, null množství, dobrovolný nový postup | workshop service a plan-form | integration workshop/settlements; E2E workshop/settlements, idempotentní nový vzor | ověřeno | — |
| 4. Dílna: nákup s fakturou → rezervace → skutečnost/vratka/odpad → cena → oprava | inventory/reservations/settlements, vazby invoice | integration inventory/reservations/settlements; E2E inventory/settlements 1440/375 | ověřeno | — |
| 5. 10 g / 300 Kč → 5,5 g / 165 Kč, rezervace 0, náklad 120 Kč | settlement-math a transakční ledger | integration settlements: povinné příklady; E2E settlements; recovery před opravou | ověřeno | — |
| 6. Null cena není nula, snapshot se nemění, 100 % kroků není done | přesné decimal služby, neměnný snapshot, explicitní checkboxy | integration workshop/reservations/settlements; E2E vlastní i školní cyklus | ověřeno | — |
| 7. Kritické souběhy, retry a historie | zámky, operation klíče, append-only revize, odložené SQL kontroly | integration reservations/settlements na PG runtime; E2E ztracená odpověď dokončení | ověřeno | — |
| 8. Export přesně vlastních dat včetně historie, archivace a příloh | export_records pevný seznam, owner/session, úzká výjimka dílny | integration export: A/B, archivovaná karta, historie nákupu, soukromé soubory při vypnuté dílně; HTTP ownerId B ignorován, soubor B 404 | ověřeno | — |
| 9. Čeština, decimal/null, CSV vzorce, stejné názvy, expirovaná relace | SQL text encoding, csv/ZIP32, UUID cesty a manifest | integration export 7/7; E2E export: ZIP obsah, cizí UUID, stará relace 403 | ověřeno | — |
| 10. Chybějící soubor, odpojení, souběžné mazání, limity | checksum/bytes při čtení, abort, lease, selhání před HTTP úspěchem | integration export: remove/poškození skutečného objektu, pending, abort, 10 001 řádků, expiry lease; E2E cancel a uvolnění lease | ověřeno | — |
| 11. Skutečná izolovaná obnova | scripts/recovery, Admin Auth + Storage API, PG dump/restore | test:recovery 1/1; další skutečné ops:backup:verify a ops:restore, ověřena cílová .env.runtime | ověřeno | — |
| 12. Mobil, klávesnice, focus, čitelné chyby, prázdné stavy a formuláře | sdílený shell, drawer, formuláře, ExportDownload | E2E 1440/375, password focus, drawer Tab/Escape, dirty/conflict stavy; skutečné stažení tlačítkem a chyba souboru s fokusem | ověřeno | — |
| 13. Restart a soukromá cache | serverová data, private/no-store, transakčně lokální kontext | E2E restart skutečného Next procesu a načtení souboru; identity A → B a profile cache; export no-store | ověřeno | — |
| 14. Health bez tajemství | veřejné GET /api/health | E2E identity: přesně {status:ok}, no-store | ověřeno | — |
| Navigace, skutečný Přehled, hledání, stavové filtry a stránkování | overview, WorkList, dokumenty a skladové stránky | integration documents/workshop: hledání, stabilní stránky a filtry; E2E propojené průchody, odstraněné zastaralé texty Přehledu a Nastavení | ověřeno | — |

Produktová kritéria product-spec §9 č. 1–12 jsou pokryta řádky 2–7, 12 a jejich
A/B kontrolami. Technická akceptace zahrnuje skutečnou roli craftbook_runtime,
RLS bez kontextu, transakční COMMIT/ROLLBACK, FK stejného vlastníka a Auth/Storage
požadavky obcházející UI. Neověřené body se neodvozují z existence implementace.

## Skutečně spuštěné příkazy a prostředí

- `npm run db:migrate`: lokální migrace 010, bez resetu předchozích dat.
- `npm run lint`, `npm run typecheck`, `npm run build`: prošly.
- `npm run test:integration`: **74/74**, skutečný PostgreSQL/Auth/Storage.
- `npm run test:e2e`: závěrečné opakování **14/14** v Chrome (cca 1,2 min),
  včetně exportních tlačítek, skutečného downloadu a chyby s fokusem.
- `npm run test:recovery`: **1/1**, zdroj i cíl se svými project ID/volumes,
  porty 55321/55322 a 56321/56322, samostatný produkční Next 3104, 1440/375 px.
- Skutečné CLI `npm run ops:backup:verify -- --backup <syntetická-záloha>` a
  `npm run ops:restore -- --backup <syntetická-záloha>` prošly; následné spojení
  z vygenerované cílové .env.runtime je omezená runtime role s RLS. Cíl zastaven.
- Node **24.16.0**, Supabase CLI **3.2.0**, PostgreSQL **17.12**, Next **16.4.6**,
  supabase-js **2.119.0**; npm a knihovny dle package-lock.json.

Recovery fixture má A, B, inactive, tři skutečné soubory, poznámku s obrázkem,
PDF, postup/snapshot, školní done s null cenou, own nákup s fakturou, rezervaci,
vypořádání a opravu. Počty všech app tabulek, validní FK a SHA-256 všech objektů
souhlasí. Přihlášení po řízeném resetu, Auth ban inactive, staré relace, A/B,
RLS, ledger, nový nákup a sekvence i vykreslení obrázku prošly. Corrupt/missing/
INCOMPLETE záloha nezaloží schéma cíle. Naplněný cíl a source jsou odmítnuté.

Lokální etapa 9 je dokončená, bez otevřeného blokátoru. Vizuálně zkontrolována
exportní stránka na 375 px; automaticky ověřen desktop i mobil bez přetečení.
Po ověření běží jen původní craftbook-local, izolované projekty jsou zastavené.

## Hranice a další etapa

- Export není ops záloha ani importní UI; konečné limity a oddělené soubory
  jsou v export.md. Překročení limitu vrací chybu, nikoli prvních N záznamů.
- Záloha vyžaduje skutečné okno bez zápisů včetně Auth a Storage; nemá obecnou
  online atomicitu. Ochrana a retry jsou v backup-and-restore.md.
- **Neověřeno:** cloudový pilot, skutečná Eco dyno/paměť a vzdálená konfigurace.
  Patří do etapy 10, nebyly provedené ani nejsou blokátorem lokální etapy 9.
- Žádný push, nasazení, supabase link, Heroku změny ani reset osobních dat.

## Cloudové ověření etapy 10 — 17. 11. 2026

Výše uvedené hranice cloudového ověření popisují stav na konci etapy 9.
Nyní nasazen v5 / e41fd0f: skutečný HTTPS smoke, vynucená změna hesla, A/B
včetně souborů, školní null cena, sklad 120 Kč / 5,5 g, export, 1440/375,
restart/perzistence, refresh/reset/deaktivace prošly. Maximum pozorované paměti
124,15 MB bez R14/R15; omezená runtime role a obě TLS spojení ověřené.
Skutečná pilotní záloha i izolovaná obnova 25 tabulek / 3 souborů prošly.
Přirozené Eco uspání i jednorázové probuzení prošly: HTTP 200 za 14,4 s,
bez keep-alive; přesné časy v progress.
Čekající osobní kontrola: vlastní první přihlášení/heslo, fyzický telefon
a praktické používání. Žádná V1 ani další účty nejsou součástí tohoto ověření.
