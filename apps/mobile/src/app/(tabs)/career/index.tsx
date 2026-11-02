import { careerStats, formatVote } from '@studium/core';
import { StyleSheet, View } from 'react-native';
import { Group, Marked, Pill, Progress, QueryView, Row, Screen, Section, Txt } from '@/components/ui';
import { useCareer } from '@/lib/api';
import { formatAverage, formatDate } from '@/lib/format';
import { elevation, space, usePalette } from '@/lib/theme';

const YEAR = ['Primo anno', 'Secondo anno', 'Terzo anno', 'Quarto anno', 'Quinto anno', 'Sesto anno'];

export default function CareerScreen() {
  const c = usePalette();
  const q = useCareer();
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID="career">
      <QueryView query={q} loading="Carico il libretto…">
        {(career) => {
          const s = careerStats(career);
          return (
            <>
              <View
                style={[
                  styles.summary,
                  { backgroundColor: c.surface, borderColor: c.border },
                  elevation(c, 1),
                ]}
              >
                <View style={{ gap: space.xs }}>
                  <Txt variant="small" color="textMuted">
                    Media ponderata
                  </Txt>
                  {s.weightedAverage ? (
                    <Marked>{formatAverage(s.weightedAverage)}</Marked>
                  ) : (
                    <Txt variant="heading">Nessun voto registrato</Txt>
                  )}
                </View>
                <View style={styles.grid}>
                  <Figure label="Media aritmetica" value={formatAverage(s.arithmeticAverage)} />
                  <Figure
                    label="Base di laurea stimata"
                    value={s.graduationBase ? `${formatAverage(s.graduationBase)}/110` : '—'}
                  />
                  <Figure label="Esami superati" value={`${s.passedExams} di ${s.totalExams}`} />
                  <Figure label="CFU" value={`${s.acquiredCfu} di ${s.requiredCfu}`} />
                </View>
                <Progress value={s.cfuPercent} tone="success" height={8} />
                <Txt variant="caption" color="textMuted">
                  Calcolata sui voti registrati, con il 30 e lode contato come 30.
                  {career.summary.platformWeightedAverage
                    ? ` Media pubblicata dalla piattaforma: ${formatAverage(career.summary.platformWeightedAverage)}.`
                    : ''}{' '}
                  Fa fede la segreteria.
                </Txt>
              </View>

              {career.years.map((y) => (
                <Section key={y.year} title={YEAR[y.year - 1] ?? `Anno ${y.year}`}>
                  <Group>
                    {y.exams.map((e) => (
                      <Row
                        key={`${e.code}-${e.title}`}
                        testID={`exam-${e.code}`}
                        title={e.title}
                        subtitle={[
                          `${e.requiredCfu} CFU`,
                          e.ssd,
                          e.optional ? 'a scelta' : null,
                          e.passed && e.date ? formatDate(e.date) : null,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                        right={
                          e.passed ? (
                            <View style={[styles.vote, { borderColor: c.success }]}>
                              <Txt variant="heading" style={{ color: c.success }}>
                                {e.vote ? formatVote(e.vote) : 'OK'}
                              </Txt>
                            </View>
                          ) : (
                            <Pill label={capitalize(e.statusLabel)} />
                          )
                        }
                      />
                    ))}
                  </Group>
                </Section>
              ))}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const capitalize = (s: string) => (s === '—' ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: space.sm, gap: 2 }}>
      <Txt variant="caption" color="textMuted">
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // A grade sits in a circle, like the stamp in a paper libretto.
  vote: {
    minWidth: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
