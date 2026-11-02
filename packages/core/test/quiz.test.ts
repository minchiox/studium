import { describe, expect, it } from 'vitest';
import { buildLlmRequest, generateQuizWithLlm, LlmError, llmContext, parseLlmQuiz } from '../src/llm.ts';
import {
  bankStats,
  cleanSpeech,
  dueQuestions,
  generateQuiz,
  keyTerms,
  type QuizSource,
  review,
  splitSentences,
} from '../src/quiz.ts';

const src = (paragraph: number, title: string, text: string): QuizSource => ({
  id: `ABC101:3:${paragraph}`,
  courseCode: 'ABC101',
  lesson: 3,
  paragraph,
  title,
  text,
});

// Synthetic, speech-like transcripts (fillers, truncated words, repetitions), as the platform produces them.
const SOURCES: QuizSource[] = [
  src(
    1,
    'Regressione lineare',
    `La regressione lineare è un modello che descrive la relazione tra una variabile dipendente e una variabile esplicativa.
I coefficienti della regressione lineare si stimano um con il metodo dei minimi quadrati, che minimizza la somma dei residui al quadrato.
Il coefficiente angolare indica di quanto varia in media la variabile dipendente per un aumento unitario della variabile esplicativa.
Nella regressione lineare semplice abbiamo una sola variabile esplicativa e una retta di regressione da stimare sui dati.
I residui sono le differenze tra i valori osservati e i valori stimati dalla retta di regressione lineare.`,
  ),
  src(
    2,
    'Bontà di adattamento',
    `L'indice R quadro misura la quota di variabilità della variabile dipendente spiegata dal modello di regressione.
Un indice R quadro elevato non implica una relazione causale tra le variabili, ma solo una buona bontà di adattamento.
La bontà di adattamento si valuta anche con l'analisi grafica dei residui, che non devono mostrare andamenti sistematici.
L'indice R quadro è compreso tra zero e uno e cresce sempre quando aggiungiamo variabili esplicative al modello.`,
  ),
  src(
    3,
    'Serie storiche',
    `Una serie storica è una sequenza di osservazioni ordinate rispetto alla variabile tempo, come il fatturato mensile.
Il trend rappresenta la tendenza di lungo periodo della serie storica, cioè la direzione di fondo del fenomeno osservato.
La stagionalità indica le oscillazioni che si ripetono con periodicità regolare, ad esempio ogni anno nello stesso mese.
Nello studio di una serie storica la s- la componente accidentale raccoglie le variazioni irregolari non spiegate da trend e stagionalità.`,
  ),
  src(
    4,
    'Classificazione',
    `La classificazione è un problema di apprendimento supervisionato in cui la variabile risposta è qualitativa.
La regressione logistica stima la probabilità che un'osservazione appartenga a una delle due classi della variabile risposta.
La matrice di confusione riassume le classificazioni corrette e sbagliate del modello su un insieme di dati di test.
L'accuratezza è la quota di osservazioni classificate correttamente sul totale delle osservazioni del campione di test.`,
  ),
  src(
    5,
    'Introduzione',
    'Allora ok, in questa lezione vediamo vediamo alcuni argomenti nuovi e molto interessanti per il corso.',
  ),
];

describe('speech cleanup', () => {
  it('drops fillers, truncated words and repetitions', () => {
    expect(cleanSpeech('Nello studio um della s- serie serie storica, Osserviamo il trend.')).toBe(
      'Nello studio della serie storica, osserviamo il trend.',
    );
    expect(
      splitSentences('Breve. Una frase sufficientemente lunga da diventare una domanda di quiz sensata.'),
    ).toEqual(['Una frase sufficientemente lunga da diventare una domanda di quiz sensata.']);
  });

  it('finds the key terms of each paragraph, preferring title phrases', () => {
    const terms = keyTerms(SOURCES);
    expect(terms.get('ABC101:3:1')).toContain('regressione lineare');
    expect(terms.get('ABC101:3:3')).toContain('serie storica');
  });
});

describe('local quiz', () => {
  const quiz = generateQuiz(SOURCES, { count: 12, seed: 7 });

  it('builds well-formed questions of every kind', () => {
    expect(quiz.length).toBeGreaterThanOrEqual(6);
    expect(new Set(quiz.map((q) => q.kind))).toEqual(new Set(['topic', 'cloze', 'truefalse']));
    for (const q of quiz) {
      expect(q.options[q.answer]).toBeDefined();
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.source.courseCode).toBe('ABC101');
    }
    expect(new Set(quiz.map((q) => q.id)).size).toBe(quiz.length);
  });

  it('asks the topic of a passage among real paragraph titles, never generic ones', () => {
    const topic = quiz.filter((q) => q.kind === 'topic');
    expect(topic.length).toBeGreaterThan(0);
    for (const q of topic) {
      expect(q.options[q.answer]).toBe(q.source.title);
      expect(q.options).not.toContain('Introduzione');
    }
  });

  it('blanks a key term inside a definition and offers same-shape distractors', () => {
    const cloze = quiz.filter((q) => q.kind === 'cloze');
    expect(cloze.length).toBeGreaterThan(0);
    for (const q of cloze) {
      expect(q.passage).toContain('_____');
      const words = (q.options[q.answer] ?? '').split(' ').length;
      expect(q.options.every((o) => o.split(' ').length === words)).toBe(true);
    }
  });

  it('is deterministic for a seed and varies with another', () => {
    expect(generateQuiz(SOURCES, { count: 12, seed: 7 })).toEqual(quiz);
    expect(generateQuiz(SOURCES, { count: 12, seed: 8 }).map((q) => q.id)).not.toEqual(quiz.map((q) => q.id));
  });

  it('returns nothing rather than nonsense from too little text', () => {
    expect(generateQuiz([SOURCES[4] as QuizSource])).toEqual([]);
  });
});

describe('spaced repetition', () => {
  const day = 86_400_000;
  it('moves cards up on success and back to box 1 on a mistake', () => {
    const a = review(undefined, true, 0);
    expect(a).toMatchObject({ box: 1, due: day, seen: 1, correct: 1 });
    const b = review(a, true, day);
    expect(b).toMatchObject({ box: 2, due: day + 3 * day });
    const c = review(b, false, 2 * day);
    expect(c).toMatchObject({ box: 1, seen: 3, correct: 2 });
    expect(c.due).toBe(2 * day + 10 * 60_000);
  });

  it('serves due cards first, then new ones, and computes stats', () => {
    const qs = generateQuiz(SOURCES, { count: 6, seed: 1 });
    const [q0, q1] = qs;
    if (!q0 || !q1) throw new Error('not enough questions');
    const states = { [q0.id]: review(undefined, false, 0), [q1.id]: review(undefined, true, 0) };
    const due = dueQuestions(qs, states, 60 * 60_000);
    expect(due[0]?.id).toBe(q0.id); // missed: due again after 10 minutes
    expect(due.map((q) => q.id)).not.toContain(q1.id); // known: due tomorrow
    expect(bankStats(qs, states, 60 * 60_000)).toEqual({
      total: qs.length,
      seen: 2,
      mastered: 0,
      due: 1,
      accuracy: 50,
    });
  });
});

describe('AI quiz (OpenAI-compatible)', () => {
  const config = { baseUrl: 'https://llm.example.com/v1/', apiKey: 'k', model: 'm' };
  const answer = {
    questions: [
      {
        question: 'Che cosa misura l’indice R quadro?',
        options: ['La quota di variabilità spiegata', 'La causalità', 'Il trend', 'La stagionalità'],
        answer: 0,
        explanation: 'È la quota di variabilità della risposta spiegata dal modello.',
        ref: '3.2',
      },
      { question: 'Domanda incompleta', options: ['a', 'b'], answer: 0 },
      { question: 'Opzioni duplicate?', options: ['x', 'x', 'y', 'z'], answer: 1 },
    ],
  };

  it('builds an HTTPS chat request with the lesson text and the user key', () => {
    const { url, init } = buildLlmRequest(config, SOURCES, 5);
    expect(url).toBe('https://llm.example.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer k');
    expect(JSON.parse(init.body).messages[1].content).toContain('[3.1] Regressione lineare');
    expect(() => buildLlmRequest({ ...config, baseUrl: 'http://x' }, SOURCES, 5)).toThrow(LlmError);
    expect(llmContext(SOURCES, 400).length).toBeLessThanOrEqual(400);
  });

  it('keeps only valid questions, even inside a fenced answer', () => {
    const qs = parseLlmQuiz(`Ecco:\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``, SOURCES);
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({
      kind: 'ai',
      answer: 0,
      source: { paragraph: 2, title: 'Bontà di adattamento' },
    });
    expect(() => parseLlmQuiz('nessun json', SOURCES)).toThrow(LlmError);
  });

  it('maps provider errors to clear messages', async () => {
    const reply = (status: number, body: unknown) => async () => ({
      ok: status < 400,
      status,
      text: async () => JSON.stringify(body),
    });
    const ok = await generateQuizWithLlm(
      reply(200, { choices: [{ message: { content: JSON.stringify(answer) } }] }),
      config,
      SOURCES,
    );
    expect(ok).toHaveLength(1);
    await expect(generateQuizWithLlm(reply(401, {}), config, SOURCES)).rejects.toThrow(
      'Chiave API non valida.',
    );
    await expect(generateQuizWithLlm(reply(429, {}), config, SOURCES)).rejects.toThrow(/Limite/);
    await expect(generateQuizWithLlm(reply(200, {}), { ...config, apiKey: ' ' }, SOURCES)).rejects.toThrow(
      /chiave/,
    );
  });
});
