import { computeProgress, formatDuration } from '@studium/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Group, Pill, Progress, QueryView, Row, Screen, Section, Txt } from '@/components/ui';
import { useCourses, useLessons } from '@/lib/api';
import { type CourseDownloadProgress, downloadCourse } from '@/lib/files';
import { humanDuration, plural } from '@/lib/format';
import { space, usePalette } from '@/lib/theme';

export default function CourseScreen() {
  const c = usePalette();
  const { code, title } = useLocalSearchParams<{ code: string; title?: string }>();
  const course = useCourses().data?.find((x) => x.code === code);
  const q = useLessons(code);
  const [dl, setDl] = useState<CourseDownloadProgress | null>(null);
  const [dlDone, setDlDone] = useState<CourseDownloadProgress | null>(null);

  const name = course?.title ?? title ?? code;

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID="course">
        <QueryView query={q} loading="Carico le lezioni…">
          {(lessons) => {
            const p = computeProgress(lessons);
            const next = p.pending[0];
            return (
              <>
                <View style={[styles.head, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Txt variant="title">{name}</Txt>
                  <Txt variant="small" color="textMuted">
                    {[
                      course?.cfu ? `${course.cfu} CFU` : null,
                      lessons[0]?.teacher,
                      plural(lessons.length, 'lezione', 'lezioni'),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Txt>
                  <View style={{ gap: space.sm, marginTop: space.sm }}>
                    <View style={styles.spread}>
                      <Txt variant="bodyStrong">Videolezioni viste: {p.videoPercent}%</Txt>
                      <Txt variant="small" color="textMuted">
                        {p.remainingS ? `mancano ${humanDuration(p.remainingS)}` : 'complete'}
                      </Txt>
                    </View>
                    <Progress value={p.videoPercent} />
                    {p.selfTestsPending.length ? (
                      <Txt variant="small" color="textMuted">
                        {plural(
                          p.selfTestsPending.length,
                          'test di autovalutazione da fare',
                          'test di autovalutazione da fare',
                        )}
                      </Txt>
                    ) : null}
                  </View>
                  <View style={styles.actions}>
                    {next ? (
                      <Button
                        testID="course-continue"
                        label={`Continua dalla lezione ${next.number}`}
                        icon="play-circle-outline"
                        onPress={() =>
                          router.push({
                            pathname: '/lesson/[code]/[n]',
                            params: { code, n: String(next.number) },
                          })
                        }
                      />
                    ) : null}
                    <Button
                      testID="course-download"
                      kind="secondary"
                      icon="download-outline"
                      busy={!!dl}
                      label={dl ? `Scarico ${dl.done}/${dl.total}` : 'Scarica dispense e trascrizioni'}
                      onPress={async () => {
                        setDlDone(null);
                        const res = await downloadCourse(code, lessons, setDl);
                        setDl(null);
                        setDlDone(res);
                      }}
                    />
                    <Button
                      testID="course-quiz"
                      kind="secondary"
                      icon="head-question-outline"
                      label="Quiz sul corso"
                      onPress={() => router.push({ pathname: '/quiz', params: { mode: 'course', code } })}
                    />
                    {dlDone ? (
                      <Txt
                        variant="small"
                        color={dlDone.failed ? 'danger' : 'success'}
                        testID="course-download-result"
                      >
                        {dlDone.failed
                          ? `Scaricate ${dlDone.done - dlDone.failed} lezioni su ${dlDone.total}: riprova per le altre.`
                          : 'Tutto disponibile offline.'}
                      </Txt>
                    ) : null}
                  </View>
                </View>

                <Section title="Lezioni">
                  <Group>
                    {lessons.map((l) => {
                      const dur = l.paragraphs.reduce((s, x) => s + x.durationS, 0);
                      const watched =
                        l.paragraphs.length > 0 && l.paragraphs.every((x) => (x.progress ?? 0) >= 100);
                      return (
                        <Row
                          key={l.lpId}
                          testID={`lesson-${l.number}`}
                          title={`${l.number}. ${l.title}`}
                          subtitle={`${plural(l.paragraphs.length, 'paragrafo', 'paragrafi')}, ${formatDuration(dur)}`}
                          icon={watched ? 'check-circle' : 'circle-outline'}
                          iconColor={watched ? 'success' : 'textMuted'}
                          right={
                            !watched && (l.progress ?? 0) > 0 ? (
                              <Pill label={`${l.progress}%`} tone="ink" />
                            ) : null
                          }
                          onPress={() =>
                            router.push({
                              pathname: '/lesson/[code]/[n]',
                              params: { code, n: String(l.number) },
                            })
                          }
                        />
                      );
                    })}
                  </Group>
                </Section>
              </>
            );
          }}
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.xs },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  actions: { gap: space.sm, marginTop: space.lg },
});
