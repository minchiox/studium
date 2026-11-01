# Profili di piattaforma

Un profilo descrive **una** installazione della web app studenti: host, nomi dei cookie, URL del player. Il codice non contiene nessuno di questi valori, così lo stesso codice funziona per atenei diversi e il repository resta neutro.

| File | Scopo | In git |
|---|---|---|
| `example.json` | Modello con valori finti | sì |
| `mock.json` | La piattaforma di prova (`apps/mock-lms`) | sì |
| `default.json` | **Il tuo** profilo reale | no (ignorato) |

## Campi

| Campo | Significato |
|---|---|
| `id`, `name` | Identificativo e nome mostrato nell'app |
| `spaUrl` | Home della web app studenti: qui si fa il login e qui la web app rinnova la sessione |
| `apiBase` | Base dell'API REST studenti (senza `/` finale) |
| `portalUrl` | Portale Chamilo (opzionale, usato dal server MCP) |
| `watchUrlTemplate` | URL del player di una lezione: `{spa}`, `{course}` e `{lp}` vengono sostituiti |
| `tokenCookie` | Cookie con il token di accesso (JWT) impostato dalla web app |
| `refreshCookie` | Cookie HttpOnly con il refresh token (Studium non lo legge mai) |
| `mediaHost`, `subtitleHost` | Host di video e dispense, e host dei sottotitoli `.vtt` con gli stessi percorsi |
| `allowedHostSuffixes` | Domini che gli strumenti possono raggiungere |
| `logoutUrl` | Opzionale: pagina che chiude la sessione web |
| `allowInsecureHttp` | Solo per il mock locale |

## Come ricavare i valori

Accedi alla web app dal browser del computer, apri gli strumenti per sviluppatori:
- **Rete**: l'host delle chiamate `…/student/…` è `apiBase`;
- **Applicazione → Cookie**: il cookie con un JWT (`eyJ…`) è `tokenCookie`, quello HttpOnly accanto è `refreshCookie`;
- apri una videolezione: l'URL della pagina dà `watchUrlTemplate`, l'host del video `mediaHost`, quello del file `.vtt` `subtitleHost`.

Usa il profilo:
- **app**: `STUDIUM_PROFILE=profiles/default.json npm run apk -w @studium/mobile` (oppure salvalo come `profiles/default.json`);
- **MCP**: variabile `STUDIUM_PROFILE`, oppure il file `profile.json` nella cartella dati.
