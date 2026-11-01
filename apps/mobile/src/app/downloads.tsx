import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Empty, Group, Row, Screen, Section, Txt } from '@/components/ui';
import { useCourses } from '@/lib/api';
import {
  deleteCourseFiles,
  formatBytes,
  type LibraryCourse,
  library,
  openFile,
  totalBytes,
} from '@/lib/files';
import { plural } from '@/lib/format';

export default function Downloads() {
  const titles = Object.fromEntries((useCourses().data ?? []).map((c) => [c.code, c.title]));
  const [items, setItems] = useState<LibraryCourse[]>([]);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setItems(library());
    setBytes(totalBytes());
  }, []);
  useFocusEffect(reload);

  if (!items.length) {
    return (
      <Screen testID="downloads">
        <Empty
          icon="download-off-outline"
          title="Niente sul telefono"
          body="Apri un corso e tocca “Scarica dispense e trascrizioni” per studiare anche offline."
          action={
            <Button label="Vai ai corsi" kind="secondary" onPress={() => router.navigate('/courses')} />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen testID="downloads">
      <Txt variant="small" color="textMuted">
        Spazio usato: {formatBytes(bytes)}
      </Txt>
      {items.map((c) => (
        <Section
          key={c.code}
          title={titles[c.code] ?? c.code}
          action={
            <Button
              kind="quiet"
              label="Elimina"
              onPress={() =>
                Alert.alert(
                  'Eliminare i file del corso?',
                  'Potrai scaricarli di nuovo in qualsiasi momento.',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Elimina',
                      style: 'destructive',
                      onPress: () => {
                        deleteCourseFiles(c.code);
                        reload();
                      },
                    },
                  ],
                )
              }
            />
          }
        >
          <Txt variant="caption" color="textMuted">
            {plural(c.handouts.length, 'dispensa', 'dispense')},{' '}
            {plural(c.transcripts, 'trascrizione', 'trascrizioni')}, {formatBytes(c.bytes)}
          </Txt>
          {c.handouts.length ? (
            <Group>
              {c.handouts
                .sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }))
                .map((f) => (
                  <Row
                    key={f.uri}
                    title={f.name.replace(/\.pdf$/i, '')}
                    subtitle={formatBytes(f.size)}
                    icon="file-pdf-box"
                    chevron={false}
                    onPress={() => openFile(f).catch((e: Error) => setError(e.message))}
                  />
                ))}
            </Group>
          ) : null}
        </Section>
      ))}
      {error ? (
        <Txt variant="small" color="danger">
          {error}
        </Txt>
      ) : null}
    </Screen>
  );
}
