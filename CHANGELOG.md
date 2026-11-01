# Changelog

## 1.1.0 — 2026-11-01

- Configurazione dell'università dall'app: inserisci l'indirizzo, accedi, e Studium riconosce la piattaforma (API, cookie di sessione, host di video e sottotitoli). Configurazione esportabile e importabile; possibilità di cambiare università.
- La build pubblica non contiene alcun profilo.
- HTTP in chiaro consentito solo verso localhost (mock di sviluppo); HTTPS altrove.
- Correzioni emerse sulla piattaforma reale: corsi mai aperti (`lp_id` stringa); corsi con codici diversi tra piano di studi e LMS.
- E2E anche su piattaforma reale (`--site`, `--cred`), senza mai registrare le password.

## 1.0.0 — 2026-11-01

Prima versione.

- App Android:
  - login sulla pagina ufficiale, rinnovo della sessione tramite la web app;
  - home con media e CFU, corsi e lezioni con avanzamento;
  - trascrizioni con ricerca ed evidenziatore, dispense e corsi offline, ricerca offline;
  - carriera con medie e base di laurea, agenda con promemoria, avvisi con allegati;
  - player ufficiale e ripasso video;
  - tema chiaro e scuro, cache persistente.
- Server MCP: tool di studio, carriera, avvisi e agenda; sync dei corsi; prompt di studio.
- Core portabile Node/Hermes con guardia read-only, validazione delle risposte e profili di piattaforma.
- Mock LMS, contract test, test MCP end-to-end, suite E2E Android a 17 passi.
