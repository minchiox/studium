# ADR 0001 — Monorepo con un core portabile

**Stato:** accettato

## Contesto
Lo stesso dominio (corsi, lezioni, trascrizioni, carriera) serve a un'app Android e a un server MCP. L'app gira su Hermes (React Native), il server su Node. Il prototipo iniziale usava Playwright ovunque, ma Playwright non esiste su Android.

## Decisione
- Monorepo npm workspaces: `packages/core`, `packages/mcp`, `apps/mobile`, `apps/mock-lms`.
- `core` non dipende da Node né dal DOM. Il typecheck di `src` usa `types: []`, quindi usare `Buffer` o `node:*` per errore rompe la build. HTTP e token sono iniettati tramite le interfacce `Transport` e `TokenSource`.
- Import con estensione `.ts` riscritti in `.js` da `tsc` (`rewriteRelativeImportExtensions`). Metro consuma i sorgenti (campo `react-native`), Node consuma `dist`.
- Tutto ciò che identifica un ateneo sta nei **profili** JSON, fuori dal codice.
- Le risposte dell'API sono validate con zod. Un cambio di formato produce `PLATFORM_CHANGED`, mai dati sbagliati.

## Conseguenze
- Una correzione nel client vale per app e MCP; i test del core coprono entrambi.
- Il mock LMS è il contratto eseguibile: contract test, test MCP ed E2E Android lo usano tutti.
