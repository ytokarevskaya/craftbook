Implementuj etapu 3 projektu Craftbook: provozní správa účtů a změna hesla bez SMTP. Etapa 2 je podle uživatelky dokončená a ručně ověřená. Proveď implementaci i testy, nezůstávej pouze u návrhu. Komunikuj česky.
1. Nejdřív ověř výchozí stav
Přečti:
- AGENTS.md
- docs/product-spec.md
- docs/technical-spec.md
- docs/implementation-plan.md
- docs/progress.md
- docs/decisions.md
- docs/ui-guidelines.md
Zkontroluj git status a skutečnou implementaci autentizace, autorizace, provisioningu, RLS a testů z etapy 2. Zachovej existující práci i používané verze závislostí. Nepřepisuj funkční mechanismy jen proto, abys použil jiný vzor.

Pokud progress neodpovídá kódu, popiš rozdíl a pokračuj v nezávislých částech. Zásadní bezpečnostní rozpor vyřeš před navazující implementací.
2. Cíl a rozsah
Po dokončení této etapy musí být možné:
- provozně vytvořit uživatelský účet bez odesílání e-mailu,
- předat dočasné heslo a vynutit jeho změnu,
- změnit vlastní heslo v Nastavení,
- obnovit zapomenuté heslo prostřednictvím provozovatele,
- deaktivovat účet a zablokovat jeho relace,
- bezpečně napravit částečně dokončené založení nebo reset účtu.
Nevytvářej administrační rozhraní, /admin, aplikační admin roli ani veřejnou registraci. Provozní správa bude probíhat pomocí lokálně spouštěných nástrojů a případně Supabase Dashboardu.

Nepřidávej SMTP, placené služby, dokumenty, sklad ani další produktové moduly. Neprováděj nasazení, push ani změny existujícího cloudového Supabase projektu nebo Heroku. Implementaci a testování prováděj lokálně.
3. Nejprve navrhni bezpečný průběh operací
Prostuduj dosavadní UserAccount, UserProfile, kontrolu relací a lokální provisioning. Stručně popiš a zaznamenej do docs/decisions.md:
- založení účtu,
- první přihlášení a povinnou změnu hesla,
- běžnou změnu hesla,
- provozní reset,
- deaktivaci,
- obnovu částečného selhání.
Supabase Auth a aplikační PostgreSQL nepovažuj za jednu atomickou transakci. Urči pořadí kroků a chování při selhání mezi nimi. Výchozí bezpečné chování je zablokovaný přístup, nikoli automatická aktivace.

Před použitím verzově závislých API ověř oficiální dokumentaci odpovídající instalovaným verzím. Zvlášť ověř změnu hesla, rušení relací, refresh tokeny a dostupnost vytvoření uživatele bez pozvánky.
4. Provozní založení účtu
Připrav oddělený CLI nástroj pro vytvoření Auth identity a navazujícího aplikačního účtu. Podporuj také dokončení provisioningu pro konkrétní existující Auth ID.

Po založení:
- účet má stav pending_password,
- must_change_password = true,
- dočasný přístup expiruje za 48 hodin,
- profil má has_workshop = false,
- chráněné příznaky nejsou v uživatelem upravitelných metadata.
Auth identita bez kompletního aplikačního účtu a profilu nemá běžný přístup.

Provisioning musí být idempotentní. Opakování nesmí vytvořit druhý účet, přepsat existující profil nebo bez výslovné resetovací operace změnit heslo. Při existujícím e-mailu nevybírej ani nepřepisuj účet potichu.

Privilegované nástroje drž odděleně od runtime aplikace. Privilegované klíče nejsou součástí klientského bundlu ani NEXT_PUBLIC konfigurace. Nezpřístupňuj ops operace webovým endpointem.

Heslo přijímej skrytým interaktivním vstupem; nepředávej ho argumentem příkazové řádky. Neukládej ho do aplikační DB, historie operací, logů nebo souborů. Pro testy použij izolované dočasné hodnoty bez jejich vypisování.
5. Povinná změna dočasného hesla
Nahraď dočasné blokující vysvětlení z etapy 2 funkčním omezeným průchodem pro změnu hesla.

Uživatel s platnou Auth relací, stavem pending_password, požadavkem na změnu a neexpirovaným dočasným přístupem může pouze:
- zobrazit formulář změny hesla,
- provést autorizovanou změnu hesla,
- odhlásit se.
Nesmí číst ani měnit běžná aplikační data. Výjimku implementuj úzce; neoslabuj obecný mechanismus autorizace.

Formulář obsahuje nové heslo a jeho potvrzení. Pravidla hesla musí odpovídat konfiguraci Auth a být srozumitelná v UI.

Až po potvrzeném úspěchu změny hesla bezpečně aktualizuj aplikační stav na aktivní a zruš požadavek i dočasnou expiraci. Selhání mezi změnou v Auth a zápisem do DB nesmí účet neoprávněně aktivovat nebo ho nechat bez možnosti nápravy.

Vyřeš relace po změně hesla. Upřednostni jednoduchý postup s novým přihlášením, pokud tím spolehlivě zajistíš odmítnutí starých relací. Nepředpokládej, že změna hesla automaticky zneplatní všechny již vydané access tokeny.

Expirovanému účtu zobraz jasnou informaci, že potřebuje nové dočasné heslo od provozovatele, a možnost odhlášení.
6. Změna vlastního hesla
Zprovozni existující část Nastavení.

Vyžaduj ověření současného hesla nebo odpovídající podporované opětovné ověření identity, které nevyžaduje SMTP. Formulář obsahuje současné heslo, nové heslo a potvrzení.

Zachovej serverovou validaci, ochranu mutací, přístupné chyby a stav probíhajícího požadavku. Hesla neukládej do analytiky ani logů.

Po změně uplatni zdokumentovanou politiku relací. Uživateli předem vysvětli, zda se bude muset znovu přihlásit. Ověř, že staré relace nelze oživit refreshem.
7. Reset a deaktivace přes CLI
Reset zapomenutého hesla:
1. Nejprve zablokuj běžný aplikační přístup.
2. Proveď změnu hesla přes Auth Admin API.
3. Zneplatni dosavadní relace dostupnými podporovanými prostředky.
4. Synchronizuj sessions_valid_after, stav účtu, požadavek na změnu a novou expiraci 48 hodin.
5. Umožni pouze omezený průchod povinnou změnou hesla.
Přesné pořadí přizpůsob ověřeným možnostem Auth a existující kontrole relací. Starý access token musí být aplikací odmítnut i před svou přirozenou expirací. Nově vydaný token ze staré relace nesmí obejít blokaci pouhým novějším časem vydání.

Deaktivace:
- nejprve zablokuj účet v aplikační DB,
- poté proveď odpovídající blokaci v Auth a zrušení relací,
- nemaž profil ani ostatní uživatelská data,
- při selhání Auth části musí aplikace zůstat nepřístupná.
Reset nesmí automaticky znovu aktivovat záměrně deaktivovaný účet.

CLI musí jasně určit cílový účet a prostředí. Výchozí prostředí je lokální. Připrav ochrany před náhodným spuštěním proti vzdálenému prostředí, ale cloudové operace v této etapě nespouštěj.
8. Evidence a obnova operací
Doplň AccountProvisionOperation podle technické specifikace a potřebné migrace.

Eviduj identifikátor operace, cílový účet, typ, stav, idempotency klíč, provozní referenci a bezpečný chybový kód. Neukládej hesla, tokeny ani celé odpovědi poskytovatele.

Zajisti:
- dohledání neúspěšné operace,
- bezpečné opakování nebo pokračování,
- ochranu před souběžnými konfliktními operacemi nad stejným účtem,
- nemožnost dokončit starší operaci tak, aby přepsala novější reset či deaktivaci.
Nevytvářej obecný workflow framework. Stačí přehledný mechanismus pro konkrétní operace této etapy. Běžná runtime DB role nesmí získat široká provozní oprávnění.
9. Dokumentace Supabase Dashboardu
Připrav krátký provozní návod:
- kde lze vytvořit Auth uživatele bez pozvánky, pokud to aktuální Dashboard podporuje,
- jak následně spustit provisioning pro jeho Auth ID,
- jak použít CLI jako úplnou alternativu,
- jak předat dočasné heslo osobně,
- jak řešit reset, expiraci a deaktivaci,
- jak rozpoznat a napravit neúplnou operaci.
Výslovně vysvětli, že samotné vytvoření identity nebo reset hesla v Dashboardu nenahrazuje synchronizaci aplikačního stavu. Nepřidávej odkaz „Správa uživatelů“ do Craftbooku.
10. Ověření
Použij skutečný lokální Supabase a PostgreSQL. Zachovej a spusť bezpečnostní testy z etapy 2.

Doplň testy pro:
- nové založení a opakovaný provisioning bez duplikátů,
- identitu bez kompletního aplikačního účtu,
- omezený přístup s dočasným heslem,
- úspěšnou povinnou změnu a následné přihlášení,
- expiraci dočasného přístupu,
- nesprávné současné heslo při běžné změně,
- reset a odmítnutí starých access i refresh relací,
- deaktivaci již přihlášeného uživatele,
- zákaz zásahu uživatele A do účtu B,
- zákaz úpravy chráněných příznaků přes profil nebo metadata,
- selhání mezi kroky Auth a DB a následnou bezpečnou nápravu,
- opakování a souběh konfliktních operací,
- zachování izolace dat a omezených práv runtime role.
Selhání simuluj řízeně v testech; potřebné scénáře nevynechávej jen proto, že běžně nastávají zřídka.

Spusť lint, typecheck, build a relevantní integrační testy. Formuláře ověř na desktopu a šířce 375 px, včetně klávesnice, chybových stavů a fokusu.

Nespouštěné kontroly neoznačuj jako úspěšné. Pokud zásadní test blokuje prostředí, uveď konkrétní blokátor a nepovažuj etapu za plně ověřenou.
11. Předání
Aktualizuj README, .env.example, docs/progress.md a docs/decisions.md. Provozní návod může být samostatně v docs/account-operations.md.

Do progress zaznamenej změny schématu, provedené kontroly, omezení a další krok. Zachovej historii předchozích etap.

Závěrečný report napiš česky a uveď:
- co nově funguje,
- jak lokálně vytvořit účet a vyzkoušet první přihlášení,
- jak spustit reset a deaktivaci,
- výsledky testů a případné blokátory.
Nevypisuj přihlašovací údaje. Po dokončení etapy 3 se zastav; nezačínej dokumenty ani další etapu.