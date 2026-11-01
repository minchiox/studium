# ADR 0002 — Login e rinnovo della sessione tramite la web app ufficiale

**Stato:** accettato

## Contesto
L'API studenti usa un JWT di breve durata, in un cookie leggibile, e un refresh token in un cookie HttpOnly. Il login nativo richiederebbe di maneggiare le password. Chiamare direttamente l'endpoint OAuth richiederebbe di estrarre credenziali client dalla web app.

## Decisione
- **Login**: la pagina ufficiale in una WebView. Uno script iniettato legge soltanto il cookie del token di accesso e lo passa all'app. La password non transita dal nostro codice.
- **Rinnovo**: quando il token scade (401), l'app monta una WebView nascosta sulla home della web app. È la web app a rinnovare la sessione con il proprio codice e il cookie HttpOnly, e l'app legge il nuovo token. Il rinnovo è single-flight: le richieste concorrenti aspettano lo stesso rinnovo.
- **Logout** solo se la web app mostra davvero la pagina di accesso. Un timeout o l'assenza di rete non buttano fuori lo studente: l'app continua a mostrare i dati in cache.
- Il token è conservato con `expo-secure-store` (Keystore di Android).

## Conseguenze
- Nessun segreto nel codice e nessuna chiamata ad endpoint di autenticazione: il flusso è quello del browser.
- Se la web app cambia il meccanismo di rinnovo, il fallback è un nuovo login, sempre sicuro.
- Il mock LMS riproduce il contratto (cookie leggibile + HttpOnly, rinnovo sulla home) ed è verificato dall'E2E.
