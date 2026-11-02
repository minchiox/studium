# Studium MCP

Server [MCP](https://modelcontextprotocol.io) (stdio) e CLI che danno a un assistente IA accesso in sola lettura alla tua piattaforma universitaria: corsi, lezioni, trascrizioni, dispense, carriera, avvisi e agenda.

## Setup

```bash
npm ci && npm run build                       # dalla radice del monorepo
npx playwright install chromium
export STUDIUM_PROFILE=$PWD/profiles/default.json
node packages/mcp/dist/cli.js login           # accedi nella finestra del browser, poi chiudila
```

**Claude Code**

```bash
claude mcp add studium -s user \
  -e STUDIUM_PROFILE=/percorso/profiles/default.json \
  -e STUDIUM_WORKSPACE="$HOME/Università" \
  -- node /percorso/studium/packages/mcp/dist/cli.js
```

## Tool

| Tool | Cosa fa |
|---|---|
| `status` | sessione valida? |
| `list_courses`, `list_lessons`, `get_lesson` | piano di studi, lezioni, dettaglio con `watchUrl` |
| `get_transcript` | trascrizione Markdown di una lezione o di un paragrafo |
| `course_progress` | video mancanti e test di autovalutazione da fare |
| `get_career` | libretto con voti, medie e base di laurea stimata |
| `list_notices`, `get_agenda` | avvisi; esami prenotati, appelli e lezioni live |
| `get_exams` | prenotazioni, appelli prenotabili con la finestra di prenotazione, esiti da confermare, link alla pagina ufficiale (non prenota mai) |
| `practice_quiz` | quiz creato in locale dalla trascrizione di una lezione, con risposte e spiegazioni |
| `sync_course` | scarica dispense e trascrizioni nel workspace (con notifiche di progresso) |
| `open_page`, `click`, `api_get`, `download`, `download_by_click` | strumenti avanzati di esplorazione (`STUDIUM_TOOLS=core` li nasconde) |

Prompt: `studia_lezione`, `simula_esame`, `piano_di_studio`.

## CLI

```bash
studium-mcp status | courses | career | progress [CODICE] | sync CODICE [--dir D] [--force] | login | logout
```

## Configurazione

`STUDIUM_PROFILE`, `STUDIUM_WORKSPACE`, `STUDIUM_HOME` (cartella dati privata), `STUDIUM_TOOLS`, `STUDIUM_BROWSER_CHANNEL`, `STUDIUM_HEADLESS`, `STUDIUM_CONCURRENCY`, `STUDIUM_ALLOWED_HOSTS`, `STUDIUM_LOG_LEVEL`.
