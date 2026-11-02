import {
  type BookableCourse,
  type ExamBooking,
  type ExamOffer,
  offerLocations,
  offersAt,
  preferredLocation,
  wallClock,
} from '@studium/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Empty, Group, Pill, QueryView, Row, Screen, Section, Txt } from '@/components/ui';
import { api, useCourses, useExams } from '@/lib/api';
import { loadExamSeat } from '@/lib/examSeat';
import { formatDate, formatDay, formatTime, plural, relativeDay } from '@/lib/format';
import { offerStatus } from '@/lib/labels';
import { space } from '@/lib/theme';

const SHOWN = 3;

const openOfficial = (page: 'exams' | 'results') =>
  router.push({
    pathname: '/official',
    params: {
      url: api().officialPage(page),
      title: page === 'exams' ? 'Prenotazione esami' : 'Conferma esiti',
    },
  });

/** Exam bookings, bookable sessions at the student's seat, results to confirm. Booking is official-only. */
export default function Exams() {
  const q = useExams();
  const titles = Object.fromEntries((useCourses().data ?? []).map((c) => [c.code, c.title]));
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      void loadExamSeat().then(setStored);
    }, []),
  );

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID="exams">
      <QueryView query={q} loading="Carico appelli e prenotazioni…">
        {(o) => {
          const seat = stored === undefined ? preferredLocation(o.bookings) : stored;
          return (
            <>
              {o.toConfirm > 0 ? (
                <Group>
                  <Row
                    testID="exams-results"
                    title={plural(o.toConfirm, 'esito da confermare', 'esiti da confermare')}
                    subtitle="Accetta o rifiuta il voto sulla pagina ufficiale"
                    icon="clipboard-check-outline"
                    iconColor="danger"
                    onPress={() => openOfficial('results')}
                  />
                </Group>
              ) : null}

              <Section title="Prenotati">
                {o.bookings.length ? (
                  <Group>
                    {o.bookings.map((b) => (
                      <BookingRow key={b.id} b={b} title={titles[b.courseCode] ?? b.courseCode} />
                    ))}
                  </Group>
                ) : (
                  <Txt variant="small" color="textMuted">
                    Nessun esame prenotato.
                  </Txt>
                )}
              </Section>

              <Section
                title="Appelli prenotabili"
                action={
                  <Button
                    kind="quiet"
                    icon="map-marker-outline"
                    label={seat ?? 'Tutte le sedi'}
                    testID="exams-seat"
                    onPress={() =>
                      router.push({
                        pathname: '/exam-seat',
                        params: { locations: JSON.stringify(offerLocations(o.courses)), current: seat ?? '' },
                      })
                    }
                  />
                }
              >
                <OfferList
                  courses={o.courses}
                  seat={seat}
                  expanded={expanded}
                  onToggle={(code) =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(code)) n.delete(code);
                      else n.add(code);
                      return n;
                    })
                  }
                />
              </Section>

              <View style={{ gap: space.sm }}>
                <Button
                  label="Prenota sulla pagina ufficiale"
                  icon="calendar-check-outline"
                  testID="exams-book"
                  onPress={() => openOfficial('exams')}
                />
                <Txt variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
                  Studium non prenota al posto tuo: prenotazioni e cancellazioni si fanno sulla pagina
                  ufficiale dell’ateneo, che si apre qui nell’app.
                </Txt>
              </View>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function BookingRow({ b, title }: { b: ExamBooking; title: string }) {
  const at = wallClock(b.date, b.start);
  return (
    <Row
      testID={`exams-booking-${b.id}`}
      title={title}
      subtitle={[
        `${formatDay(at)}${b.start ? `, ${formatTime(at)}` : ''}${b.end ? `–${b.end}` : ''}`,
        b.type ?? (b.online ? 'Online' : null),
        b.location ? `sede di ${b.location}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      icon="calendar-check"
      iconColor="success"
      right={<Pill label={relativeDay(at)} tone="success" />}
    />
  );
}

function OfferList({
  courses,
  seat,
  expanded,
  onToggle,
}: {
  courses: BookableCourse[];
  seat: string | null;
  expanded: Set<string>;
  onToggle: (code: string) => void;
}) {
  const now = Date.now();
  const rows = useMemo(
    () =>
      courses.map((c) => ({ course: c, offers: offersAt(c, seat, now) })).filter((r) => r.offers.length > 0),
    [courses, seat, now],
  );
  if (!rows.length)
    return (
      <Empty
        icon="calendar-search"
        title="Nessun appello prenotabile"
        body={
          seat
            ? `Nessun appello aperto nella sede di ${seat}. Prova con “Tutte le sedi”.`
            : 'Al momento non ci sono appelli aperti per i tuoi corsi.'
        }
      />
    );
  return (
    <View style={{ gap: space.lg }}>
      {rows.map(({ course, offers }) => {
        const open = expanded.has(course.code);
        const shown = open ? offers : offers.slice(0, SHOWN);
        return (
          <View key={course.code} style={{ gap: space.xs }} testID={`exams-course-${course.code}`}>
            <Txt variant="bodyStrong">{course.title}</Txt>
            <Group>
              {shown.map((o) => (
                <OfferRow key={o.id} o={o} showPlace={!seat} />
              ))}
              {offers.length > SHOWN ? (
                <Row
                  title={open ? 'Mostra meno' : `Altri ${offers.length - SHOWN} appelli`}
                  icon={open ? 'chevron-up' : 'chevron-down'}
                  chevron={false}
                  onPress={() => onToggle(course.code)}
                />
              ) : null}
            </Group>
          </View>
        );
      })}
    </View>
  );
}

function OfferRow({ o, showPlace }: { o: ExamOffer; showPlace: boolean }) {
  const at = wallClock(o.date, o.start);
  const status = offerStatus(o);
  const deadline = o.closesOn ? `prenoti fino al ${formatDate(o.closesOn).replace(/ \d{4}$/, '')}` : null;
  return (
    <Row
      testID={`exams-offer-${o.courseCode}-${o.date}`}
      title={`${capitalize(formatDay(at))}${o.start ? `, ${formatTime(at)}` : ''}`}
      subtitle={[o.type, showPlace ? o.location : null, deadline].filter(Boolean).join(', ')}
      right={<Pill label={status.label} tone={status.tone} />}
      onPress={() => openOfficial('exams')}
      chevron={false}
    />
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
