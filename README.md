# Studium

**Il compagno di studio per l'università digitale.** Un'app Android, un server [MCP](https://modelcontextprotocol.io) per gli assistenti IA e una libreria condivisa per le università online che usano la stessa piattaforma studenti (Chamilo LMS con web app e API REST): lezioni, trascrizioni, dispense, carriera, esami e avvisi, più quiz per esercitarsi. Studium legge, non scrive: prenotazioni e frequenza restano sulla piattaforma ufficiale.

> [!IMPORTANT]
> Progetto indipendente e non ufficiale, non affiliato ad alcun ateneo. Usa il tuo account personale e rispetta il regolamento della tua università.

<p align="center"><img src="docs/screenshots/overview.png" alt="Home, corso, trascrizione con ricerca, carriera" width="900"></p>

## Cosa c'è

| | |
|---|---|
| 📱 **App Android** (`apps/mobile`) | Expo + React Native, interfaccia Material nativa, tema chiaro e scuro, funziona offline |
| 🤖 **Server MCP** (`packages/mcp`) | Gli stessi dati per Claude e gli altri assistenti IA: studio guidato, quiz, simulazioni d'esame |
| 🧩 **Core** (`packages/core`) | Client TypeScript portabile (Node e Hermes), validazione delle risposte, garanzia read-only |
| 🧪 **Mock LMS** (`apps/mock-lms`) | Piattaforma finta con dati inventati, per i test end-to-end e la demo |

### Funzioni dell'app

- **Home con "Da fare"**: le prossime cose da fare in ordine di urgenza (esiti da confermare, esame di oggi, prenotazioni in chiusura, ripasso, lezione da riprendere), media ponderata, CFU e prossimi impegni.
- **Esami e appelli**: prenotazioni, appelli prenotabili nella tua sede con la scadenza della prenotazione, esiti da confermare, promemoria quando le prenotazioni stanno per chiudere. Si prenota sulla pagina ufficiale dell'ateneo, che si apre nell'app.
- **Corsi e lezioni**: avanzamento delle videolezioni, tempo che manca, test di autovalutazione da fare.
- **Trascrizioni**: il testo delle lezioni, ricavato dai sottotitoli, con ricerca ed evidenziatore; si può condividere.
- **Dispense offline**: scarica le dispense e le trascrizioni di un intero corso con un tocco.
- **Ricerca offline** in tutte le trascrizioni scaricate.
- **Carriera**: libretto per anno, voti, media aritmetica e ponderata, base di laurea stimata.
- **Agenda**: esami prenotati, appelli aperti, lezioni live, con promemoria locali.
- **Avvisi** dell'ateneo con gli allegati.
- **Quiz ed esercitazioni**: domande create dalle trascrizioni di una lezione o di un corso scaricato (argomento del passaggio, completamento, vero o falso), con spiegazione e link al paragrafo; banca personale con ripasso a intervalli. Gratis e offline; facoltativamente con un provider IA compatibile OpenAI e la tua chiave.
- **Guarda la lezione** nel player ufficiale della piattaforma, oppure **ripassa** un video nell'app.

### Cosa non fa, per scelta

Studium **non registra la frequenza**, non segna le lezioni come viste, non compila test, **non prenota esami al posto tuo** e non scrive nulla sulla piattaforma: per prenotare apre la pagina ufficiale. La frequenza la registra solo il **player ufficiale**, mentre lo studente guarda; il ripasso dentro l'app non conta, e l'interfaccia lo dice esplicitamente. La garanzia è nel codice, non in una promessa: vedi [Sicurezza](#sicurezza-e-privacy).

## Avvio rapido (demo con il mock)

Requisiti: Node.js ≥ 22.18 e un dispositivo o emulatore Android.

```bash
npm ci
npm run build          # core + server MCP
npm test               # unit, contract ed end-to-end MCP (nessun account richiesto)

npm run mock           # piattaforma di prova su http://localhost:4010 (utente: demo, password: demo)
npm run mobile         # Metro: apri l'app con Expo Go (premi "a" per l'emulatore)
```

Su un telefono vero con il mock: `adb reverse tcp:4010 tcp:4010`.

## Installa l'app

1. Scarica dall'ultima [release](../../releases/latest), direttamente dal telefono, `studium-<versione>-arm64-v8a.apk` (quasi tutti i telefoni) oppure `-armeabi-v7a.apk` per quelli più vecchi a 32 bit, e aprilo. Android chiede di consentire l'installazione da questa fonte.
2. Al primo avvio tocca **Collega la tua università** e incolla l'indirizzo che apri nel browser per entrare nell'area studenti, per esempio `https://lms.<ateneo>.<dominio>/`.
3. Accedi come sempre, sulla pagina ufficiale. Studium **riconosce da solo la piattaforma**: indirizzo dell'API, cookie della sessione, host di video e sottotitoli.

La configurazione si può esportare e importare (Impostazioni → Esporta configurazione), ad esempio per passarla a un compagno della stessa università. Funziona con le università che usano la stessa piattaforma (web app studenti e API REST): sono più di una, con host, cookie ed endpoint identici. È verificata end-to-end su un ateneo; per gli altri della stessa piattaforma le verifiche anonime danno risposte identiche, e il test con un account è un comando ([`docs/api.md`](docs/api.md#compatibilità)). Se la piattaforma non è compatibile, l'app lo dice chiaramente invece di mostrare dati sbagliati.

### Per sviluppatori: profilo integrato

Una build personale può includere già il profilo, così si salta la configurazione. Copia [`profiles/example.json`](profiles/example.json) in `profiles/default.json`, che git ignora; dettagli in [`profiles/README.md`](profiles/README.md). Poi esegui `npm run apk -w @studium/mobile` ([`apps/mobile/README.md`](apps/mobile/README.md)). La build pubblica si ottiene con `STUDIUM_PROFILE=none`. Per il server MCP vedi [`packages/mcp/README.md`](packages/mcp/README.md).

## Sicurezza e privacy

- **Accesso sulla pagina ufficiale.** Il login avviene nella pagina dell'ateneo, dentro una WebView: la password non passa mai dal codice di Studium. L'app legge solo il token di accesso che la web app imposta in un cookie leggibile. Il refresh token resta un cookie HttpOnly che Studium non legge mai.
- **Rinnovo della sessione fatto dalla web app.** Quando il token scade, l'app carica la web app ufficiale in una WebView nascosta e lascia che sia lei a rinnovare la sessione. Studium non contiene segreti OAuth e non chiama endpoint di autenticazione.
- **Garanzia read-only.** Ogni richiesta passa da una guardia ([`packages/core/src/guard.ts`](packages/core/src/guard.ts)):
  - gli endpoint di tracciamento della frequenza (`…/lesson/view/…`) sono bloccati con qualsiasi metodo e su qualsiasi host;
  - le scritture verso l'API studenti sono bloccate.

  Nel server MCP la guardia agisce anche sul traffico del browser headless. I test E2E verificano dal lato server che l'app non chiami mai tracciamento né scritture.
- **Pagine ufficiali.** Player e prenotazioni si aprono nella web app dell'ateneo, dentro l'app e limitati agli host dell'università: quello che fai lì vale come sul sito.
- **IA facoltativa.** Senza configurazione i quiz restano sul telefono. Se attivi un provider IA, il testo della lezione va direttamente al provider che scegli, con la tua chiave (salvata nel Keystore).
- **Dati sul dispositivo.** Il token è cifrato con il Keystore di Android. Cache, dispense e trascrizioni restano nella memoria privata dell'app. Nessuna telemetria, nessun server di terze parti.
- **Contenuti.** Dispense e lezioni appartengono ai rispettivi autori: sono per lo studio personale, non vanno ridistribuite.

Vulnerabilità: [SECURITY.md](SECURITY.md).

## Architettura

```
apps/mobile ──┐                    ┌─► fetch (React Native) + WebView per login e rinnovo
              ├─► packages/core ───┤
packages/mcp ─┘   (client, guardia,└─► Playwright (Node) per il server MCP
                   parsing, dominio)
apps/mock-lms ◄── contract test ed E2E
```

Le scelte principali sono documentate negli ADR in [`docs/adr/`](docs/adr):
- [architettura del monorepo](docs/adr/0001-monorepo-e-core-portabile.md);
- [autenticazione tramite la web app](docs/adr/0002-sessione-tramite-web-app.md);
- [strategia per le funzioni IA](docs/adr/0003-funzioni-ia.md);
- [prenotazioni sulla pagina ufficiale](docs/adr/0004-prenotazioni-sulla-pagina-ufficiale.md).

Le API della piattaforma, ricostruite e commentate, sono in [`docs/api.md`](docs/api.md).

## Qualità

| Livello | Cosa | Dove |
|---|---|---|
| Unit | parsing, guardia, client (refresh, retry, errori, richieste condivise), carriera, agenda, appelli e finestre di prenotazione (in più fusi orari), quiz, ripasso, provider IA | `packages/core/test` |
| Contract | client reale contro il mock via HTTP, incluso il rinnovo della sessione | `apps/mock-lms/test` |
| MCP end-to-end | client e server MCP contro il mock | `packages/mcp/test` |
| Android E2E | Mock: configurazione dell'università, login, studio, download, ricerca, carriera, avvisi, agenda, rinnovo, logout, verifica read-only. esami e pagina di prenotazione. Piattaforma reale: giro completo con `--site` e `--cred`, quiz su una lezione, esami ed esercitazioni compresi | `apps/mobile/e2e` |

```bash
npm run check                              # lint + typecheck + test
npm run e2e -w @studium/mobile             # con emulatore, mock e Metro avviati
```

## Roadmap

- [x] Quiz con motore locale gratuito e provider LLM a scelta ([ADR 0003](docs/adr/0003-funzioni-ia.md))
- [x] Banca esercitazioni personale con ripetizione spaziata
- [x] Esami e appelli con prenotazione sulla pagina ufficiale ([ADR 0004](docs/adr/0004-prenotazioni-sulla-pagina-ufficiale.md))
- [ ] Riassunti delle lezioni
- [ ] Widget per la home di Android e notifiche per i nuovi avvisi
- [ ] Build iOS

## Licenza

[MIT](LICENSE)
