# API della piattaforma

Le piattaforme supportate da Studium **non pubblicano una documentazione delle API**: questa guida le ricostruisce dal codice pubblico della web app studenti, dalle risposte che i server danno senza autenticazione e dai test sulla piattaforma reale. Possono cambiare senza preavviso; per questo il core valida ogni risposta (`packages/core/src/types.ts`) e il mock (`apps/mock-lms`) le riproduce.

Nei nomi degli host, `<ateneo>` è il nome dell'università sulla piattaforma e `<dominio>` il dominio del gestore.

## Servizi

| Servizio | Indirizzo tipico | Uso |
|---|---|---|
| Web app studenti | `https://lms.<ateneo>.<dominio>/` | Login, player ufficiale, prenotazioni |
| API studente | `https://lms-api.prod.<ateneo>.<dominio>` | REST JSON letto da Studium |
| Portale corsi | `https://lms-courses.<ateneo>.<dominio>/` | Portale Chamilo (usato solo dall'MCP) |
| Video | CDN (`*.cloudfront.net`) | Video delle lezioni |
| Sottotitoli | `https://video-<ateneo>.<dominio>/` | File `.vtt`, da cui vengono le trascrizioni |
| Prenotazioni | `https://booking.<ateneo>.<dominio>/` | Sistema di prenotazione separato |

## Autenticazione

1. Lo studente accede sulla **pagina ufficiale** (WebView). La password non passa da Studium.
2. La piattaforma imposta i cookie `<ateneo>_token` (JWT di accesso) e `<ateneo>_refresh_token`.
3. Ogni chiamata all'API porta `Authorization: Bearer <token>`.
4. Il token lo rinnova la web app ufficiale in una WebView nascosta ([ADR 0002](adr/0002-sessione-tramite-web-app.md)).

Il riconoscimento automatico della piattaforma (`packages/core/src/discovery.ts`) ricava base dell'API, cookie e host dei media da ciò che fa la web app durante il login.

| Risposta | Significato |
|---|---|
| `401 {"data":"Token empty","code":401}` | Header assente o token scaduto: Studium rinnova e riprova una volta |
| `400 … $bearerToken … null given` | Endpoint del sistema di prenotazione: serve un token diverso (vedi sotto) |
| HTML al posto di JSON | Endpoint inesistente: `PLATFORM_CHANGED` |
| `408`, `429`, `5xx` | Ritentati con attesa crescente (solo GET) |

Molte risposte sono imbustate (`{"data": …, "code": 200}`), altre restituiscono direttamente l'array.

## Endpoint usati da Studium

Tutti in `GET`. Elenco in `API` (`packages/core/src/client.ts`).

| Endpoint | Contenuto |
|---|---|
| `/student/info` | Profilo: matricola, nome, corso di laurea |
| `/student/video-lessons/getCourses` | Corsi con avanzamento; `lp_id` è oggetto, numero o stringa (corso mai aperto) |
| `/student/course/{codice}/video-lessons/0` | Lezioni di un corso |
| `/student/course/{codice}/video-lesson/{lp}/paragraphs/{lp}` | Contenuti di una lezione (video, dispensa, test) |
| `/student/evaluation/gr/career` | Carriera per anno, esiti, medie pubblicate |
| `/student/get-reservations` | Prenotazioni attive |
| `/student/exam-online/exams-list-active` | Appelli online attivi |
| `/student/get-bookable-exams` | Appelli prenotabili per corso, con **finestra di prenotazione** (`start_date`, `end_date`) |
| `/student/exams/to-confirm` | Esiti da accettare o rifiutare |
| `/student/class/sessions?status=scheduled` | Lezioni live |
| `/notice/fp_notices`, `/notice/unread`, `/notice/attachment/?file=…` | Avvisi e allegati |

### Date degli appelli

Le date arrivano come `"2026-11-02"`, `"2026-11-02 00:00:00"` oppure come istante UTC della mezzanotte locale (`"2026-11-04T23:00:00.000000Z"` = 5 novembre in Italia). `platformDay` (`packages/core/src/exams.ts`) restituisce sempre il giorno corretto, qualunque sia il fuso del telefono. La finestra di prenotazione è inclusiva: `end_date` è l'ultimo giorno utile.

## Prenotazioni

La prenotazione **non** passa dall'API studente. La pagina `/appelli` della web app ottiene un token dal servizio di prenotazione (`POST …/api/v1/auth/token`) e lo usa per `student/exam-booking/*`; per la prova finale apre `booking.<ateneo>.<dominio>`. Cancellazione (`del-my-reservation`) e conferma degli esiti (`exams/confirmation`) sono scritture.

Studium mostra appelli, scadenze e prenotazioni leggendo gli endpoint sopra e, per prenotare, cancellare o confermare un esito, apre la **pagina ufficiale** (`/appelli`, `/confirm-exam`) nel browser interno, già autenticato ([ADR 0004](adr/0004-prenotazioni-sulla-pagina-ufficiale.md)).

## Garanzia di sola lettura

`packages/core/src/guard.ts`:

- `…/lesson/view/…` (tracciamento della frequenza) è sempre bloccato;
- le richieste non GET verso l'API studente sono bloccate, salvo la manutenzione della sessione;
- solo host dell'ateneo e HTTPS.

Le pagine ufficiali aperte nell'app (player, prenotazioni) sono la web app dell'ateneo: quello che lo studente fa lì vale come sul sito.

## Compatibilità

Più atenei condividono la stessa piattaforma: stessi host per tenant, stesso schema dei cookie, stessi endpoint. Senza credenziali si verifica così:

```bash
curl -s https://lms-api.prod.<ateneo>.<dominio>/student/info     # atteso: 401 {"data":"Token empty","code":401}
curl -s https://lms.<ateneo>.<dominio>/ | grep -o '/assets/index-[a-f0-9]*\.js'
```

e cercando nel bundle i percorsi `student/…` usati da Studium. La conferma definitiva è il test E2E con un account: `node apps/mobile/e2e/run.mjs --apk --site https://lms.<ateneo>.<dominio>/ --cred <file>`.

## Scoprire nuovi endpoint

1. Nel bundle della web app le chiamate hanno la forma `PlatformRequest.get({path:"student/…"})` e le rotte `path:"/appelli"`.
2. Ogni endpoint nuovo va aggiunto in `API`, con schema in `types.ts`, risposta nel mock e un test.
3. Le risposte contengono dati personali: mai in repository, log o issue.
