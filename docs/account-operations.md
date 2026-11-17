# Provozní správa účtů — etapa 3

Nástroje se spouštějí lokálně v terminálu s Node 24, běžícím lokálním Supabase a konfigurací vytvořenou pomocí `npm run local:env`. Web používá `.env.local`, provozní nástroje oddělený ignorovaný `.env.ops.local`. Před připojením odmítnou vzdálené adresy; v lokálním režimu nepodporují cloudové adresy. Nepřepisujte ochrany pro použití v produkci. V etapě 3 cloud ani Heroku nebyly změněny; cloudový režim etapy 10 je popsán na konci dokumentu.

## Založení a první přihlášení

```sh
npm run local:start
npm run db:migrate
npm run ops:create
npm run dev
```

CLI vyžaduje interaktivní terminál. Zadejte stručnou provozní referenci bez citlivých údajů, nový e-mail, potvrďte zobrazený cíl slovem `PROVÉST` a dvakrát zadejte dočasné heslo skrytým vstupem. Heslo neposílejte argumentem shellu. Pravidla: nejméně 12 znaků a nejvýše 72 bajtů UTF-8; diakritika může zabírat více bajtů. Nástroj vypíše ID operace před změnou a po úspěchu Auth ID. Poznamenejte si tato ID pro případnou nápravu.

Auth identita vznikne potvrzená bez pozvánky nebo e-mailu. Účet má `pending_password`, povinnou změnu, expiraci za 48 hodin a profil s vypnutou vlastní dílnou. Dočasné heslo předejte osobně, ne prostřednictvím provozní reference nebo logu.

Na http://localhost:3000/login se uživatel přihlásí dočasným heslem. Má přístup pouze ke změně hesla a odhlášení. Po úspěšné změně se odhlásí všechna zařízení a uživatel se přihlásí novým heslem. Běžná data se zpřístupní až poté. Relace starší než 23 hodin vyžaduje před změnou nové přihlášení stejným dočasným heslem; účet se tím nezablokuje. Po expiraci 48 hodin musí provozovatel provést reset.

## Existující Auth identita a Dashboard

Aktuální Supabase Dashboard podporuje **Authentication → Users → Add user → Create new user**. Formulář má e-mail, heslo a **Auto Confirm User**; potvrzení zapněte. Nepoužívejte položku Send invitation. Dostupnost byla ověřena v oficiálním zdrojovém kódu [nabídky](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Auth/Users/AddUserDropdown.tsx) a [formuláře](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Auth/Users/CreateUserModal.tsx). Lokální úsporný stack Craftbooku Studio nespouští; plnou alternativou je `ops:create`.

Pro konkrétní již existující **lokální** Auth UUID:

```sh
npm run ops:provision
```

CLI zobrazí ID i e-mail pro kontrolu. Doplní chybějící účet/profil v jedné transakci do omezeného pending stavu. Úplný existující účet ani profil nepřepíše; deaktivovaný účet neaktivuje. Heslo provisioning nemění. `npm run local:provision` je alias stejného příkazu. Neznáte-li heslo, po provisioningu použijte explicitní reset.

Samotná identita v Dashboardu nemá přístup do Craftbooku. Samotný reset hesla v Dashboardu nenahrazuje synchronizaci aplikačního stavu a hranice relací. Samotná etapa 3 neautorizovala použití příkazů proti cloudovému projektu; uvedená cesta v Dashboardu je provozní dokumentace, nikoli provedená cloudová změna.

## Změna, reset a deaktivace

V Nastavení uživatel zadá současné heslo, nové heslo a potvrzení. Server ověří současné heslo samostatným přihlášením; nesprávné heslo účet nezablokuje. Úspěch odhlásí všechna zařízení. Původní access token ani obnovení původní relace už neposkytují přístup.

```sh
npm run ops:reset
npm run ops:deactivate
```

Oba příkazy vyžadují konkrétní Auth ID, provozní referenci a potvrzení cíle. Reset přijme nové dočasné heslo skrytým vstupem. Nejprve zablokuje aplikaci, změní heslo přes Auth Admin API, provede globální odhlášení a nastaví nový pending přístup na 48 hodin. Dočasné heslo předejte osobně; uživatel si ho musí změnit.

Deaktivace nejprve nastaví `disabled`. Pak v Auth zakáže přihlášení na 100 let a současně přepíše heslo náhodnou nezachovávanou hodnotou, čímž podporovaná změna hesla zruší existující relace. Samotný ban by zrušení relací nezaručil. Aplikační `disabled` nemá expiraci. Profil a ostatní data zůstávají. Reset ani provisioning deaktivaci nezruší; reaktivace není součástí těchto příkazů.

## Dohledání a náprava

```sh
npm run ops:status
npm run ops:resume
```

Status zobrazí posledních 20 operací, případně jen pro zadané Auth ID. Evidence obsahuje ID, cílové ID, typ, stav, fázi, provozní referenci a bezpečný kód. Neobsahuje hesla, tokeny ani odpovědi Auth. `running` může po ukončení procesu znamenat přerušenou operaci, nikoli stále běžící proces. Aktivní souběh chrání databázový zámek.

| Stav / situace | Náprava |
| --- | --- |
| `complete` | Nic neopakovat; resume je beze změny. |
| `failed` nebo přerušené `running`, typ create/provision/reset/deactivate | `ops:resume`, původní ID operace, kontrola cíle. |
| Založení uspělo v Auth, ale ne v DB | Resume dohledá předem rezervované Auth UUID; nevytvoří další identitu a nepřepíše její heslo. U create zadejte původní e-mail. |
| Reset má nejistý výsledek Auth | Resume výslovně znovu nastaví zadané dočasné heslo a dokončí blokaci starých relací. |
| Webová změna (`password`) selhala po zahájení | Provozovatel provede nový `ops:reset` pro cílové Auth ID. Resume vlastní změny není dovoleno. |
| `superseded` | Operaci nespouštět znovu. Novější reset či deaktivace ji nahradily. |
| `CONFLICT` | Ověřit cílové ID, stav disabled a souběžnou operaci; neopravovat ručně aktivací účtu. |
| `AUTH_FAILED` | Ověřit běh lokálního Auth, správné ID a případnou kolizi e-mailu; pak resume. |
| `DB_FAILED` / `INTERRUPTED` | Ověřit lokální DB a migrace; podle typu resume nebo explicitní reset. |

Create s existujícím e-mailem nikdy potichu nepřebere jiný účet. Ověřte skutečné Auth ID a použijte provisioning nebo reset výslovně. Při resume create se heslo opět zadává, ale již vytvořené identitě se nemění; pokud původní heslo neznáte, dokončete provisioning a proveďte reset.

Auth a DB nejsou společná transakce. Mezikroky se evidují trvale; po zahájení změny zůstává při selhání přístup zablokovaný. Nové operace používají zámek účtu a aktuální ID operace; staré dokončení nesmí přepsat novější reset/deaktivaci. Hesla se v nápravě obnovují výslovně, nikdy se nečtou ze záznamu operace. Neprovádějte ruční `active` zápis ani reset celé databáze.

## Ověření

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:integration`, `npm run test:e2e`. Integrační testy používají skutečný lokální Auth/PostgreSQL a řízené výpadky mezi kroky. E2E vyžaduje Chrome a volný port 3100. Izolované testovací identity se uklízejí; ručně založené účty zůstávají.

## Cloudový pilot — etapa 10

Výslovné `cloud:account:*` příkazy nyní sdílejí tuto logiku a ověřují pouze
autorizovaný pilot. Používají `.env.ops.cloud.local`; lokální příkazy a jejich
ochrany zůstávají. [Přesný postup](deployment.md#účty-a-údržba).
První účet je připravený s povinnou změnou, nikoli aplikační admin.
