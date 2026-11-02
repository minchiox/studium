import type { Notice } from '@studium/core';
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Empty, ErrorState, Loading, Row } from '@/components/ui';
import { useNotices } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { radius, space, usePalette } from '@/lib/theme';

/** Notices: often more than a hundred, so a virtualized list that only draws the rows on screen. */
export default function Notices() {
  const c = usePalette();
  const q = useNotices();
  const list = q.data;

  if (!list)
    return q.error ? (
      <ErrorState error={q.error} onRetry={() => void q.refetch()} />
    ) : (
      <Loading label="Carico gli avvisi…" />
    );

  const renderItem = ({ item: n, index }: { item: Notice; index: number }) => (
    <View
      style={[
        styles.item,
        { backgroundColor: c.surface, borderColor: c.border },
        index === 0 && styles.first,
        index === list.length - 1 && styles.last,
      ]}
    >
      <Row
        testID={`notice-${n.id}`}
        title={n.title}
        subtitle={[n.category, formatDate(n.start ?? n.createdAt)].filter(Boolean).join(', ')}
        icon={n.attachments.length ? 'paperclip' : 'bell-outline'}
        onPress={() => router.push({ pathname: '/notice/[id]', params: { id: n.id } })}
      />
    </View>
  );

  return (
    <FlatList
      testID="notices"
      data={list}
      keyExtractor={(n) => n.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => (
        <View style={[styles.sep, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>
      )}
      ListEmptyComponent={
        <Empty
          icon="bell-check-outline"
          title="Nessun avviso"
          body="Quando l’ateneo pubblica una comunicazione la trovi qui."
        />
      }
      initialNumToRender={14}
      windowSize={7}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          colors={[c.ink]}
          progressBackgroundColor={c.surface}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 96 },
  item: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  sep: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  line: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
});
