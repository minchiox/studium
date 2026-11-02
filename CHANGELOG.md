# Changelog

## 1.3.0 — 2026-11-02

**Sicurezza**
- Configurazioni importate validate (`parseProfile`): ogni indirizzo (`spaUrl`, `apiBase`, `portalUrl`, `mediaHost`, `subtitleHost`, `logoutUrl`, player) deve stare nei domini autorizzati, in HTTPS e senza credenziali; i suffissi pubblici (`it`, `com`, `ac.uk`, `github.io`…) sono rifiutati. L'app mostra i domini e chiede conferma prima di salvare, oppure elenca gli indirizzi bloccati. Un profilo già salvato che non rispetta le regole viene scartato e l'app torna alla configurazione.
- Player: l'indirizzo ricevuto (anche da deep link `studium://watch?url=…`) è verificato sugli host dell'ateneo.
- Tutte le WebView (login, pagine ufficiali, player, rinnovo) bloccano la navigazione fuori dagli host dell'ateneo con `onShouldStartLoadWithRequest`; i link esterni si possono aprire nel browser di sistema.
- Dominio registrabile calcolato con i suffissi pubblici a più livelli (`lms.uni.ac.uk` → `uni.ac.uk`).
- Guardia sulle scritture ancorata a segmenti di percorso (`/oauth/…`, `/auth/…`, ultimo segmento `token`/`refresh`/`login`/`logout`); percorsi codificati (`%2F`) decodificati; prefisso dell'API confrontato per segmenti (`/api` ≠ `/api2`).
- HTTP in chiaro consentito solo verso la macchina di sviluppo (`localhost`, `127.0.0.1`, `10.0.2.2`).
- Dispense scaricate solo dagli host dell'ateneo (app e sync MCP); `downloadByClick` dell'MCP verifica l'host prima del click e blocca le richieste verso host esterni durante il download.

**Funzioni IA temporaneamente disattivate** (`ENABLE_AI_FEATURES = false` in `packages/core/src/features.ts`): quiz con provider IA nascosti e bloccati nel core, `studium-mcp serve` non si avvia. I quiz locali restano.

**Interfaccia**
- Palette Slate/Indigo con notte deep blue, contrasto AA verificato in entrambi i temi; tipografia e spaziature sulla griglia di 4 px; ombre morbide su card e gruppi.
- Nuovi componenti `Card`, `Callout`, `Skeleton`; caricamenti a scheletro; pulsanti con stati disabilitato/occupato accessibili e variante `danger`; feedback aptico (`expo-haptics`) su azioni principali ed errori.
- Configurazione dell'università ridisegnata, con conferma esplicita dei domini all'importazione.

**Documentazione**: README rinnovato, `PRIVACY_POLICY.md`, landing page statica per GitHub Pages in `docs/index.html`.

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
