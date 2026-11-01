# Contribuire

```bash
npm ci
npm run check      # lint (Biome) + typecheck (TypeScript strict) + test (Vitest)
```

Regole del progetto:
1. **Sola lettura, sempre.** Non si accettano funzioni che registrano frequenza o avanzamento, completano test o scrivono sulla piattaforma. Nuove chiamate devono passare dalla guardia del core, con un test.
2. **Nessun dato identificativo nel codice.** Host, cookie e URL di un ateneo vanno nei profili, che non si committano tranne `example.json` e `mock.json`. Le fixture sono inventate.
3. **Il core resta portabile**: niente `node:*`, `Buffer` o DOM in `packages/core/src`.
4. **Ogni bug fix ha un test** che fallisce senza il fix. Le modifiche all'app passano anche dall'E2E (`apps/mobile/e2e`).
5. Codice e commenti in inglese; testi per gli utenti in italiano, in tono chiaro e diretto.
