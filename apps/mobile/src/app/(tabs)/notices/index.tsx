import { router } from 'expo-router';
import { Empty, Group, QueryView, Row, Screen } from '@/components/ui';
import { useNotices } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function Notices() {
  const q = useNotices();
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID="notices">
      <QueryView query={q} loading="Carico gli avvisi…">
        {(list) =>
          list.length ? (
            <Group>
              {list.map((n) => (
                <Row
                  key={n.id}
                  testID={`notice-${n.id}`}
                  title={n.title}
                  subtitle={[n.category, formatDate(n.start ?? n.createdAt)].filter(Boolean).join(', ')}
                  icon={n.attachments.length ? 'paperclip' : 'bell-outline'}
                  onPress={() => router.push({ pathname: '/notice/[id]', params: { id: n.id } })}
                />
              ))}
            </Group>
          ) : (
            <Empty
              icon="bell-check-outline"
              title="Nessun avviso"
              body="Quando l’ateneo pubblica una comunicazione la trovi qui."
            />
          )
        }
      </QueryView>
    </Screen>
  );
}
