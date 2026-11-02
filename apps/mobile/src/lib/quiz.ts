import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type CardState,
  generateQuiz,
  generateQuizWithLlm,
  type Lesson,
  type LlmConfig,
  type QuizQuestion,
  type QuizSource,
  review,
} from '@studium/core';
import * as SecureStore from 'expo-secure-store';
import { getTranscript, transcriptDocs } from './files';

// ------------------------------------------------------------------ sources

/** Quiz sources for one lesson: its transcript (saved offline on first use, like "Leggi la trascrizione"). */
export async function lessonSources(code: string, lesson: Lesson): Promise<QuizSource[]> {
  const t = await getTranscript(code, lesson);
  return t.lesson.paragraphs.flatMap((p, i) => {
    const text = t.texts[i];
    return text
      ? [
          {
            id: `${code}:${lesson.number}:${p.number}`,
            courseCode: code,
            lesson: lesson.number,
            paragraph: p.number,
            title: p.title,
            text,
          },
        ]
      : [];
  });
}

/** Sources from the transcripts downloaded for a course (the offline library). */
export async function courseSources(code: string): Promise<QuizSource[]> {
  const docs = await transcriptDocs({});
  return docs
    .filter((d) => d.meta?.code === code)
    .map((d) => ({
      id: d.id,
      courseCode: code,
      lesson: Number(d.meta?.lesson),
      paragraph: Number(d.meta?.paragraph),
      title: d.title.replace(/^\d+\.\d+\s+/, ''),
      text: d.text,
    }))
    .sort((a, b) => a.lesson - b.lesson || a.paragraph - b.paragraph);
}

export function localQuiz(sources: QuizSource[], context: QuizSource[], seed: number, count = 10) {
  return generateQuiz(sources, { count, seed, context });
}

// ------------------------------------------------------------------ personal bank (spaced repetition)

const BANK = 'studium.quiz.bank';
const MAX_QUESTIONS = 3000;

export interface Bank {
  questions: Record<string, QuizQuestion>;
  states: Record<string, CardState>;
}

let cache: Bank | null = null;

export async function loadBank(): Promise<Bank> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(BANK);
    cache = raw ? (JSON.parse(raw) as Bank) : { questions: {}, states: {} };
  } catch {
    cache = { questions: {}, states: {} };
  }
  return cache;
}

async function saveBank(bank: Bank): Promise<void> {
  const ids = Object.keys(bank.questions);
  if (ids.length > MAX_QUESTIONS) {
    // Forget the best-known questions first.
    ids
      .sort((a, b) => (bank.states[b]?.box ?? 0) - (bank.states[a]?.box ?? 0))
      .slice(0, ids.length - MAX_QUESTIONS)
      .forEach((id) => {
        delete bank.questions[id];
        delete bank.states[id];
      });
  }
  cache = bank;
  await AsyncStorage.setItem(BANK, JSON.stringify(bank));
}

/** Records an answer: the question joins the bank and its review date moves. */
export async function recordAnswer(q: QuizQuestion, correct: boolean): Promise<void> {
  const bank = await loadBank();
  bank.questions[q.id] = q;
  bank.states[q.id] = review(bank.states[q.id], correct);
  await saveBank(bank);
}

export async function clearBank(): Promise<void> {
  cache = { questions: {}, states: {} };
  await AsyncStorage.removeItem(BANK);
}

// ------------------------------------------------------------------ AI provider (optional, student's key)

const AI_SETTINGS = 'studium.ai';
const AI_KEY = 'studium.ai.key';

export interface AiSettings {
  preset: string;
  baseUrl: string;
  model: string;
}

export async function loadAi(): Promise<(AiSettings & { hasKey: boolean }) | null> {
  const raw = await AsyncStorage.getItem(AI_SETTINGS).catch(() => null);
  if (!raw) return null;
  const s = JSON.parse(raw) as AiSettings;
  const key = await SecureStore.getItemAsync(AI_KEY).catch(() => null);
  return { ...s, hasKey: !!key };
}

/** Saves the provider; the API key goes to the Android Keystore, never to plain storage. */
export async function saveAi(s: AiSettings, apiKey?: string): Promise<void> {
  await AsyncStorage.setItem(AI_SETTINGS, JSON.stringify(s));
  if (apiKey !== undefined) {
    if (apiKey.trim()) await SecureStore.setItemAsync(AI_KEY, apiKey.trim());
    else await SecureStore.deleteItemAsync(AI_KEY);
  }
}

export async function removeAi(): Promise<void> {
  await AsyncStorage.removeItem(AI_SETTINGS);
  await SecureStore.deleteItemAsync(AI_KEY);
}

async function aiConfig(): Promise<LlmConfig | null> {
  const s = await loadAi();
  const apiKey = await SecureStore.getItemAsync(AI_KEY).catch(() => null);
  return s && apiKey ? { baseUrl: s.baseUrl, model: s.model, apiKey } : null;
}

export async function aiQuiz(sources: QuizSource[], count = 8): Promise<QuizQuestion[]> {
  const config = await aiConfig();
  if (!config) throw new Error('Configura prima il provider IA nelle impostazioni dei quiz.');
  return generateQuizWithLlm((url, init) => fetch(url, init), config, sources, count);
}
