# Changelog

## 1.2.1 — 2026-11-02

- Tasto e gesto indietro nelle pagine ufficiali (prenotazione, player): tornano prima alla pagina precedente del sito, poi chiudono la pagina; la freccia in alto la chiude subito.
- Campanella degli avvisi non più tagliata nell'intestazione.
- E2E: opzione `E2E_STOP_AFTER` per fermarsi dopo un passo (per esempio dopo il login) e fare prove a mano.

## 1.2.0 — 2026-11-02

- **Esami e appelli** (nuova scheda): prenotazioni, appelli prenotabili nella sede abituale con la scadenza della prenotazione, esiti da confermare. Prenotazione, cancellazione e conferma degli esiti sulla pagina ufficiale, aperta nell'app ([ADR 0004](docs/adr/0004-prenotazioni-sulla-pagina-ufficiale.md)). Promemoria quando le prenotazioni stanno per chiudere.
- **Quiz ed esercitazioni**: quiz su una lezione o su un corso scaricato, creati in locale dalle trascrizioni; spiegazione e link al paragrafo; banca personale con ripasso a intervalli. Provider IA facoltativo, compatibile OpenAI, con la chiave dell'utente nel Keystore.
- **Home "Da fare"**: le prossime azioni in ordine di urgenza. Avvisi dalla campanella in Home e da Altro.
- Grafica: l'evidenziatore segnala ciò che richiede attenzione oggi; il rosso resta per gli errori.
- Prestazioni: richieste identiche condivise, avvisi in lista virtualizzata, APK per architettura e riduzione delle risorse.
- Server MCP 1.1.0: `get_exams` e `practice_quiz`.
- Documentazione delle API della piattaforma ([docs/api.md](docs/api.md)).

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
