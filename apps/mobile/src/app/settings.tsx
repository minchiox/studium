import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { Group, Row, Screen, Txt } from '@/components/ui';
import { useAgenda } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deleteAll, formatBytes, totalBytes } from '@/lib/files';
import { profile } from '@/lib/profile';
import { remindersEnabled, setRemindersEnabled, syncReminders } from '@/lib/reminders';
import { usePalette } from '@/lib/theme';

export default function Settings() {
  const c = usePalette();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const agenda = useAgenda().data;
  const [reminders, setReminders] = useState(false);
  const [bytes, setBytes] = useState(totalBytes());

  useEffect(() => {
    void remindersEnabled().then(setReminders);
  }, []);

  return (
    <Screen testID="settings">
      <Group>
        <Row
          title="Promemoria per gli esami"
          subtitle="Notifiche locali, la sera prima e 2 ore prima"
          icon="bell-ring-outline"
          right={
            <Switch
              value={reminders}
              onValueChange={async (on) => {
                const ok = await setRemindersEnabled(on);
                setReminders(ok);
                if (ok && agenda) await syncReminders(agenda);
              }}
              trackColor={{ true: c.ink, false: c.track }}
              thumbColor={c.surface}
            />
          }
        />
        <Row title="Tema" subtitle="Segue il tema chiaro o scuro di Android" icon="theme-light-dark" />
      </Group>
      <Group>
        <Row
          title="Aggiorna tutti i dati"
          subtitle="Svuota la cache e ricarica dalla piattaforma"
          icon="refresh"
          onPress={async () => {
            qc.clear();
            await qc.invalidateQueries();
            router.navigate('/home');
          }}
        />
        <Row
          title="Elimina i file scaricati"
          subtitle={`Dispense e trascrizioni, ${formatBytes(bytes)}`}
          icon="delete-outline"
          onPress={() =>
            Alert.alert(
              'Eliminare tutti i file?',
              'Dispense, trascrizioni e allegati salvati sul telefono.',
              [
                { text: 'Annulla', style: 'cancel' },
                {
                  text: 'Elimina',
                  style: 'destructive',
                  onPress: () => {
                    deleteAll();
                    qc.removeQueries({ queryKey: ['transcript'] });
                    setBytes(totalBytes());
                  },
                },
              ],
            )
          }
        />
      </Group>
      <Group>
        <Row
          testID="settings-signout"
          title="Esci"
          subtitle={`Disconnetti da ${profile.name}`}
          icon="logout"
          iconColor="danger"
          onPress={() =>
            Alert.alert(
              'Uscire?',
              'I dati in cache verranno cancellati. I file scaricati restano sul telefono.',
              [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Esci', style: 'destructive', onPress: () => void signOut() },
              ],
            )
          }
        />
      </Group>
      <Txt variant="caption" color="textMuted">
        Studium {Constants.expoConfig?.version}, profilo {profile.id}
      </Txt>
    </Screen>
  );
}
