# Provozní záloha a izolovaná obnova

Toto je privilegovaná lokální operace mimo Craftbook. Uživatelský export není
záloha. Nástroje etapy 9 neobnovují běžný projekt ani vzdálený/cloudový cíl.
Nepoužívají supabase link, nové služby ani SMTP.

## Co záloha obsahuje

- `app.dump`: pg_dump 17, custom format, celé schéma app včetně dat všech
  vlastníků, historie, funkcí, FK, sekvencí, grantů a RLS.
- `runtime-role.sql`: požadované omezené atributy craftbook_runtime. Heslo role
  není součástí zálohy; cíl dostane nové náhodné heslo. Role Supabase pocházejí
  z čisté lokální instalace. Dump nepřenáší globální role serveru.
- Verzované SQL migrace a config.toml: schválená Auth konfigurace bez SMTP,
  Data API jen public, soukromý Storage a názvy/parametry prostředí bez tajemství.
- Skutečné bajty všech objektů craftbook-private přes podporované Storage API,
  včetně nepřipojených objektů. Kopie samotné storage.objects nestačí.
- Manifest verze 1: časové okno, verze Node/CLI/PG/aplikace, počty všech tabulek,
  verze schématu podle poslední migrace, soubory, původní objektové klíče, MIME,
  velikosti, SHA-256 a Auth UUID/e-maily.
  Manifest je také soukromý, nepatří do veřejného úložiště.

Nevytváříme dump interních Auth tabulek, hesel, hashů hesel, sessions nebo
refresh tokenů. Identity obnovujeme Admin createUser s původním UUID, ověřeným
instalovanou verzí auth-js a testem. Nové neznámé náhodné heslo se neukládá.
Každý původně aktivní účet je pending_password s novým sessions_valid_after,
bez platného dočasného přístupu, dokud provozovatel neprovede řízený reset
podle etapy 3. Inactive/disabled zůstávají blokované, Auth ban se zachovává.
Bezpečnost nestojí jen na zákazu přihlášení: aplikace odmítá staré sessions UUID.

Dokumentace ověřená před implementací:
[pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html),
[pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html),
[Supabase zálohy](https://supabase.com/docs/guides/platform/backups),
[Supabase migrace a Storage API](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Konzistentní okno a ruční záloha

Před migrací a alespoň týdně při aktivním používání:

1. Zastavte všechny webové procesy, ops změny účtů a files:cleanup. Zajistěte,
   že nikdo nemění Auth ani Storage z Dashboardu/API. Počkejte na dokončení
   uploadů. Pokud jsou pending/deleting záznamy, nejprve je vědomě dořešte
   standardním ověřením/úklidem. Nic nemažte jen pro vynucení úspěchu zálohy.
2. Na lokálním zařízení s Dockerem a běžícím lokálním Supabase použijte
   oddělené ignorované .env.local / .env.ops.local podle stávajícího návodu.
   Vytvořte zálohu **mimo repozitář**, do nového neexistujícího adresáře:

   ```sh
   npm run ops:backup -- --output /absolutni/chranena/cesta/novy-backup --maintenance-confirmed
   npm run ops:backup:verify -- --backup /absolutni/chranena/cesta/novy-backup
   ```

3. Teprve po úspěchu a ověření manifestu obnovte zápisy. Záloha drží SHARE zámky
   všech app tabulek přes dump i kopii Storage; blokuje DB mutace/úklid.
   Odmítne aktivní export nebo nehotový upload, ověří všechny ready Asset bajty
   a znovu kontroluje seznam i kontrolní součty Storage. Přepínač potvrzuje
   skutečné okno bez zápisů, není to náhrada jeho zajištění. Samostatné externí
   Storage/Auth změny DB zámky nezablokují; bez klidového okna zálohu nepoužívat.
4. Zachovejte předchozí dobrou zálohu. INCOMPLETE nebo chybějící manifest
   znamená neúspěch; adresář se nepřepisuje. Po nápravě použijte nový výstup.

Adresáře se zakládají 0700, soubory 0600. Ukládejte je na chráněné/šifrované
zařízení a oddělte od Git, sdílených složek a veřejných logů. Není slíbená
automatická cloudová záloha. Zálohy důvěryhodného provozovatele mohou obsahovat
SQL funkce: neobnovujte neznámý dump. SHA-256 detekuje poškození, není podpis.
Lokální nástroj má limit dumpu 128 MiB a Storage 256 MiB / 10 000 objektů;
překročení končí neúspěchem, nikoli oříznutím. Záloha neprohlašuje přenositelnost
libovolné budoucí verze Supabase; změna verze vyžaduje nový restore test.

## Bezpečná obnova

Vyžaduje Docker, npm ci a původní kompatibilní verze. Seznam a SHA-256
migrací musí odpovídat checkoutu; při obnově staršího schématu nejprve
použijte odpovídající důvěryhodnou revizi repozitáře. Porty 56321/56322 musí
být volné. Příkaz ověří zálohu a vytvoří nový izolovaný projekt:

```sh
npm run ops:restore -- --backup /absolutni/chranena/cesta/novy-backup
```

Cíl má nový project ID `craftbook-r-target-XXXXXXXX`, vlastní Docker volumes,
porty 56321/56322 a adresář `/private/tmp/craftbook-recovery-UUID/target`.
Ochrana ověřuje marker, skutečnou cestu, konfiguraci, Docker project/workdir
štítky i loopback URL. Zdroj 54321/54322 a testovací source 55321/55322 jsou
jako cíl odmítnuté. Schéma app, Auth identity a Storage musejí být prázdné.
Není použito --clean, reset, DELETE spravovaných tabulek ani automatický import
uživatelského ZIP. Obnoví se RLS/granty, soukromý bucket a restriktivní zákaz
přímých anon/JWT operací. Objekty se vkládají podporovaným Storage upload API.

`restore-state.json` je running / failed / complete-access-blocked. Nástroj
nikdy neoznámí úspěch při chybě souboru, počtů, Auth nebo pg_restore. Kontrolní
součty se ověřují před zápisem i po skutečném nahrání. Cílová `.env.runtime`
(0600) obsahuje nové runtime přístupy; není to součást veřejného manifestu
ani soubor k commitnutí. Běžnou .env.local tím nenahrazujte.

Před použitím webu obnovte přístup jednotlivě, osobním předáním dočasného
hesla. Existující ops nástroj přijímá výslovný označený cíl:

```sh
npm run ops:reset -- --recovery-workdir /private/tmp/craftbook-recovery-UUID/target
```

Ověřte UUID, důvod a požadovaný účet. Heslo zadávejte pouze do skrytého
interaktivního vstupu. Neobnovujte deaktivované účty automaticky. Následuje
běžné přihlášení a vynucená změna hesla; staré heslo/tokeny nejsou obnovené.
Stejným cílovým přepínačem lze ops:status/resume řešit přerušený reset.

Pro samostatný web použijte chráněnou cílovou konfiguraci v novém procesu,
nikoli přepsání běžného lokálního souboru:

```sh
node --env-file=/private/tmp/craftbook-recovery-UUID/target/.env.runtime node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3104
```

### Opakování chyby a úklid

Selhaný nebo již naplněný cíl se nepřepisuje. Uchovejte ho pro diagnózu,
zkontrolujte restore-state a opravte příčinu ve zdroji/nové záloze. Po zastavení
jeho webu zastavte **jen tento označený projekt** podle přesného workdir:

```sh
./node_modules/.bin/supabase stop --workdir /private/tmp/craftbook-recovery-UUID/target --no-backup
```

Nikdy nepoužívejte běžný projekt, `db reset`, globální docker prune nebo
neověřený workdir. Poté spusťte ops:restore znovu; vznikne nový marker/project ID
v novém adresáři. Záloha a zdroj zůstávají beze změny. Dočasné lokální adresáře
nejsou dlouhodobé úložiště; dobrou zálohu uchovávejte samostatně chráněně.

## Skutečný test

```sh
npm run build
npm run test:recovery
```

Test vytváří vlastní source 55321/55322 i target 56321/56322; běžného projektu
se nedotýká. Vytvoří tři syntetické identity (A, B, inactive), poznámku s obrázkem,
PDF, postup, školní done bez ceny a own nákup/fakturu/rezervaci/dokončení/odpad/
opravu. Zálohuje, obnoví, ověří všechny počty a bajty, provede ops reset a změnu
hesla skutečným Auth, odmítne staré relace a cizí data, rekonstruuje ledger a
provede nový nákup bez kolize sekvence. Produkční Next a Chrome ověří obnovenou
poznámku/soubory/snapshot na 1440 a 375 px. Poškozená, chybějící a INCOMPLETE
záloha jsou odmítnuté; naplněný a neoznačený/běžný cíl se nepřepisují.
Test zastaví jen své projekty. Výsledky a verze jsou v progress a akceptační mapě.
