import { careerStats, closingSoon } from '@studium/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Group, Marked, Pill, Progress, Row, Screen, Section, Txt } from '@/components/ui';
import { useAgenda, useCareer, useCourses, useExams, useStudent, useUnreadNotices } from '@/lib/api';
import { formatAverage, formatDate, formatDay, formatTime, plural, relativeDay } from '@/lib/format';
import { KIND_LABEL } from '@/lib/labels';
import { syncReminders } from '@/lib/reminders';
import { space, usePalette } from '@/lib/theme';

export default function Home() {
  const c = usePalette();
  const qc = useQueryClient();
  const student = useStudent();
  const career = useCareer();
  const courses = useCourses();
  const agenda = useAgenda();
  const unread = useUnreadNotices();
  const exams = useExams();
  const [refreshing, setRefreshing] = useState(false);
  const closing = exams.data ? closingSoon(exams.data.courses) : [];

  useEffect(() => {
    if (agenda.data)
      void syncReminders(agenda.data, exams.data ? closingSoon(exams.data.courses) : undefined);
  }, [agenda.data, exams.data]);

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  };

  const stats = career.data ? careerStats(career.data) : null;
  const studying = (courses.data ?? [])
    .filter((x) => x.progress !== null && x.progress < 100 && !x.exam?.passed)
    .sort((a, b) => (b.lastWatched?.at ?? '').localeCompare(a.lastWatched?.at ?? ''))
    .slice(0, 4);
  const next = (agenda.data ?? []).slice(0, 3);
  const firstError = [student, career, courses].find((q) => q.error && !q.data)?.error;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="home">
      <View style={{ gap: 2 }}>
        <Txt variant="title">{student.data?.firstName ? `Ciao, ${student.data.firstName}` : 'Ciao'}</Txt>
        {student.data?.degree ? (
          <Txt variant="small" color="textMuted">
            {student.data.degree}
          </Txt>
        ) : null}
      </View>

      {firstError ? (
        <View style={[styles.notice, { backgroundColor: c.dangerSoft }]}>
          <Txt variant="small" style={{ color: c.danger, flex: 1 }}>
            Non riesco ad aggiornare i dati. Tira giù per riprovare.
          </Txt>
        </View>
      ) : null}

      <View
        style={[styles.figures, { backgroundColor: c.surface, borderColor: c.border }]}
        testID="home-figures"
      >
        <View style={{ gap: space.xs }}>
          <Txt variant="small" color="textMuted">
            Media ponderata
          </Txt>
          {stats?.weightedAverage ? (
            <Marked>{formatAverage(stats.weightedAverage)}</Marked>
          ) : (
            <Txt variant="heading">{stats ? 'Ancora nessun voto' : '—'}</Txt>
          )}
        </View>
        <View style={{ gap: space.sm }}>
          <View style={styles.spread}>
            <Txt variant="bodyStrong">
              {stats ? `${stats.acquiredCfu} di ${stats.requiredCfu} CFU` : 'CFU'}
            </Txt>
            <Txt variant="small" color="textMuted">
              {stats ? plural(stats.passedExams, 'esame superato', 'esami superati') : ''}
            </Txt>
          </View>
          <Progress value={stats?.cfuPercent ?? 0} tone="success" height={8} />
        </View>
      </View>

      <Section
        title="Prossimi impegni"
        action={
          <Button kind="quiet" label="Agenda" onPress={() => router.push('/agenda')} testID="home-agenda" />
        }
      >
        {next.length ? (
          <Group>
            {next.map((a) => (
              <Row
                key={a.id}
                title={a.title}
                subtitle={`${formatDay(a.startsAt)}, ${formatTime(a.startsAt)} (${relativeDay(a.startsAt)})`}
                icon={a.kind === 'live' ? 'video-outline' : 'pencil-box-outline'}
                right={<Pill label={KIND_LABEL[a.kind].label} tone={KIND_LABEL[a.kind].tone} />}
                onPress={() => router.push('/agenda')}
                chevron={false}
              />
            ))}
          </Group>
        ) : (
          <Txt variant="small" color="textMuted">
            {agenda.isPending ? 'Caricamento…' : 'Nessun esame o lezione live in programma.'}
          </Txt>
        )}
      </Section>

      {closing.length || exams.data?.toConfirm ? (
        <Group>
          {exams.data?.toConfirm ? (
            <Row
              testID="home-results"
              title={plural(exams.data.toConfirm, 'esito da confermare', 'esiti da confermare')}
              subtitle="Accetta o rifiuta il voto"
              icon="clipboard-check-outline"
              iconColor="danger"
              onPress={() => router.push('/exams')}
            />
          ) : null}
          {closing.length ? (
            <Row
              testID="home-closing"
              title="Prenotazioni in chiusura"
              subtitle={closing
                .slice(0, 2)
                .map((o) => `${o.courseTitle}: entro il ${formatDate(o.closesOn).replace(/ \d{4}$/, '')}`)
                .concat(closing.length > 2 ? [`e altri ${closing.length - 2}`] : [])
                .join('\n')}
              icon="calendar-alert"
              iconColor="danger"
              onPress={() => router.push('/exams')}
            />
          ) : null}
        </Group>
      ) : null}

      <Section title="Riprendi a studiare">
        {studying.length ? (
          <Group>
            {studying.map((x) => (
              <Row
                key={x.code}
                testID={`home-course-${x.code}`}
                title={x.title}
                subtitle={`${x.progress}% delle videolezioni`}
                icon="book-open-page-variant-outline"
                onPress={() => router.push({ pathname: '/course/[code]', params: { code: x.code } })}
              />
            ))}
          </Group>
        ) : (
          <Txt variant="small" color="textMuted">
            {courses.isPending
              ? 'Caricamento…'
              : 'Nessun corso in corso. Trovi tutto il piano di studi in Corsi.'}
          </Txt>
        )}
      </Section>

      <Group>
        <Row
          title="Avvisi"
          subtitle={
            unread.data
              ? plural(unread.data, 'avviso da leggere', 'avvisi da leggere')
              : 'Comunicazioni dell’ateneo'
          }
          icon="bell-outline"
          onPress={() => router.navigate('/notices')}
        />
        <Row
          title="Cerca nelle trascrizioni"
          subtitle="Trova un concetto in tutte le lezioni scaricate"
          icon="magnify"
          onPress={() => router.push('/search')}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  figures: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.xl },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  notice: { borderRadius: 12, padding: space.md, flexDirection: 'row' },
});
