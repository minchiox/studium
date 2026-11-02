import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type SearchDoc, search } from '@studium/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Empty, Highlighted, Loading, Screen, Txt } from '@/components/ui';
import { useCourses } from '@/lib/api';
import { transcriptDocs } from '@/lib/files';
import { plural } from '@/lib/format';
import { elevation, space, type, usePalette } from '@/lib/theme';

export default function Search() {
  const c = usePalette();
  const courses = useCourses().data;
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  useFocusEffect(
    useCallback(() => {
      const titles = Object.fromEntries((courses ?? []).map((x) => [x.code, x.title]));
      void transcriptDocs(titles).then(setDocs);
    }, [courses]),
  );

  const hits = useMemo(() => (docs ? search(docs, deferred, 40) : []), [docs, deferred]);

  if (!docs) return <Loading label="Preparo l’indice…" />;
  if (!docs.length) {
    return (
      <Screen>
        <Empty
          icon="text-box-search-outline"
          title="Nessuna trascrizione scaricata"
          body="La ricerca funziona offline sulle trascrizioni salvate. Scarica un corso per iniziare."
          action={
            <Button label="Vai ai corsi" kind="secondary" onPress={() => router.navigate('/courses')} />
          }
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }, elevation(c, 1)]}>
        <MaterialCommunityIcons name="magnify" size={22} color={c.textMuted} />
        <TextInput
          testID="search-input"
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Un concetto, una definizione…"
          placeholderTextColor={c.textMuted}
          style={[type.body, { flex: 1, color: c.text, paddingVertical: 12 }]}
          returnKeyType="search"
        />
      </View>
      <Screen testID="search" keyboardShouldPersistTaps="handled">
        <Txt variant="caption" color="textMuted">
          {deferred.trim().length >= 2
            ? plural(hits.length, 'risultato', 'risultati')
            : `${plural(docs.length, 'paragrafo', 'paragrafi')} da cercare`}
        </Txt>
        {hits.map((h) => (
          <Pressable
            key={h.id}
            testID={`hit-${h.id}`}
            android_ripple={{ color: c.inkSoft }}
            onPress={() =>
              router.push({
                pathname: '/transcript/[code]/[n]',
                params: { code: String(h.meta?.code), n: String(h.meta?.lesson), q: deferred },
              })
            }
            style={[styles.hit, { borderColor: c.border, backgroundColor: c.surface }]}
          >
            <Txt variant="caption" color="ink">
              {String(h.meta?.course)}
            </Txt>
            <Txt variant="bodyStrong">{h.title}</Txt>
            {h.snippet ? (
              <Highlighted
                text={h.snippet}
                query={deferred}
                numberOfLines={4}
                style={[type.small, { color: c.textMuted }]}
              />
            ) : null}
          </Pressable>
        ))}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    margin: space.lg,
    marginBottom: 0,
    paddingHorizontal: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hit: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: 4,
    overflow: 'hidden',
  },
});
