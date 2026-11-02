# Privacy Policy di Studium

_Ultimo aggiornamento: 2 novembre 2026_

Studium è un'app **open-source, non ufficiale e solo client** per consultare i propri dati sulla piattaforma studenti della propria università online. Questa pagina spiega quali dati tocca l'app, dove restano e con chi comunica.

## In breve

- **Nessun server di Studium.** Il progetto non gestisce server, database o account: non riceve, non conserva e non vede i tuoi dati.
- **Nessuna telemetria**, nessuna analisi d'uso, nessun sistema di crash reporting, nessuna pubblicità.
- **Comunicazioni dirette** tra il telefono e i server della tua università. Nessun intermediario.
- **Tutto resta sul dispositivo** e viene cancellato quando disinstalli l'app.

## Credenziali e sessione

- **Password.** La inserisci solo nella pagina di accesso **ufficiale** dell'ateneo, aperta in una WebView dentro l'app. Il codice di Studium non legge, non memorizza e non trasmette la password.
- **Token di accesso.** Dopo l'accesso, l'app legge il token di accesso di breve durata che la web app dell'ateneo imposta in un cookie leggibile. Il token è salvato **cifrato con il Keystore di Android** (`expo-secure-store`) e usato solo per le richieste ai server dell'ateneo.
- **Refresh token.** Resta un cookie HttpOnly gestito dalla web app ufficiale: Studium **non lo legge mai**. Il rinnovo della sessione lo esegue la web app stessa, in una WebView nascosta.
- **Disconnessione.** Il comando "Esci" cancella il token dal dispositivo e, se la piattaforma lo prevede, chiude anche la sessione web.

## Dati salvati sul dispositivo

Nella memoria **privata** dell'app, non accessibile alle altre app:

- configurazione della piattaforma (indirizzi e nome del cookie della sessione, nessuna credenziale);
- cache delle risposte dell'API (corsi, carriera, esami, avvisi), per l'uso offline;
- dispense, allegati e trascrizioni che scegli di scaricare;
- banca dei quiz e progressi del ripasso;
- preferenze e promemoria locali.

Puoi cancellare dispense e trascrizioni dall'app (Download). **Disinstallando l'app**, Android elimina tutti questi dati.

I file che decidi di condividere o aprire con altre app (per esempio un PDF o una trascrizione) escono dall'app solo per tua azione esplicita.

## Con chi comunica l'app

| Destinatario | Perché | Quando |
|---|---|---|
| **Server della tua università** (web app, API studenti, host di video e sottotitoli) | Accesso, lettura dei tuoi dati, download di dispense e trascrizioni, pagine ufficiali (prenotazioni, player) | Durante l'uso |
| **GitHub** | Scaricare l'APK dalle release | Solo quando scarichi l'app o un aggiornamento dal browser |

Le WebView interne sono **confinate agli host dell'ateneo**: la navigazione verso domini esterni viene bloccata.

**Provider IA.** Le funzioni IA facoltative sono **attualmente disattivate**. Se in futuro verranno riattivate, saranno opt-in: il testo di una lezione andrebbe direttamente al provider scelto dall'utente, con la sua chiave salvata nel Keystore, senza passare da server di Studium. Questa policy verrà aggiornata prima di quel momento.

## Basi e ruoli

Studium non tratta dati personali per conto proprio: il software gira solo sul tuo dispositivo e i dati restano sotto il tuo controllo. Il titolare del trattamento dei dati sulla piattaforma è la tua università, secondo la sua informativa.

## Minori

L'app è pensata per studenti universitari e non raccoglie dati di alcun utente.

## Modifiche

Le modifiche a questa policy sono pubblicate in questo file, nel repository pubblico, con la data di aggiornamento. Lo storico è consultabile nella cronologia git.

## Contatti

Per domande apri una [issue su GitHub](https://github.com/minchiox/studium/issues). Per le vulnerabilità segui [SECURITY.md](SECURITY.md) e non aprire issue pubbliche.

---

Studium è un progetto indipendente: non è affiliato, approvato né sostenuto da alcuna università o gruppo universitario.
