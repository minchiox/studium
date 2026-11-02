import type { AgendaItem } from '@studium/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Empty, Group, Pill, QueryView, Row, Screen, Section, Txt } from '@/components/ui';
import { useAgenda } from '@/lib/api';
import { formatLongDay, formatTime, relativeDay } from '@/lib/format';
import { KIND_LABEL } from '@/lib/labels';
import { remindersEnabled, setRemindersEnabled, syncReminders } from '@/lib/reminders';
import { space, usePalette } from '@/lib/theme';

export default function Agenda() {
  const c = usePalette();
  const q = useAgenda();
  const [reminders, setReminders] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    void remindersEnabled().then(setReminders);
  }, []);

  const toggle = async (on: boolean) => {
    const granted = await setRemindersEnabled(on);
    setReminders(granted);
    setDenied(on && !granted);
    if (granted && q.data) await syncReminders(q.data);
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID="agenda">
      <Group>
        <Row
          testID="agenda-exams"
          title="Esami e appelli"
          subtitle="Prenota, controlla le scadenze e gli esiti"
          icon="calendar-check-outline"
          onPress={() => router.push('/exams')}
        />
      </Group>
      <Group>
        <Row
          title="Promemoria per gli esami"
          subtitle={
            denied
              ? 'Permesso negato: abilita le notifiche nelle impostazioni di Android.'
              : 'La sera prima e 2 ore prima, e quando chiudono le prenotazioni'
          }
          icon="bell-ring-outline"
          right={
            <Switch
              testID="agenda-reminders"
              value={reminders}
              onValueChange={toggle}
              trackColor={{ true: c.ink, false: c.track }}
              thumbColor={c.surface}
            />
          }
        />
      </Group>
      <QueryView query={q} loading="Carico l’agenda…">
        {(items) =>
          items.length ? (
            byDay(items).map(([day, list]) => (
              <Section key={day} title={capitalize(formatLongDay(list[0]?.startsAt ?? 0))}>
                <Txt variant="caption" color="textMuted" style={{ marginTop: -space.xs }}>
                  {relativeDay(list[0]?.startsAt ?? 0)}
                </Txt>
                <Group>
                  {list.map((a) => (
                    <Row
                      key={a.id}
                      testID={`agenda-${a.id}`}
                      title={a.title}
                      subtitle={[
                        `${formatTime(a.startsAt)}${a.endsAt ? `–${formatTime(a.endsAt)}` : ''}`,
                        a.subtitle,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      icon={a.kind === 'live' ? 'video-outline' : 'pencil-box-outline'}
                      right={<Pill label={KIND_LABEL[a.kind].label} tone={KIND_LABEL[a.kind].tone} />}
                    />
                  ))}
                </Group>
              </Section>
            ))
          ) : (
            <View>
              <Empty
                icon="calendar-blank-outline"
                title="Agenda vuota"
                body="Nessun esame prenotato, appello aperto o lezione live in arrivo."
              />
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function byDay(items: AgendaItem[]): [string, AgendaItem[]][] {
  const m = new Map<string, AgendaItem[]>();
  for (const i of items) {
    const d = new Date(i.startsAt);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return [...m];
}
