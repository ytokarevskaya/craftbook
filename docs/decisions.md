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
