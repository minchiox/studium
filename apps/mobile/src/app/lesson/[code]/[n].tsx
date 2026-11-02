import { formatDuration } from '@studium/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ErrorState, Group, Loading, Pill, Row, Screen, Section, Txt } from '@/components/ui';
import { api, useLesson } from '@/lib/api';
import { getHandout, handoutFile, openFile } from '@/lib/files';
import { loadAi } from '@/lib/quiz';
import { space, usePalette } from '@/lib/theme';

export default function LessonScreen() {
  const c = usePalette();
  const { code, n } = useLocalSearchParams<{ code: string; n: string }>();
  const q = useLesson(code, Number(n));
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const l = q.data;

  useEffect(() => {
    void loadAi().then((s) => setAi(!!s?.hasKey));
  }, []);

  if (!l) return q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <Loading />;

  const offline = handoutFile(code, l).exists;
  const watchUrl = api().watchUrl(code, l.lpId);

  return (
    <>
      <Stack.Screen options={{ title: `Lezione ${l.number}` }} />
      <Screen testID="lesson">
        <View style={{ gap: space.xs }}>
          <Txt variant="title">{l.title}</Txt>
          {l.teacher ? (
            <Txt variant="small" color="textMuted">
              {l.teacher}
            </Txt>
          ) : null}
        </View>

        {l.objectives ? (
          <Section title="Obiettivi">
            <Txt variant="reading">{l.objectives}</Txt>
          </Section>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Button
            testID="lesson-watch"
            label="Guarda sulla piattaforma"
            icon="play-circle-outline"
            onPress={() => router.push({ pathname: '/watch', params: { url: watchUrl, title: l.title } })}
          />
          <Txt variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
            Si apre il player ufficiale: la frequenza la registra la piattaforma mentre guardi.
          </Txt>
          <Button
            testID="lesson-transcript"
            kind="secondary"
            label="Leggi la trascrizione"
            icon="text-box-outline"
            disabled={!l.paragraphs.some((p) => p.vttUrl)}
            onPress={() =>
              router.push({ pathname: '/transcript/[code]/[n]', params: { code, n: String(l.number) } })
            }
          />
          <Button
            testID="lesson-handout"
            kind="secondary"
            label={
              l.dispensaUrl
                ? offline
                  ? 'Apri la dispensa (offline)'
                  : 'Scarica e apri la dispensa'
                : 'Nessuna dispensa'
            }
            icon="file-pdf-box"
            busy={busy}
            disabled={!l.dispensaUrl}
            onPress={async () => {
              setFileError(null);
              setBusy(true);
              try {
                await openFile(await getHandout(code, l));
              } catch (e) {
                setFileError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            testID="lesson-quiz"
            kind="secondary"
            label="Esercitati con un quiz"
            icon="head-question-outline"
            disabled={!l.paragraphs.some((p) => p.vttUrl)}
            onPress={() =>
              router.push({ pathname: '/quiz', params: { mode: 'lesson', code, n: String(l.number) } })
            }
          />
          {ai ? (
            <Button
              testID="lesson-quiz-ai"
              kind="secondary"
              label="Quiz con l’IA"
              icon="creation-outline"
              disabled={!l.paragraphs.some((p) => p.vttUrl)}
              onPress={() =>
                router.push({
                  pathname: '/quiz',
                  params: { mode: 'lesson', code, n: String(l.number), engine: 'ai' },
                })
              }
            />
          ) : null}
          {fileError ? (
            <Txt variant="small" color="danger" testID="lesson-file-error">
              {fileError}
            </Txt>
          ) : null}
        </View>

        <Section title="Paragrafi">
          <Group>
            {l.paragraphs.map((p) => {
              const done = (p.progress ?? 0) >= 100;
              return (
                <Row
                  key={p.number}
                  testID={`paragraph-${p.number}`}
                  title={`${l.number}.${p.number} ${p.title}`}
                  subtitle={`${formatDuration(p.durationS)}${done ? ', visto' : p.progress ? `, visto al ${p.progress}%` : ''}`}
                  icon={done ? 'check-circle' : 'circle-outline'}
                  iconColor={done ? 'success' : 'textMuted'}
                  right={p.videoUrl ? <Pill label="Ripasso" /> : null}
                  onPress={
                    p.videoUrl
                      ? () =>
                          router.push({
                            pathname: '/review',
                            params: {
                              url: p.videoUrl as string,
                              title: `${l.number}.${p.number} ${p.title}`,
                            },
                          })
                      : undefined
                  }
                />
              );
            })}
          </Group>
          <Txt variant="caption" color="textMuted">
            Il ripasso riproduce il video nell’app e non conta per la frequenza.
          </Txt>
        </Section>

        {l.selfTest ? (
          <View style={[styles.test, { backgroundColor: c.surfaceAlt }]}>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {l.selfTest.title}
            </Txt>
            <Pill
              label={(l.selfTest.progress ?? 0) >= 100 ? 'Fatto' : 'Da fare sulla piattaforma'}
              tone={(l.selfTest.progress ?? 0) >= 100 ? 'success' : 'neutral'}
            />
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  test: { borderRadius: 12, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
