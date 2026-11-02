import { MaterialCommunityIcons } from '@expo/vector-icons';
import { bankStats, careerStats, closingSoon } from '@studium/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Group, Marked, Pill, Progress, Row, Screen, Section, Txt } from '@/components/ui';
import { useAgenda, useCareer, useCourses, useExams, useStudent, useUnreadNotices } from '@/lib/api';
import { formatAverage, formatDay, formatTime, plural, relativeDay } from '@/lib/format';
import { KIND_LABEL } from '@/lib/labels';
import { loadBank } from '@/lib/quiz';
import { syncReminders } from '@/lib/reminders';
import { space, type, usePalette } from '@/lib/theme';
import { buildTodo, type TodoItem } from '@/lib/todo';

export default function Home() {
  const c = usePalette();
  const qc = useQueryClient();
  const student = useStudent();
  const career = useCareer();
  const courses = useCourses();
  const agenda = useAgenda();
  const unread = useUnreadNotices().data ?? 0;
  const exams = useExams();
  const [refreshing, setRefreshing] = useState(false);
  const [due, setDue] = useState(0);

  useEffect(() => {
    if (agenda.data)
      void syncReminders(agenda.data, exams.data ? closingSoon(exams.data.courses) : undefined);
  }, [agenda.data, exams.data]);

  useFocusEffect(
    useCallback(() => {
      void loadBank().then((b) => setDue(bankStats(Object.values(b.questions), b.states).due));
    }, []),
  );

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  };

  const titles = Object.fromEntries((courses.data ?? []).map((x) => [x.code, x.title]));
  const todo = buildTodo({ exams: exams.data, courses: courses.data, dueReviews: due, titles });
  const stats = career.data ? careerStats(career.data) : null;
  const next = (agenda.data ?? []).slice(0, 3);
  const firstError = [student, career, courses].find((q) => q.error && !q.data)?.error;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              testID="home-notices"
              accessibilityRole="button"
              accessibilityLabel={
                unread ? plural(unread, 'avviso da leggere', 'avvisi da leggere') : 'Avvisi'
              }
              onPress={() => router.push('/notices')}
              hitSlop={8}
              style={styles.bell}
            >
              <MaterialCommunityIcons name="bell-outline" size={24} color={c.text} />
              {unread ? (
                <View style={[styles.badge, { backgroundColor: c.danger }]}>
                  <Text style={[type.caption, styles.badgeText]}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </Pressable>
          ),
        }}
      />
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

        {todo.length ? <Todo items={todo} /> : null}

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

        <Group>
          <Row
            testID="home-practice"
            title="Esercitazioni"
            subtitle={
              due ? `${plural(due, 'domanda', 'domande')} da ripassare` : 'Quiz sulle lezioni e ripasso'
            }
            icon="head-question-outline"
            onPress={() => router.push('/practice')}
          />
          <Row
            title="Cerca nelle trascrizioni"
            subtitle="Trova un concetto in tutte le lezioni scaricate"
            icon="magnify"
            onPress={() => router.push('/search')}
          />
        </Group>
      </Screen>
    </>
  );
}

/** The next things to do. The first, when it is due today, carries the highlighter. */
function Todo({ items }: { items: TodoItem[] }) {
  const c = usePalette();
  const [first, ...rest] = items;
  if (!first) return null;
  return (
    <Section title="Da fare">
      <Pressable
        testID={`todo-${first.id}`}
        accessibilityRole="button"
        accessibilityLabel={[first.title, first.subtitle].filter(Boolean).join(', ')}
        onPress={() => router.push(first.href)}
        android_ripple={{ color: c.inkSoft }}
        style={[
          styles.focus,
          { backgroundColor: c.surface, borderColor: first.urgent ? c.highlight : c.border },
        ]}
      >
        <MaterialCommunityIcons name={first.icon} size={26} color={c.ink} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt variant="heading">
            {first.urgent ? (
              // Inline background: highlights line by line, like a real highlighter on a wrapped title.
              <Text style={{ backgroundColor: c.highlight, color: c.onHighlight }}>{` ${first.title} `}</Text>
            ) : (
              first.title
            )}
          </Txt>
          {first.subtitle ? (
            <Txt variant="small" color="textMuted">
              {first.subtitle}
            </Txt>
          ) : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted} />
      </Pressable>
      {rest.length ? (
        <Group>
          {rest.map((t) => (
            <Row
              key={t.id}
              testID={`todo-${t.id}`}
              title={t.title}
              subtitle={t.subtitle}
              icon={t.icon}
              right={t.urgent ? <Pill label="Oggi" tone="highlight" /> : undefined}
              onPress={() => router.push(t.href)}
            />
          ))}
        </Group>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  figures: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.xl },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  notice: { borderRadius: 12, padding: space.md, flexDirection: 'row' },
  focus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 18,
    borderWidth: 2,
    padding: space.lg,
  },
  // Fixed box with the badge inside it: the header clips anything drawn outside its bounds.
  bell: {
    width: 56,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 6,
    marginRight: space.xs,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontFamily: 'Figtree_700Bold' },
});
