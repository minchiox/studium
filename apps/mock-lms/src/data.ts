// Fictional, anonymous data for the mock LMS. Shapes mirror the real student API.

export interface MockParagraph {
  title: string;
  durationS: number;
  progress: number;
  sentences: string[];
}

export interface MockLesson {
  lpId: number;
  title: string;
  progress: number;
  objectives: string;
  selfTestDone: boolean;
  paragraphs: MockParagraph[];
}

export interface MockCourse {
  code: string;
  title: string;
  cfu: number;
  year: number;
  ssd: string;
  teacher: [string, string];
  vote: number | null;
  date: string;
  lessons: MockLesson[];
}

const p = (title: string, durationS: number, progress: number, ...sentences: string[]): MockParagraph => ({
  title,
  durationS,
  progress,
  sentences,
});

let lp = 100;
const lesson = (
  title: string,
  progress: number,
  objectives: string,
  selfTestDone: boolean,
  ...paragraphs: MockParagraph[]
): MockLesson => ({ lpId: ++lp, title, progress, objectives, selfTestDone, paragraphs });

export const COURSES: MockCourse[] = [
  {
    code: 'DAT101',
    title: 'Analisi dei dati',
    cfu: 9,
    year: 1,
    ssd: 'SECS-S/01',
    teacher: ['Giulia', 'Ferri'],
    vote: null,
    date: '',
    lessons: [
      lesson(
        'Introduzione ai dati',
        100,
        'Comprendere cosa sono i dati, le loro tipologie e il ciclo di vita del dato.',
        true,
        p(
          'Cosa sono i dati',
          540,
          100,
          'Buongiorno a tutti e benvenuti al corso di analisi dei dati.',
          'Un dato è la rappresentazione di un fatto, di una misura o di un’osservazione.',
          'Distinguiamo dati quantitativi, come l’altezza o il reddito, e dati qualitativi, come il colore o la regione di residenza.',
          'La qualità del dato dipende da accuratezza, completezza e tempestività.',
        ),
        p(
          'Il ciclo di vita del dato',
          480,
          100,
          'Il ciclo di vita del dato comprende raccolta, pulizia, analisi, interpretazione e conservazione.',
          'La fase di pulizia richiede spesso più tempo dell’analisi vera e propria.',
          'Ricordate: un modello costruito su dati sporchi produce conclusioni sbagliate.',
        ),
      ),
      lesson(
        'Statistica descrittiva',
        80,
        'Saper calcolare e interpretare indici di posizione e di variabilità.',
        false,
        p(
          'Indici di posizione',
          610,
          100,
          'Gli indici di posizione descrivono il centro di una distribuzione.',
          'La media aritmetica è sensibile ai valori estremi, mentre la mediana è robusta.',
          'La moda è il valore più frequente ed è l’unico indice utilizzabile con dati nominali.',
        ),
        p(
          'Indici di variabilità',
          560,
          100,
          'La varianza misura la dispersione dei dati attorno alla media.',
          'La deviazione standard è la radice quadrata della varianza ed è espressa nella stessa unità dei dati.',
          'Il coefficiente di variazione permette di confrontare la variabilità di fenomeni diversi.',
        ),
      ),
      lesson(
        'Regressione lineare',
        40,
        'Stimare e interpretare un modello di regressione lineare semplice.',
        false,
        p(
          'Il modello lineare',
          700,
          100,
          'La regressione lineare descrive la relazione tra una variabile dipendente e una variabile esplicativa.',
          'I coefficienti si stimano con il metodo dei minimi quadrati.',
          'Il coefficiente angolare indica di quanto varia in media la risposta per un aumento unitario della variabile esplicativa.',
        ),
        p(
          'Bontà di adattamento',
          520,
          30,
          'L’indice R quadro misura la quota di variabilità spiegata dal modello.',
          'Un R quadro elevato non implica una relazione causale.',
          'Analizzate sempre i residui per verificare le ipotesi del modello.',
        ),
        p(
          'Esempio guidato',
          450,
          0,
          'Vediamo ora un esempio con i dati sulle vendite e la spesa pubblicitaria.',
          'Interpretiamo insieme i coefficienti e il loro intervallo di confidenza.',
        ),
      ),
      lesson(
        'Classificazione',
        0,
        'Conoscere i principali algoritmi di classificazione supervisionata.',
        false,
        p(
          'Problemi di classificazione',
          600,
          0,
          'Nella classificazione la variabile risposta è categoriale.',
          'La regressione logistica stima la probabilità di appartenenza a una classe.',
          'Gli alberi decisionali dividono lo spazio delle variabili con regole semplici e interpretabili.',
        ),
        p(
          'Valutare un classificatore',
          580,
          0,
          'La matrice di confusione riassume previsioni corrette ed errori.',
          'Accuratezza, precisione e richiamo misurano aspetti diversi della qualità del modello.',
        ),
      ),
    ],
  },
  {
    code: 'LAW102',
    title: "Diritto dell'informatica",
    cfu: 9,
    year: 1,
    ssd: 'IUS/17',
    teacher: ['Marco', 'Galli'],
    vote: null,
    date: '',
    lessons: [
      lesson(
        'Fonti del diritto dell’informatica',
        100,
        'Inquadrare le fonti nazionali ed europee del diritto delle tecnologie.',
        true,
        p(
          'Le fonti',
          620,
          100,
          'Il diritto dell’informatica nasce dall’intreccio tra norme nazionali ed europee.',
          'I regolamenti europei sono direttamente applicabili, mentre le direttive richiedono un recepimento.',
        ),
        p(
          'Il ruolo della giurisprudenza',
          500,
          100,
          'La giurisprudenza ha un ruolo decisivo nell’interpretare norme scritte prima delle tecnologie attuali.',
        ),
      ),
      lesson(
        'Protezione dei dati personali',
        60,
        'Conoscere principi, basi giuridiche e diritti dell’interessato nel GDPR.',
        false,
        p(
          'Principi del GDPR',
          640,
          100,
          'Il regolamento generale sulla protezione dei dati si fonda su principi come liceità, minimizzazione e limitazione della conservazione.',
          'Il titolare del trattamento deve essere in grado di dimostrare il rispetto dei principi: è il principio di responsabilizzazione.',
        ),
        p(
          'Diritti dell’interessato',
          590,
          20,
          'L’interessato ha diritto di accesso, rettifica, cancellazione e portabilità dei dati.',
          'Il diritto all’oblio va bilanciato con la libertà di informazione.',
        ),
      ),
      lesson(
        'Reati informatici',
        0,
        'Distinguere le principali fattispecie di reato informatico.',
        false,
        p(
          'Accesso abusivo',
          560,
          0,
          'L’accesso abusivo a un sistema informatico punisce chi si introduce in un sistema protetto contro la volontà del titolare.',
          'Conta l’esistenza di misure di sicurezza, anche minime.',
        ),
        p(
          'Frode informatica',
          540,
          0,
          'La frode informatica consiste nell’alterare il funzionamento di un sistema per procurarsi un ingiusto profitto.',
        ),
      ),
    ],
  },
  {
    code: 'ENG103',
    title: 'Lingua inglese',
    cfu: 6,
    year: 1,
    ssd: 'L-LIN/12',
    teacher: ['Anna', 'Moretti'],
    vote: 28,
    date: '2026-07-10',
    lessons: [
      lesson(
        'Present simple e present continuous',
        100,
        'Usare correttamente i tempi presenti.',
        true,
        p(
          'Present simple',
          420,
          100,
          'Il present simple esprime abitudini e verità generali.',
          'Alla terza persona singolare si aggiunge la desinenza s.',
        ),
        p(
          'Present continuous',
          400,
          100,
          'Il present continuous descrive azioni in corso nel momento in cui si parla.',
        ),
      ),
      lesson(
        'Past simple',
        100,
        'Raccontare eventi passati con il past simple.',
        true,
        p(
          'Verbi regolari e irregolari',
          460,
          100,
          'I verbi regolari formano il passato con la desinenza ed.',
          'I verbi irregolari vanno memorizzati: go, went, gone.',
        ),
      ),
    ],
  },
];

/** Study-plan entries without lessons (to show a realistic career). */
export const OTHER_EXAMS = [
  {
    code: 'SEC201',
    title: 'Sicurezza delle reti',
    cfu: 9,
    year: 2,
    ssd: 'ING-INF/03',
    vote: null as number | null,
  },
  {
    code: 'CRY202',
    title: 'Crittografia applicata',
    cfu: 6,
    year: 2,
    ssd: 'INF/01',
    vote: null as number | null,
  },
  { code: 'TIR203', title: 'Tirocinio', cfu: 3, year: 2, ssd: '', vote: null as number | null },
];

export const STUDENT = {
  user: { official_code: '0000123456' },
  enrolment: {
    official_code: '0000123456',
    corso: 'LM-00 - Laurea magistrale di prova',
    anno_accademico_immatricolazione: '2026/2027',
    anno_attuale_iscrizione: 1,
    stato: 'Regolare',
  },
  registry: { firstname: 'ALEX', lastname: 'ESEMPIO' },
};

export function notices(now: Date) {
  const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return [
    {
      id: 3,
      title: 'Apertura prenotazioni sessione di dicembre',
      body: '<p>Le prenotazioni per gli appelli di <b>dicembre</b> sono aperte fino al 30 novembre.</p><p>Controlla il calendario allegato.</p>',
      start: day(-1),
      end: day(29),
      created_at: `${day(-1)}T08:00:00.000000Z`,
      notice_category: { name: 'Didattica' },
      attachments: [
        {
          id: 31,
          title: 'Calendario appelli',
          filesize: '12 KB',
          file: '3/calendario-appelli.pdf',
          typefile: { extension: 'pdf' },
        },
      ],
    },
    {
      id: 2,
      title: 'Webinar: come preparare l’esame scritto',
      body: '<p>Un incontro con i tutor per prepararsi alle prove scritte online.</p>',
      start: day(-4),
      end: day(10),
      created_at: `${day(-4)}T09:30:00.000000Z`,
      notice_category: { name: 'Eventi' },
      attachments: [],
    },
    {
      id: 1,
      title: 'Manutenzione programmata',
      body: '<p>La piattaforma non sarà disponibile sabato dalle 7 alle 9.</p>',
      start: day(-10),
      end: null,
      created_at: `${day(-10)}T10:00:00.000000Z`,
      notice_category: { name: 'Piattaforma' },
      attachments: [],
    },
  ];
}
