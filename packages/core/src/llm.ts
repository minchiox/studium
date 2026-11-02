// Optional AI quiz generation through any OpenAI-compatible chat API, with the student's own key (ADR 0003).
// Requests go from the device straight to the provider the student chose; nothing passes through us.
import { z } from 'zod';
import type { QuizQuestion, QuizSource } from './quiz.ts';
import { cleanSpeech } from './quiz.ts';

export interface LlmConfig {
  /** e.g. "https://api.groq.com/openai/v1" — the part before "/chat/completions". */
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Ready-made settings; the model name can always be changed. HTTPS only (Android blocks clear text). */
export const LLM_PRESETS = [
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'custom', name: 'Altro (compatibile OpenAI)', baseUrl: '', model: '' },
] as const;

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

const MAX_CHARS = 14_000;

/** The lesson text sent to the model, labelled by paragraph, trimmed to a sensible size. */
export function llmContext(sources: readonly QuizSource[], maxChars = MAX_CHARS): string {
  const parts: string[] = [];
  let used = 0;
  for (const s of sources) {
    const text = cleanSpeech(s.text);
    const head = `[${s.lesson}.${s.paragraph}] ${s.title}\n`;
    const room = maxChars - used - head.length;
    if (room < 200) break;
    const body = text.length > room ? `${text.slice(0, room - 1)}…` : text;
    parts.push(head + body);
    used += head.length + body.length + 2;
  }
  return parts.join('\n\n');
}

const SYSTEM = `Sei un docente universitario italiano. Crei domande d'esame a risposta multipla, chiare e rigorose,
basate SOLO sul testo fornito (trascrizione automatica di videolezioni: ignora errori di riconoscimento e intercalari).
Ogni domanda ha 4 opzioni plausibili e una sola corretta; niente "tutte le precedenti".
Rispondi SOLO con JSON: {"questions":[{"question":"…","options":["…","…","…","…"],"answer":0,"explanation":"…","ref":"L.P"}]}
dove answer è l'indice (0-3) dell'opzione corretta e ref è il paragrafo di origine come appare tra parentesi quadre.`;

export function buildLlmRequest(config: LlmConfig, sources: readonly QuizSource[], count: number) {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  if (!/^https:\/\//i.test(url)) throw new LlmError('L’indirizzo del provider deve iniziare con https://');
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Crea ${count} domande su questo testo.\n\n${llmContext(sources)}` },
        ],
      }),
    },
  };
}

const LlmQuestion = z.object({
  question: z.string().min(5),
  options: z.array(z.coerce.string()).length(4),
  answer: z.coerce.number().int().min(0).max(3),
  explanation: z.string().optional().default(''),
  ref: z.coerce.string().optional(),
});

/** Extracts the JSON object even when the model wraps it in prose or a ```json fence. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new LlmError('Il modello non ha restituito domande valide.');
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new LlmError('Il modello non ha restituito domande valide.');
  }
}

/** Validates the model's answer; invalid questions are dropped, not guessed. */
export function parseLlmQuiz(content: string, sources: readonly QuizSource[]): QuizQuestion[] {
  const data = extractJson(content) as { questions?: unknown };
  const list = Array.isArray(data?.questions) ? data.questions : [];
  const bySection = new Map(sources.map((s) => [`${s.lesson}.${s.paragraph}`, s]));
  const fallback = sources[0];
  const out: QuizQuestion[] = [];
  for (const item of list) {
    const r = LlmQuestion.safeParse(item);
    if (!r.success) continue;
    const q = r.data;
    const options = q.options.map((o) => o.trim());
    if (new Set(options.map((o) => o.toLowerCase())).size < 4) continue;
    const src = bySection.get((q.ref ?? '').replace(/[[\]\s]/g, '')) ?? fallback;
    if (!src) continue;
    out.push({
      id: `ai:${src.id}:${simpleHash(q.question)}`,
      kind: 'ai',
      prompt: q.question.trim(),
      options,
      answer: q.answer,
      explanation: q.explanation.trim(),
      source: { courseCode: src.courseCode, lesson: src.lesson, paragraph: src.paragraph, title: src.title },
    });
  }
  if (!out.length) throw new LlmError('Il modello non ha restituito domande valide.');
  return out;
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Calls the provider and returns validated questions. The key never leaves this request. */
export async function generateQuizWithLlm(
  fetchFn: FetchLike,
  config: LlmConfig,
  sources: readonly QuizSource[],
  count = 8,
  timeoutMs = 60_000,
): Promise<QuizQuestion[]> {
  if (!config.apiKey.trim()) throw new LlmError('Inserisci la chiave API nelle impostazioni dell’IA.');
  if (!sources.length) throw new LlmError('Nessun testo da cui creare le domande.');
  const { url, init } = buildLlmRequest(config, sources, count);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(url, { ...init, signal: ctrl.signal });
  } catch {
    throw new LlmError('Il provider non risponde. Controlla la connessione e l’indirizzo.');
  } finally {
    clearTimeout(timer);
  }
  const body = await res.text();
  if (res.status === 401 || res.status === 403) throw new LlmError('Chiave API non valida.', res.status);
  if (res.status === 429) throw new LlmError('Limite di richieste raggiunto: riprova tra poco.', 429);
  if (!res.ok) throw new LlmError(`Il provider ha risposto con errore ${res.status}.`, res.status);
  let content = '';
  try {
    content =
      (JSON.parse(body) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
        ?.content ?? '';
  } catch {
    throw new LlmError('Risposta del provider non riconosciuta.');
  }
  return parseLlmQuiz(content, sources);
}
