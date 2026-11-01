# Studium

**Il compagno di studio per l'università digitale.** Un'app Android, un server [MCP](https://modelcontextprotocol.io) per gli assistenti IA e una libreria condivisa per le piattaforme universitarie basate su **Chamilo LMS** con web app studenti e API REST: lezioni, trascrizioni, dispense, carriera, appelli e avvisi, in **sola lettura**.

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

- **Home**: media ponderata, CFU, prossimi esami e lezioni live, e i corsi da riprendere.
- **Corsi e lezioni**: avanzamento delle videolezioni, tempo che manca, test di autovalutazione da fare.
- **Trascrizioni**: il testo delle lezioni, ricavato dai sottotitoli, con ricerca ed evidenziatore; si può condividere.
- **Dispense offline**: scarica le dispense e le trascrizioni di un intero corso con un tocco.
- **Ricerca offline** in tutte le trascrizioni scaricate.
- **Carriera**: libretto per anno, voti, media aritmetica e ponderata, base di laurea stimata.
- **Agenda**: esami prenotati, appelli aperti, lezioni live, con promemoria locali.
- **Avvisi** dell'ateneo con gli allegati.
- **Guarda la lezione** nel player ufficiale della piattaforma, oppure **ripassa** un video nell'app.

### Cosa non fa, per scelta

Studium **non registra la frequenza**, non segna le lezioni come viste, non compila test e non scrive nulla sulla piattaforma. La frequenza la registra solo il **player ufficiale**, mentre lo studente guarda; il ripasso dentro l'app non conta, e l'interfaccia lo dice esplicitamente. La garanzia è nel codice, non in una promessa: vedi [Sicurezza](#sicurezza-e-privacy).

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

## Usarlo con la tua università

Tutto ciò che identifica una piattaforma (host, nomi dei cookie, URL del player) sta in un **profilo** JSON fuori dal codice. Copia [`profiles/example.json`](profiles/example.json) in `profiles/default.json`, che git ignora, e compila i valori della tua piattaforma: sono visibili negli strumenti per sviluppatori del browser, mentre sei collegato. Dettagli in [`profiles/README.md`](profiles/README.md).

- **App**: `npm run apk -w @studium/mobile` produce `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Lo installi con `adb install` o copiandolo sul telefono. Vedi [`apps/mobile/README.md`](apps/mobile/README.md).
- **Server MCP**: vedi [`packages/mcp/README.md`](packages/mcp/README.md).

## Sicurezza e privacy

- **Accesso sulla pagina ufficiale.** Il login avviene nella pagina dell'ateneo, dentro una WebView: la password non passa mai dal codice di Studium. L'app legge solo il token di accesso che la web app imposta in un cookie leggibile. Il refresh token resta un cookie HttpOnly che Studium non legge mai.
- **Rinnovo della sessione fatto dalla web app.** Quando il token scade, l'app carica la web app ufficiale in una WebView nascosta e lascia che sia lei a rinnovare la sessione. Studium non contiene segreti OAuth e non chiama endpoint di autenticazione.
- **Garanzia read-only.** Ogni richiesta passa da una guardia ([`packages/core/src/guard.ts`](packages/core/src/guard.ts)):
  - gli endpoint di tracciamento della frequenza (`…/lesson/view/…`) sono bloccati con qualsiasi metodo e su qualsiasi host;
  - le scritture verso l'API studenti sono bloccate.

  Nel server MCP la guardia agisce anche sul traffico del browser headless. I test E2E verificano dal lato server che l'app non chiami mai tracciamento né scritture.
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
- [strategia per le funzioni IA](docs/adr/0003-funzioni-ia.md).

## Qualità

| Livello | Cosa | Dove |
|---|---|---|
| Unit | parsing, guardia, client (refresh, retry, errori), carriera, agenda, ricerca | `packages/core/test` |
| Contract | client reale contro il mock via HTTP, incluso il rinnovo della sessione | `apps/mock-lms/test` |
| MCP end-to-end | client e server MCP contro il mock | `packages/mcp/test` |
| Android E2E | 17 passi sull'emulatore: login, studio, download, ricerca, carriera, avvisi, agenda, rinnovo, logout, verifica read-only | `apps/mobile/e2e` |

```bash
npm run check                              # lint + typecheck + test
npm run e2e -w @studium/mobile             # con emulatore, mock e Metro avviati
```

## Roadmap

- [ ] Funzioni IA: riassunti e quiz, con un motore locale gratuito e provider LLM a scelta ([ADR 0003](docs/adr/0003-funzioni-ia.md))
- [ ] Banca esercitazioni personale con ripetizione spaziata
- [ ] Widget per la home di Android e notifiche per i nuovi avvisi
- [ ] Build iOS

## Licenza

[MIT](LICENSE)
