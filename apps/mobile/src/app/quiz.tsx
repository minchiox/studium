import { MaterialCommunityIcons } from '@expo/vector-icons';
import { dueQuestions, type QuizQuestion } from '@studium/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Empty, ErrorState, Loading, Progress, Screen, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { aiQuiz, courseSources, lessonSources, loadBank, localQuiz, recordAnswer } from '@/lib/quiz';
import { radius, space, usePalette } from '@/lib/theme';

type Mode = 'lesson' | 'course' | 'review';
type Engine = 'local' | 'ai';

/**
 * A quiz session: questions from a lesson, a downloaded course or the review queue; one at a time, with the
 * answer, an explanation and a link back to the source paragraph.
 */
export default function Quiz() {
  const {
    mode = 'lesson',
    code = '',
    n,
    engine = 'local',
  } = useLocalSearchParams<{
    mode?: Mode;
    code?: string;
    n?: string;
    engine?: Engine;
  }>();
  const [seed, setSeed] = useState(1);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<QuizQuestion[]>([]);

  const start = useCallback(
    async (s: number, retry?: QuizQuestion[]) => {
      setQuestions(null);
      setError(null);
      setIndex(0);
      setPicked(null);
      setScore(0);
      setMissed([]);
      try {
        if (retry) return setQuestions(retry);
        if (mode === 'review') {
          const bank = await loadBank();
          const all = Object.values(bank.questions).filter((q) => !code || q.source.courseCode === code);
          return setQuestions(dueQuestions(all, bank.states, Date.now(), 15));
        }
        const course = await courseSources(code);
        let sources = course;
        if (mode === 'lesson') {
          const lesson = (await api().listLessons(code)).find((l) => l.number === Number(n));
          if (!lesson) throw new Error('Lezione non trovata.');
          sources = await lessonSources(code, lesson);
        }
        if (!sources.length) return setQuestions([]);
        setQuestions(engine === 'ai' ? await aiQuiz(sources) : localQuiz(sources, course, s));
      } catch (e) {
        setError(e);
      }
    },
    [mode, code, n, engine],
  );

  useEffect(() => {
    void start(seed);
  }, [start, seed]);

  const title = mode === 'review' ? 'Ripasso' : engine === 'ai' ? 'Quiz con IA' : 'Quiz';
  const header = <Stack.Screen options={{ title }} />;

  if (error)
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={() => void start(seed)} />
      </>
    );
  if (!questions)
    return (
      <>
        {header}
        <Loading label={engine === 'ai' ? 'L’IA sta preparando le domande…' : 'Preparo le domande…'} />
      </>
    );
  if (!questions.length)
    return (
      <>
        {header}
        <Empty
          icon={mode === 'review' ? 'check-decagram-outline' : 'text-box-remove-outline'}
          title={mode === 'review' ? 'Niente da ripassare' : 'Nessuna domanda'}
          body={
            mode === 'review'
              ? 'Hai ripassato tutto. Fai un quiz su una lezione: le domande entrano nella tua banca.'
              : mode === 'course'
                ? 'Scarica il corso offline dalla sua pagina: i quiz sul corso usano le trascrizioni scaricate.'
                : 'Questa lezione non ha abbastanza trascrizione per creare domande.'
          }
        />
      </>
    );

  const done = index >= questions.length;
  if (done)
    return (
      <>
        {header}
        <Summary
          score={score}
          total={questions.length}
          missed={missed}
          onRetryMissed={() => void start(seed, missed)}
          onNew={mode === 'review' ? undefined : () => setSeed((x) => x + 1)}
        />
      </>
    );

  const q = questions[index] as QuizQuestion;
  const answer = async (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answer;
    if (ok) setScore((x) => x + 1);
    else setMissed((m) => [...m, q]);
    await recordAnswer(q, ok).catch(() => undefined);
  };

  return (
    <>
      {header}
      <Screen testID="quiz">
        <View style={{ gap: space.sm }}>
          <View style={styles.spread}>
            <Txt variant="small" color="textMuted">
              Domanda {index + 1} di {questions.length}
            </Txt>
            <Txt variant="small" color="textMuted">
              {plural(score, 'corretta', 'corrette')}
            </Txt>
          </View>
          <Progress value={(index / questions.length) * 100} />
        </View>
        <QuestionCard q={q} picked={picked} onPick={answer} />
        {picked !== null ? (
          <Button
            testID="quiz-next"
            label={index + 1 < questions.length ? 'Prossima domanda' : 'Vedi il risultato'}
            icon="arrow-right"
            onPress={() => {
              setPicked(null);
              setIndex((x) => x + 1);
            }}
          />
        ) : null}
      </Screen>
    </>
  );
}

function QuestionCard({
  q,
  picked,
  onPick,
}: {
  q: QuizQuestion;
  picked: number | null;
  onPick: (i: number) => void;
}) {
  const c = usePalette();
  const answered = picked !== null;
  return (
    <View style={{ gap: space.lg }} testID={`quiz-question-${q.kind}`}>
      <Txt variant="heading">{q.prompt}</Txt>
      {q.passage ? (
        <View style={[styles.passage, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Txt variant="reading">{q.passage}</Txt>
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        {q.options.map((o, i) => {
          const right = answered && i === q.answer;
          const wrong = answered && i === picked && i !== q.answer;
          const bg = right ? c.successSoft : wrong ? c.dangerSoft : c.surface;
          const border = right ? c.success : wrong ? c.danger : c.border;
          return (
            <Pressable
              key={o}
              testID={`quiz-option-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: picked === i, disabled: answered }}
              accessibilityLabel={`${o}${right ? ', risposta corretta' : wrong ? ', risposta sbagliata' : ''}`}
              disabled={answered}
              onPress={() => onPick(i)}
              android_ripple={{ color: c.inkSoft }}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
            >
              <Txt variant="body" style={{ flex: 1 }}>
                {o}
              </Txt>
              {right ? <MaterialCommunityIcons name="check-circle" size={22} color={c.success} /> : null}
              {wrong ? <MaterialCommunityIcons name="close-circle" size={22} color={c.danger} /> : null}
            </Pressable>
          );
        })}
      </View>
      {answered ? (
        <View style={{ gap: space.sm }} testID="quiz-feedback">
          <Txt variant="bodyStrong" color={picked === q.answer ? 'success' : 'danger'}>
            {picked === q.answer ? 'Esatto!' : 'Non è corretto.'}
          </Txt>
          {q.explanation ? (
            <Txt variant="small" color="textMuted">
              {q.explanation}
            </Txt>
          ) : null}
          <Button
            kind="quiet"
            icon="book-open-page-variant-outline"
            label={`Lezione ${q.source.lesson}.${q.source.paragraph}: ${q.source.title}`}
            onPress={() =>
              router.push({
                pathname: '/transcript/[code]/[n]',
                params: { code: q.source.courseCode, n: String(q.source.lesson) },
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function Summary({
  score,
  total,
  missed,
  onRetryMissed,
  onNew,
}: {
  score: number;
  total: number;
  missed: QuizQuestion[];
  onRetryMissed: () => void;
  onNew: (() => void) | undefined;
}) {
  const c = usePalette();
  const pct = Math.round((score / total) * 100);
  return (
    <Screen testID="quiz-summary">
      <View style={{ gap: space.sm, alignItems: 'center', paddingVertical: space.xl }}>
        <MaterialCommunityIcons
          name={pct >= 80 ? 'trophy-outline' : pct >= 50 ? 'thumb-up-outline' : 'book-refresh-outline'}
          size={48}
          color={c.ink}
        />
        <Txt variant="title">
          {score} su {total}
        </Txt>
        <Txt variant="body" color="textMuted" style={{ textAlign: 'center' }}>
          {pct >= 80
            ? 'Ottimo lavoro!'
            : pct >= 50
              ? 'Buona base: ripassa gli errori.'
              : 'Rileggi la lezione e riprova.'}
        </Txt>
      </View>
      <View style={{ gap: space.sm }}>
        {missed.length ? (
          <Button
            testID="quiz-retry-missed"
            label={`Ripeti ${plural(missed.length, 'errore', 'errori')}`}
            icon="restart"
            onPress={onRetryMissed}
          />
        ) : null}
        {onNew ? (
          <Button
            testID="quiz-new"
            kind="secondary"
            label="Nuovo quiz"
            icon="shuffle-variant"
            onPress={onNew}
          />
        ) : null}
        <Button kind="quiet" label="Fine" onPress={() => router.back()} />
        <Txt variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
          Le domande entrano nella tua banca personale: le ritrovi in Esercitazioni, al momento giusto per
          ripassarle.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
  passage: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
});
