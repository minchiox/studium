import { type Course, formatVote } from '@studium/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Empty, Group, Pill, Progress, QueryView, Row, Screen, Section } from '@/components/ui';
import { useCourses } from '@/lib/api';
import { space } from '@/lib/theme';

const YEAR = ['Primo anno', 'Secondo anno', 'Terzo anno', 'Quarto anno', 'Quinto anno', 'Sesto anno'];

function status(c: Course) {
  if (c.exam?.passed)
    return <Pill label={c.exam.vote ? `Superato, ${formatVote(c.exam.vote)}` : 'Superato'} tone="success" />;
  if (c.progress !== null && c.progress >= 100) return <Pill label="Lezioni viste" tone="ink" />;
  return null;
}

export default function Courses() {
  const q = useCourses();
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID="courses">
      <QueryView query={q} loading="Carico il piano di studi…">
        {(courses) => {
          if (!courses.length)
            return <Empty icon="book-outline" title="Nessun corso" body="Il piano di studi è vuoto." />;
          const groups = new Map<string, Course[]>();
          for (const c of courses) {
            const k = c.year ? (YEAR[c.year - 1] ?? `Anno ${c.year}`) : 'Altri corsi';
            groups.set(k, [...(groups.get(k) ?? []), c]);
          }
          return [...groups].map(([title, list]) => (
            <Section key={title} title={title}>
              <Group>
                {list.map((c) => (
                  <View key={c.code}>
                    <Row
                      testID={`course-${c.code}`}
                      title={c.title}
                      subtitle={[
                        c.cfu ? `${c.cfu} CFU` : null,
                        c.progress !== null
                          ? `${c.progress}% visto`
                          : c.exam?.passed
                            ? null
                            : 'Lezioni non iniziate',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      right={status(c)}
                      onPress={() =>
                        router.push({ pathname: '/course/[code]', params: { code: c.code, title: c.title } })
                      }
                    />
                    {c.progress !== null && c.progress < 100 ? (
                      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, marginTop: -6 }}>
                        <Progress value={c.progress} height={4} />
                      </View>
                    ) : null}
                  </View>
                ))}
              </Group>
            </Section>
          ));
        }}
      </QueryView>
    </Screen>
  );
}
