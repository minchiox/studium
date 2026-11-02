# ADR 0003 — Funzioni IA: motore locale + provider LLM a scelta

**Stato:** accettato (v1.2.0: quiz locali, banca con ripasso Leitner su AsyncStorage, provider compatibile OpenAI; i riassunti restano da fare)

## Contesto
Lo studente vuole riassunti, quiz e una banca esercitazioni. Un backend con una nostra chiave significherebbe costi a nostro carico, gestione degli abusi e contenuti didattici altrui sui nostri server.

## Decisione
Un'interfaccia `StudyEngine` (`summarize`, `generateQuiz`) con due implementazioni:

1. **Motore locale**, gratuito, offline, deterministico, nel core:
   - riassunto *estrattivo*: le frasi più centrali della trascrizione (TextRank su TF-IDF);
   - quiz *cloze* (completamento) e a scelta multipla sui termini chiave, con i distrattori presi dallo stesso corso;
   - ogni domanda cita lezione e paragrafo d'origine.
2. **Provider LLM** con API compatibile OpenAI (lo standard di fatto), con la chiave dell'utente nel Keystore. Funziona con i tier gratuiti dei provider di modelli open, con Ollama sul proprio PC (gratis e privato) o con API a pagamento. Le richieste partono dal telefono verso il provider scelto, senza intermediari.

La banca esercitazioni è **personale** (SQLite sul dispositivo, ripetizione spaziata FSRS). Non c'è condivisione tra studenti: la raccolta di domande d'esame reali sarebbe uno strumento per copiare, e ridistribuirebbe materiale protetto.

## Conseguenze
- La funzione base è gratuita per tutti; la qualità migliore è opt-in e controllata dall'utente.
- Nessun nostro server da mantenere né da rendere conforme al GDPR.
