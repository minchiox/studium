// Local quiz engine: free, offline and deterministic (ADR 0003). It works on lecture transcripts, which are
// automatic speech-to-text: noisy, with fillers ("um"), truncated words ("s-") and recognition errors. So it
// favours questions that survive the noise: "which topic is this passage about?" (answers are the clean
// paragraph titles), fill-in-the-blank on definitional sentences only, true/false by swapping a key term.
import { normalize } from './search.ts';

export interface QuizSource {
  /** Stable id, e.g. "CODE:lesson:paragraph". */
  id: string;
  courseCode: string;
  lesson: number;
  paragraph: number;
  /** Paragraph title, e.g. "Trend e stagionalità". */
  title: string;
  text: string;
}

export type QuizKind = 'topic' | 'cloze' | 'truefalse' | 'ai';

export interface QuizQuestion {
  id: string;
  kind: QuizKind;
  prompt: string;
  /** Quoted passage shown under the prompt, when any. */
  passage?: string;
  options: string[];
  answer: number;
  explanation: string;
  source: { courseCode: string; lesson: number; paragraph: number; title: string };
}

// ------------------------------------------------------------------ text

const FILLERS = /\b(?:um+|uhm+|ehm+|eh|ah|mh+|ok|okay)\b[,.]?\s*/gi;

/** Removes speech noise: fillers, truncated words ("s-", "de-"), immediate repetitions, odd capitals. */
export function cleanSpeech(text: string): string {
  return text
    .replace(FILLERS, '')
    .replace(/(^|\s)[\p{L}]{1,3}-(?=\s)/gu, '$1')
    .replace(/\b([\p{L}']+)(\s+\1\b)+/giu, '$1')
    .replace(/([,;]\s+)\p{Lu}(?=\p{Ll})/gu, (m) => m.toLowerCase())
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Sentences of reasonable length (one subtitle line is often one sentence). */
export function splitSentences(text: string): string[] {
  return cleanSpeech(text)
    .split(/(?<=[.!?])\s+(?=\p{Lu})|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 50 && s.length <= 280 && !s.endsWith('?'));
}

const STOP = new Set(
  `a ad al alla alle allo agli ai anche ancora avere aveva abbiamo andiamo andare bene che chi ci cioe come con
  cosa cui da dal dalla dalle dagli dai degli dei del della delle dello di dove dunque e ed era essere fare
  fatto fra gli ha hanno ho il in invece io la le lei li lo loro lui ma molto ne nei nel nella nelle nello noi
  non nostro o oppure per perche pero piu poi possiamo puo qua quale quali qualche quando quanto quella quelle
  quelli quello questa queste questi questo qui quindi se sempre senza si sia siamo sono sta stato su sua sue
  sui sul sulla sulle suo tale tali tanto tra tutti tutto tutte tutta un una uno vedere vediamo viene vengono
  voi allora appunto proprio ovvero esempio caso modo parte tipo cosi dire detto ogni altro altri altra altre
  stesso stessa diversi diverse primo prima secondo ultimo nostra nostri vostra mentre dopo prima sopra sotto
  lezione slide grafico possono deve devono dobbiamo vogliamo andremo vedremo abbiamo visto andare questo
  momento volta volte due tre quattro cinque poi molto molti molte meno quanto quella ciascun ciascuna
  andiamo vado infatti oltre attraverso rispetto riguardo relativo relativa sempre spesso tutto tutte
  inoltre aver avendo essendo stato stata stati state reale fine base grande piccolo nuovo nuova
  parentesi aperta aperto chiusa chiuso possa possano abbia abbiano fosse fossero`.split(/\s+/),
);

const words = (s: string): string[] =>
  normalize(s)
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/^[a-z]'/, ''))
    .filter(Boolean);

/** Content words: no stop words, numbers, adverbs ("-mente") or gerunds ("-ando", "-endo"). */
const isContent = (w: string) =>
  w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w) && !/(mente|ando|endo)$/.test(w);

/** Candidate terms: content words and two-word phrases ("serie storica"). */
function candidates(text: string): string[] {
  const ws = words(text);
  const out: string[] = [];
  for (let i = 0; i < ws.length; i++) {
    const a = ws[i] as string;
    if (!isContent(a)) continue;
    out.push(a);
    const b = ws[i + 1];
    if (b && isContent(b)) out.push(`${a} ${b}`);
  }
  return out;
}

/**
 * Key terms per source by TF-IDF over the given sources (usually one course). Terms in the paragraph title
 * get a boost: titles are clean and name what the paragraph is about.
 */
export function keyTerms(sources: readonly QuizSource[], perSource = 8): Map<string, string[]> {
  const tf = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  for (const s of sources) {
    const counts = new Map<string, number>();
    for (const t of candidates(cleanSpeech(s.text))) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of candidates(s.title)) counts.set(t, (counts.get(t) ?? 0) + 3);
    tf.set(s.id, counts);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = Math.max(1, sources.length);
  const out = new Map<string, string[]>();
  for (const s of sources) {
    const counts = tf.get(s.id) ?? new Map();
    const scored = [...counts]
      .filter(([, c]) => c >= 2)
      .map(([t, c]) => {
        const idf = Math.log(1 + n / (df.get(t) ?? 1));
        return [t, (1 + Math.log(c)) * idf * (t.includes(' ') ? 1.6 : 1)] as const;
      })
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    // Drop single words already covered by a chosen phrase.
    const chosen: string[] = [];
    for (const [t] of scored) {
      if (chosen.length >= perSource) break;
      if (chosen.some((c) => c.includes(' ') && c.split(' ').includes(t))) continue;
      chosen.push(t);
    }
    out.set(s.id, chosen);
  }
  return out;
}

/**
 * The most frequent original spelling of each normalized term ("unita temporale" → "unità temporale"),
 * so options keep their accents. `normalize` keeps string length, so offsets map back to the original.
 */
export function surfaceForms(sources: readonly QuizSource[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  const add = (norm: string, surface: string) => {
    const m = counts.get(norm) ?? new Map<string, number>();
    m.set(surface, (m.get(surface) ?? 0) + 1);
    counts.set(norm, m);
  };
  for (const s of sources) {
    for (const text of [cleanSpeech(s.text), s.title]) {
      const norm = normalize(text);
      const tokens = [...norm.matchAll(/[a-z0-9]+/g)].map((m) => ({
        norm: m[0],
        surface: text.slice(m.index, m.index + m[0].length).toLowerCase(),
      }));
      tokens.forEach((t, i) => {
        add(t.norm, t.surface);
        const n = tokens[i + 1];
        if (n) add(`${t.norm} ${n.norm}`, `${t.surface} ${n.surface}`);
      });
    }
  }
  const out = new Map<string, string>();
  for (const [norm, m] of counts) out.set(norm, [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? norm);
  return out;
}

/** Cuts a passage at a word boundary. */
function trimPassage(text: string, max = 260): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,;:]$/, '')}…`;
}

// ------------------------------------------------------------------ deterministic randomness

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: tiny seeded PRNG, so the same input always gives the same quiz. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Puts `correct` among `distractors` at a random position. */
function withOptions(correct: string, distractors: string[], rand: () => number) {
  const options = shuffle([correct, ...distractors], rand);
  return { options, answer: options.indexOf(correct) };
}

// ------------------------------------------------------------------ generation

const GENERIC_TITLE =
  /^(introduzione|conclusion[ei]|premessa|riepilogo|sintesi|esempi?|esercizi?|approfondimento|parte \d+)\b/i;
const DEFINITION =
  /\b(è|sono|si definisce|si definiscono|viene definit[oa]|consiste|consistono|indica|indicano|rappresenta|rappresentano|si intende|si chiama|si dice|misura|misurano|permette|permettono)\b/i;

const sourceRef = (s: QuizSource) => ({
  courseCode: s.courseCode,
  lesson: s.lesson,
  paragraph: s.paragraph,
  title: s.title,
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when a definitional verb sits right next to the term: the sentence is about that term. */
function definesTerm(sentence: string, hit: { index: number; text: string }): boolean {
  const around = sentence.slice(Math.max(0, hit.index - 40), hit.index + hit.text.length + 40);
  return DEFINITION.test(around);
}

/** Finds `term` (accent-insensitive) in `sentence`; returns the original-cased match. */
function findTerm(sentence: string, term: string): { index: number; text: string } | null {
  const m = new RegExp(`\\b${escapeRe(term)}\\b`).exec(normalize(sentence));
  return m ? { index: m.index, text: sentence.slice(m.index, m.index + term.length) } : null;
}

function topicQuestion(s: QuizSource, pool: QuizSource[], rand: () => number): QuizQuestion | null {
  if (GENERIC_TITLE.test(s.title)) return null;
  const sentences = splitSentences(s.text);
  if (sentences.length < 3) return null;
  const others = shuffle(
    [
      ...new Set(pool.filter((o) => o.id !== s.id && !GENERIC_TITLE.test(o.title)).map((o) => o.title)),
    ].filter((t) => normalize(t) !== normalize(s.title)),
    rand,
  ).slice(0, 3);
  if (others.length < 3) return null;
  const start = Math.floor(rand() * Math.max(1, sentences.length - 2));
  const passage = trimPassage(sentences.slice(start, start + 2).join(' '));
  return {
    id: `topic:${s.id}:${hash(passage)}`,
    kind: 'topic',
    prompt: 'Di quale argomento parla questo passaggio?',
    passage,
    ...withOptions(s.title, others, rand),
    explanation: `Il passaggio viene dal paragrafo ${s.lesson}.${s.paragraph} “${s.title}”.`,
    source: sourceRef(s),
  };
}

interface TermContext {
  /** Distractor pool: terms frequent across the course (real concepts, not one-off word pairs). */
  allTerms: string[];
  display: (term: string) => string;
  /** Sentences already used by another question of the same quiz. */
  usedSentences: Set<string>;
  /** Lessons where each term is a key term: distractors from nearby lessons are harder to rule out. */
  lessonsOf: Map<string, number[]>;
}

/** Same-shape distractors, preferring terms from lessons close to `lesson`. */
function pickDistractors(
  term: string,
  lesson: number,
  ctx: TermContext,
  rand: () => number,
  n = 3,
): string[] {
  const words = term.split(' ').length;
  const ok = ctx.allTerms.filter(
    (t) => t !== term && t.split(' ').length === words && !term.includes(t) && !t.includes(term),
  );
  const dist = (t: string) => Math.min(...(ctx.lessonsOf.get(t) ?? [999]).map((l) => Math.abs(l - lesson)));
  const near = shuffle(
    ok.filter((t) => dist(t) <= 3),
    rand,
  );
  const far = shuffle(
    ok.filter((t) => dist(t) > 3),
    rand,
  );
  return [...near, ...far].slice(0, n);
}

function clozeQuestions(
  s: QuizSource,
  terms: string[],
  ctx: TermContext,
  rand: () => number,
): QuizQuestion[] {
  const { display, usedSentences } = ctx;
  const out: QuizQuestion[] = [];
  const used = new Set<string>();
  for (const sentence of splitSentences(s.text)) {
    if (usedSentences.has(sentence) || !DEFINITION.test(sentence)) continue;
    const term = terms.find((t) => !used.has(t) && findTerm(sentence, t));
    if (!term) continue;
    const hit = findTerm(sentence, term);
    if (!hit || hit.index < 3 || !definesTerm(sentence, hit)) continue; // no blank at the very start
    const distractors = pickDistractors(term, s.lesson, ctx, rand).map(display);
    if (distractors.length < 3) continue;
    used.add(term);
    usedSentences.add(sentence);
    const blanked = `${sentence.slice(0, hit.index)}_____${sentence.slice(hit.index + term.length)}`;
    out.push({
      id: `cloze:${s.id}:${hash(sentence)}`,
      kind: 'cloze',
      prompt: 'Completa la frase.',
      passage: blanked,
      ...withOptions(hit.text.toLowerCase(), distractors, rand),
      explanation: `«${sentence}» (lezione ${s.lesson}.${s.paragraph}, “${s.title}”)`,
      source: sourceRef(s),
    });
    if (out.length >= 2) break;
  }
  return out;
}

function trueFalseQuestion(
  s: QuizSource,
  terms: string[],
  ctx: TermContext,
  rand: () => number,
): QuizQuestion | null {
  const { display, usedSentences } = ctx;
  for (const sentence of splitSentences(s.text)) {
    if (usedSentences.has(sentence) || !DEFINITION.test(sentence)) continue;
    const term = terms.find((t) => findTerm(sentence, t));
    const hit = term ? findTerm(sentence, term) : null;
    if (!term || !hit || !definesTerm(sentence, hit)) continue;
    const isTrue = rand() < 0.5;
    let statement = sentence;
    if (!isTrue) {
      const swap = pickDistractors(term, s.lesson, ctx, rand, 1)[0];
      if (!swap) continue;
      statement = `${sentence.slice(0, hit.index)}${display(swap)}${sentence.slice(hit.index + term.length)}`;
    }
    usedSentences.add(sentence);
    return {
      id: `tf:${s.id}:${hash(statement)}`,
      kind: 'truefalse',
      prompt: 'Vero o falso?',
      passage: capitalize(statement),
      options: ['Vero', 'Falso'],
      answer: isTrue ? 0 : 1,
      explanation: isTrue
        ? `È la frase della lezione ${s.lesson}.${s.paragraph}.`
        : `Nella lezione ${s.lesson}.${s.paragraph} si dice: «${sentence}»`,
      source: sourceRef(s),
    };
  }
  return null;
}

/** Key terms that recur across the course (at least 4 times, or in a title), most frequent first. */
function distractorPool(pool: readonly QuizSource[], terms: Map<string, string[]>): string[] {
  const freq = new Map<string, number>();
  for (const s of pool) {
    for (const t of candidates(cleanSpeech(s.text))) freq.set(t, (freq.get(t) ?? 0) + 1);
    for (const t of candidates(s.title)) freq.set(t, (freq.get(t) ?? 0) + 4);
  }
  const keys = [...new Set([...terms.values()].flat())];
  return keys
    .filter((t) => (freq.get(t) ?? 0) >= 4)
    .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b));
}

export interface QuizOptions {
  /** Maximum number of questions. */
  count?: number;
  /** Same seed, same quiz. Change it for a new mix. */
  seed?: number;
  kinds?: readonly Exclude<QuizKind, 'ai'>[];
  /** Extra sources used only for options (e.g. the whole course when quizzing one lesson). */
  context?: readonly QuizSource[];
}

/** Questions from transcripts, balanced across paragraphs and kinds. */
export function generateQuiz(sources: readonly QuizSource[], opts: QuizOptions = {}): QuizQuestion[] {
  const { count = 10, seed = 1, kinds = ['topic', 'cloze', 'truefalse'] } = opts;
  const rand = rng(seed);
  const pool = [...new Map([...sources, ...(opts.context ?? [])].map((s) => [s.id, s])).values()];
  const terms = keyTerms(pool);
  const surfaces = surfaceForms(pool);
  const ctx: TermContext = {
    allTerms: distractorPool(pool, terms),
    display: (t) => surfaces.get(t) ?? t,
    usedSentences: new Set(),
    lessonsOf: new Map(),
  };
  for (const s of pool)
    for (const t of terms.get(s.id) ?? []) ctx.lessonsOf.set(t, [...(ctx.lessonsOf.get(t) ?? []), s.lesson]);
  const perSource: QuizQuestion[][] = sources.map((s) => {
    const own = terms.get(s.id) ?? [];
    const qs: QuizQuestion[] = [];
    if (kinds.includes('topic')) {
      const q = topicQuestion(s, pool, rand);
      if (q) qs.push(q);
    }
    if (kinds.includes('cloze')) qs.push(...clozeQuestions(s, own, ctx, rand));
    if (kinds.includes('truefalse')) {
      const q = trueFalseQuestion(s, own, ctx, rand);
      if (q) qs.push(q);
    }
    return shuffle(qs, rand);
  });
  // Round-robin across paragraphs, so a quiz covers the whole lesson or course.
  const order = shuffle(
    perSource.map((_, i) => i),
    rand,
  );
  const out: QuizQuestion[] = [];
  for (let round = 0; out.length < count; round++) {
    let added = false;
    for (const i of order) {
      const q = perSource[i]?.[round];
      if (q && out.length < count) {
        out.push(q);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

// ------------------------------------------------------------------ spaced repetition (Leitner)

export interface CardState {
  /** 1 (new or just missed) … 5 (well known). */
  box: number;
  /** Epoch ms when the card is due again. */
  due: number;
  seen: number;
  correct: number;
}

/** Days until the next review, per box. */
export const LEITNER_DAYS = [0, 1, 3, 7, 16, 35] as const;

export function review(state: CardState | undefined, correct: boolean, now = Date.now()): CardState {
  const box = correct ? Math.min(5, (state?.box ?? 0) + 1) : 1;
  const days = correct ? (LEITNER_DAYS[box] ?? 35) : 0;
  return {
    box,
    due: now + days * 86_400_000 + (correct ? 0 : 10 * 60_000),
    seen: (state?.seen ?? 0) + 1,
    correct: (state?.correct ?? 0) + (correct ? 1 : 0),
  };
}

/** Questions to review now: missed or due first, then never seen. */
export function dueQuestions(
  questions: readonly QuizQuestion[],
  states: Readonly<Record<string, CardState>>,
  now = Date.now(),
  limit = 20,
): QuizQuestion[] {
  const due = questions
    .filter((q) => states[q.id] && (states[q.id] as CardState).due <= now)
    .sort((a, b) => (states[a.id]?.box ?? 0) - (states[b.id]?.box ?? 0));
  const fresh = questions.filter((q) => !states[q.id]);
  return [...due, ...fresh].slice(0, limit);
}

export interface BankStats {
  total: number;
  seen: number;
  /** Box 4 or 5. */
  mastered: number;
  due: number;
  /** Correct answers / answers, 0–100; null before any answer. */
  accuracy: number | null;
}

export function bankStats(
  questions: readonly QuizQuestion[],
  states: Readonly<Record<string, CardState>>,
  now = Date.now(),
): BankStats {
  let seen = 0;
  let mastered = 0;
  let due = 0;
  let answers = 0;
  let correct = 0;
  for (const q of questions) {
    const s = states[q.id];
    if (!s) continue;
    seen++;
    if (s.box >= 4) mastered++;
    if (s.due <= now) due++;
    answers += s.seen;
    correct += s.correct;
  }
  return {
    total: questions.length,
    seen,
    mastered,
    due,
    accuracy: answers ? Math.round((correct / answers) * 100) : null,
  };
}
