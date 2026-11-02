import { bankStats, type QuizQuestion } from '@studium/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Group, Pill, Progress, Row, Screen, Section, Txt } from '@/components/ui';
import { useCourses } from '@/lib/api';
import { library } from '@/lib/files';
import { plural } from '@/lib/format';
import { type Bank, loadAi, loadBank } from '@/lib/quiz';
import { space, usePalette } from '@/lib/theme';

/** The personal question bank: review queue, per-course progress, quizzes on downloaded courses. */
export default function Practice() {
  const c = usePalette();
  const titles = Object.fromEntries((useCourses().data ?? []).map((x) => [x.code, x.title]));
  const [bank, setBank] = useState<Bank | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const downloaded = library();

  useFocusEffect(
    useCallback(() => {
      void loadBank().then((b) => setBank({ ...b }));
      void loadAi().then((s) => setAi(s?.hasKey ? s.model : null));
    }, []),
  );

  const all: QuizQuestion[] = bank ? Object.values(bank.questions) : [];
  const stats = bank ? bankStats(all, bank.states) : null;
  const byCourse = new Map<string, QuizQuestion[]>();
  for (const q of all) byCourse.set(q.source.courseCode, [...(byCourse.get(q.source.courseCode) ?? []), q]);

  return (
    <Screen testID="practice">
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Txt variant="small" color="textMuted">
          Ripasso di oggi
        </Txt>
        <Txt variant="title" testID="practice-due">
          {stats ? plural(stats.due, 'domanda', 'domande') : '—'}
        </Txt>
        <Txt variant="small" color="textMuted">
          {stats?.seen
            ? `${stats.mastered} di ${stats.seen} padroneggiate${stats.accuracy !== null ? `, ${stats.accuracy}% di risposte corrette` : ''}`
            : 'Fai un quiz su una lezione: le domande entrano qui e tornano al momento giusto.'}
        </Txt>
        <Button
          testID="practice-review"
          label="Ripassa ora"
          icon="cards-outline"
          disabled={!stats?.due}
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'review' } })}
        />
      </View>

      {byCourse.size && bank ? (
        <Section title="La tua banca">
          <Group>
            {[...byCourse].map(([code, qs]) => {
              const s = bankStats(qs, bank.states);
              return (
                <Row
                  key={code}
                  title={titles[code] ?? code}
                  subtitle={`${plural(s.total, 'domanda', 'domande')}, ${s.mastered} padroneggiate`}
                  icon="cards-outline"
                  right={s.due ? <Pill label={`${s.due} da ripassare`} tone="ink" /> : undefined}
                  onPress={() => router.push({ pathname: '/quiz', params: { mode: 'review', code } })}
                />
              );
            })}
          </Group>
        </Section>
      ) : null}

      <Section title="Quiz sui corsi scaricati">
        {downloaded.length ? (
          <Group>
            {downloaded.map((d) => (
              <Row
                key={d.code}
                testID={`practice-course-${d.code}`}
                title={titles[d.code] ?? d.code}
                subtitle={plural(d.transcripts, 'lezione scaricata', 'lezioni scaricate')}
                icon="head-question-outline"
                disabled={!d.transcripts}
                onPress={() => router.push({ pathname: '/quiz', params: { mode: 'course', code: d.code } })}
              />
            ))}
          </Group>
        ) : (
          <Txt variant="small" color="textMuted">
            Scarica un corso offline dalla sua pagina per fare quiz su tutte le lezioni. Per una lezione sola
            usa “Esercitati” nella pagina della lezione.
          </Txt>
        )}
      </Section>

      <Group>
        <Row
          testID="practice-ai"
          title="Quiz con l’IA"
          subtitle={ai ? `Attivo: ${ai}` : 'Facoltativo: usa la tua chiave di un provider compatibile OpenAI'}
          icon="creation-outline"
          onPress={() => router.push('/ai-settings')}
        />
      </Group>
      {stats?.seen ? (
        <Progress value={(stats.mastered / Math.max(1, stats.total)) * 100} tone="success" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.sm },
});
