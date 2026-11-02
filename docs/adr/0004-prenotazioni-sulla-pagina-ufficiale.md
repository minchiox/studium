# ADR 0004 — Prenotazioni d'esame sulla pagina ufficiale

**Stato:** accettato (v1.2.0)

## Contesto
Gli studenti vogliono vedere appelli e scadenze e prenotare dal telefono. Sulla piattaforma la prenotazione passa da un sistema separato, con un proprio token ottenuto dalla web app (`POST …/api/v1/auth/token`) e scritture dedicate (prenotazione, cancellazione, conferma degli esiti).

## Decisione
- Studium **legge** prenotazioni, appelli prenotabili con la finestra di prenotazione ed esiti da confermare, e li mostra con scadenze e promemoria.
- **Prenotare, cancellare e confermare** avvengono sulla **pagina ufficiale** (`/appelli`, `/confirm-exam`), aperta nel browser interno con la sessione dello studente e limitata agli host dell'ateneo.
- Il client di Studium resta in sola lettura: nessuna richiesta al servizio di prenotazione.

## Alternative scartate
- **Prenotazione diretta via API**: un tocco in meno, ma richiede di gestire un secondo token e scritture non documentate; un errore di interpretazione potrebbe prenotare l'appello sbagliato. Romperebbe inoltre la garanzia di sola lettura su cui si basa la fiducia nell'app.

## Conseguenze
- Funziona allo stesso modo su tutti gli atenei della piattaforma, perché la pagina è la loro.
- Se la piattaforma cambia il flusso di prenotazione, Studium continua a funzionare: apre comunque la pagina giusta.
