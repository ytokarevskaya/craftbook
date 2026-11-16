# Pravidla rozhraní Craftbook

Schválený směr z podkladů a zadání etapy 1, 16. 11. 2026. Obrázky slouží jako vizuální reference, nikoli autorita pro obsah či výpočty.

## Společný základ

Název Craftbook, slogan přesně „Jedna kniha vládne všem.“. Serif pouze wordmark; jinak systémové sans písmo. Sidebar přibližně 220 px, hlavní obsah s breadcrumb a titulkem. Mobil pod 800 px: hamburger a modal drawer, Escape, omezení fokusu uvnitř a návrat fokusu po zavření. Viditelný focus a skip link. Nepoužívat falešné osoby ani avatar.

Tokeny v `src/app/globals.css`: pozadí #F7F6F2, bílé panely, text #26332F, primární #355E50, šalvěj #E5EBDF, jemné okraje, radius 10 px, brass #AE8A43 jen pro malý akcent. Žádný marketingový hero, velké stíny ani nové logo. Rozvržení bez horizontálního přetečení na 375 px.

Navigace: Přehled / Dokumenty / Pracovní postupy / Výrobky / Materiály. Dole Nastavení a odhlášení. Žádná administrace. Etapa 1 ukazuje neaktivní odhlášení a vysvětlení, že není přihlášený účet.

Přehled: krátké přivítání, pokračování v práci, nedávné dokumenty a rychlé akce. Materiálový přehled pouze při skutečné vlastní dílně. Etapa 1 nemá profil a ukazuje pravdivé informace o budoucích funkcích, žádné nuly vydávané za načtenou evidenci ani demo záznamy.

Materiály: Zásoby / Nákupy / Pohyby, skutečná dostupnost až s vlastní dílnou. V etapě 1 explicitní náhled struktury bez bezpečnostního přepínače či ukládaného nastavení.

Nastavení: jméno, e-mail pouze pro čtení, vlastní dílna (výchozí vypnuto), změna hesla. V etapě 1 neaktivní bez odesílání a bez zadávání citlivých údajů. Přihlášení rovněž pouze neaktivní náhled.

## Vzory pro pozdější etapy — nyní neimplementovat

- Dokumenty: jednoduchý WYSIWYG s bezpečným renderem; žádný zdrojový Markdown ani split náhled. PDF/DOCX/MD jako soukromé přílohy. Obrázky přes Asset ID.
- Pracovní postupy: jen textové kroky, fotografie patří do poznámek, deníku a fotek výrobku.
- Výrobek: „Z pracovního postupu“ / „Bez pracovního postupu“. Ruční cesta obsahuje název, popis, materiály s volitelným množstvím a volitelné kroky.
- Průběh: explicitní true/false u pracovních kroků, X/Y a procento. Bez kroků text „Bez kroků“. 100 % neznamená done a nemění sklad. Neměnná kopie postupu je oddělená.
- Po dokončení bez vzoru: dobrovolný editovatelný formulář nového postupu, idempotentní uložení. Vlastní množství = odběr minus použitelná vratka s vysvětlením rozpisu, ne automaticky čistá hmotnost šperku. Školní neznámé množství zůstává prázdné. Nepřenášet checkboxy, fotografie, ceny ani rezervace.
- Null školní cena není nula ani chyba dokončeného výrobku. Zásoby, rezervace a spotřeba zůstávají oddělené.
- Oblíbené, vybavení, kolekce, velikosti, historie vzorů a AI mimo MVP.

## Aktualizace etapy 2 — 16. 11. 2026

Přihlášení a profil jsou skutečné formuláře s popisky, pending stavem, serverovou validací a čitelnou chybou. Po chybě/uložení se fokus přesune na zprávu. Po přihlášení se nezobrazuje označení náhledu bez identity. Uživatelské jméno vychází ze skutečného profilu, prázdné jméno má neutrální „Můj účet“.

Materiály se zobrazují jen při vlastní dílně; přímé URL ověřuje server. Nastavení ukládá jméno a dílnu, e-mail je pouze pro čtení. Změna hesla zůstává neaktivní s vysvětlením etapy 3. Blokovaný nebo neúplný účet má samostatnou obrazovku bez soukromého obsahu a možnost odhlášení. Vizuální tokeny, desktop sidebar a klávesnicový mobilní drawer z etapy 1 jsou zachované.
