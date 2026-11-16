# Craftbook

Jedna kniha vládne všem.

Soukromá aplikace pro studenty zlatnictví a vlastní dílnu. **Etapa 1 je pouze lokální prezentační základ bez přihlášení, databáze a ukládání.**

## Spuštění

Node 24.x (ověřeno 24.16.0, také v `.nvmrc`), npm. S nvm nejprve `nvm use`.

```sh
npm ci
npm run dev
```

Otevřete http://localhost:3000. Klíče ani `.env.local` nejsou potřeba. Aplikace nenavazuje cloudová spojení. Přihlašovací pole jsou neaktivní.

## Kontroly a produkční režim

```sh
npm run lint
npm run typecheck
npm run build
npm run start
```

`typecheck` nejdřív generuje typy tras, takže funguje i před prvním buildem. Lint běží samostatně přes ESLint, nikoli uvnitř Next buildu.

`next start` respektuje proměnnou prostředí `PORT`, kterou později poskytne Heroku. Lokálně lze ověřit např. `PORT=3100 npm run start`. PORT se předává prostředím procesu, ne přes `.env`. V této etapě se nic nenasazuje a nevytváří se cloudové prostředky.

## Co vyzkoušet

- Přehled `/`, Dokumenty `/documents`, Pracovní postupy `/procedures`, Výrobky `/products`, Materiály `/materials` a Nastavení `/settings`.
- Podnavigaci Materiálů: Zásoby, Nákupy a Pohyby. Jde pouze o náhled struktury; budoucí sklad bude dostupný jen s vlastní dílnou. Na Přehledu proto není skladový souhrn.
- `/login`: neaktivní prezentační přihlášení, žádné odesílání ani ukládání údajů.
- Na šířce 375 px otevřít menu, procházet Tabem, zavřít Escape a přejít do jiné sekce. Na desktopu zkusit první odkaz „Přeskočit na obsah“.
- `/api/health` vrací pouze `{"status":"ok"}` s `Cache-Control: no-store`. Neověřuje DB ani Auth.
- Neexistující URL zobrazí českou stránku 404.

## Struktura

- `src/app`: App Router stránky, layout, globální vizuální tokeny a health Route Handler.
- `src/components`: společný shell, navigace, ikony a prezentační prvky. Klientský kód jen pro navigaci a mobilní dialog.
- `src/server`: vyhrazená hranice budoucí serverové infrastruktury; zatím popis bez prázdných služeb.
- `src/modules`: místo budoucích doménových modulů, přidávaných podle etap.
- `docs`: původní podklady zkopírované beze změn, pravidla UI, rozhodnutí a průběh.

Používáme Next.js 16.4.6, React 19.3.1, TypeScript strict, Node runtime, obyčejné CSS a systémová písma. Přesné závislosti uchovává `package-lock.json`. Nejsou potřeba externí fonty ani obrázky.

## Omezení a další etapa

Zatím není Auth, odhlášení, správa účtů, databáze, migrace, ukládání nastavení, sklad, editor, upload ani formuláře výrobků. Není zde falešný uživatel, backend nebo autentizační bypass. Prezentační routy jsou veřejně dostupné bez soukromých dat; v etapě 2 musí dostat skutečnou serverovou autorizaci před připojením dat.

`.env.example` popisuje budoucí konfiguraci s prázdnými hodnotami. Privilegovaný klíč nikdy nepoužívat s prefixem `NEXT_PUBLIC`; migrace a runtime mají oddělená oprávnění. Tajemství a provozní zálohy nepatří do Gitu.

Pro etapu 2 připravte dostupný Docker pro lokální Supabase (ověřit `docker version` a `docker info`). Při implementaci etapy 1 nebyl příkaz `docker` dostupný. Alternativní izolované prostředí vyžaduje samostatné rozhodnutí; nepoužívat automaticky existující cloudový projekt. Etapa 2 nebyla zahájena.

Podrobné výsledky kontrol a omezení jsou v [docs/progress.md](docs/progress.md).
