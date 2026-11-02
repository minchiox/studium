import { router } from 'expo-router';
import { View } from 'react-native';
import { Group, Row, Screen, Txt } from '@/components/ui';
import { useStudent, useUnreadNotices } from '@/lib/api';
import { plural } from '@/lib/format';
import { useProfile } from '@/lib/profile';
import { space } from '@/lib/theme';

export default function More() {
  const s = useStudent().data;
  const unread = useUnreadNotices().data ?? 0;
  const profile = useProfile();
  return (
    <Screen testID="more">
      <View style={{ gap: space.xs }}>
        <Txt variant="title">{s ? `${s.firstName} ${s.lastName}` : profile.name}</Txt>
        {s ? (
          <Txt variant="small" color="textMuted">
            Matricola {s.studentId}
            {s.currentYear ? `, ${s.currentYear}° anno` : ''}
            {s.status ? `, ${s.status.toLowerCase()}` : ''}
          </Txt>
        ) : null}
      </View>
      <Group>
        <Row
          testID="more-notices"
          title="Avvisi"
          subtitle={
            unread ? plural(unread, 'avviso da leggere', 'avvisi da leggere') : 'Comunicazioni dell’ateneo'
          }
          icon="bell-outline"
          onPress={() => router.push('/notices')}
        />
        <Row
          testID="more-practice"
          title="Esercitazioni"
          subtitle="Quiz, ripasso e la tua banca di domande"
          icon="head-question-outline"
          onPress={() => router.push('/practice')}
        />
        <Row
          testID="more-agenda"
          title="Agenda"
          subtitle="Esami prenotati, appelli e lezioni live"
          icon="calendar-month-outline"
          onPress={() => router.push('/agenda')}
        />
        <Row
          testID="more-search"
          title="Cerca nelle trascrizioni"
          icon="magnify"
          onPress={() => router.push('/search')}
        />
        <Row
          testID="more-downloads"
          title="Download"
          subtitle="Dispense e trascrizioni offline"
          icon="download-outline"
          onPress={() => router.push('/downloads')}
        />
      </Group>
      <Group>
        <Row
          testID="more-settings"
          title="Impostazioni"
          icon="cog-outline"
          onPress={() => router.push('/settings')}
        />
        <Row
          testID="more-about"
          title="Informazioni e privacy"
          icon="information-outline"
          onPress={() => router.push('/about')}
        />
      </Group>
    </Screen>
  );
}
