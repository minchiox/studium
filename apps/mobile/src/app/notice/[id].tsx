import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Empty, Group, Loading, paragraphs, Row, Screen, Section, Txt } from '@/components/ui';
import { useNotices } from '@/lib/api';
import { getAttachment, openFile } from '@/lib/files';
import { formatDate } from '@/lib/format';
import { space } from '@/lib/theme';

export default function NoticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useNotices();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const n = q.data?.find((x) => x.id === id);

  if (!n) return q.isPending ? <Loading /> : <Empty icon="bell-off-outline" title="Avviso non trovato" />;

  return (
    <Screen testID="notice">
      <View style={{ gap: space.xs }}>
        <Txt variant="title">{n.title}</Txt>
        <Txt variant="small" color="textMuted">
          {[
            n.category,
            formatDate(n.start ?? n.createdAt),
            n.end ? `valido fino al ${formatDate(n.end)}` : null,
          ]
            .filter(Boolean)
            .join(', ')}
        </Txt>
      </View>
      <View style={{ gap: space.md }}>
        {paragraphs(n.text || 'Questo avviso non ha testo.', /\n{2,}/).map((para) => (
          <Txt key={para.key} variant="reading" selectable>
            {para.text}
          </Txt>
        ))}
      </View>
      {n.attachments.length ? (
        <Section title="Allegati">
          <Group>
            {n.attachments.map((a) => (
              <Row
                key={a.id}
                testID={`attachment-${a.id}`}
                title={a.title}
                subtitle={[a.extension?.toUpperCase(), a.size].filter(Boolean).join(', ')}
                icon={a.extension === 'pdf' ? 'file-pdf-box' : 'file-outline'}
                right={busy === a.id ? <Txt variant="small">Scarico…</Txt> : null}
                chevron={false}
                onPress={async () => {
                  setError(null);
                  setBusy(a.id);
                  try {
                    await openFile(await getAttachment(n.id, a.file, a.title, a.extension));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              />
            ))}
          </Group>
          {error ? (
            <Txt variant="small" color="danger">
              {error}
            </Txt>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}
