import { MaterialCommunityIcons } from '@expo/vector-icons';
import { highlight, normalize } from '@studium/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { ErrorState, Highlighted, Loading, paragraphs, Screen, Txt } from '@/components/ui';
import { useLesson } from '@/lib/api';
import { getTranscript, transcriptMarkdown } from '@/lib/files';
import { space, type, usePalette } from '@/lib/theme';

export default function TranscriptScreen() {
  const c = usePalette();
  const { code, n, q: initial } = useLocalSearchParams<{ code: string; n: string; q?: string }>();
  const lesson = useLesson(code, Number(n)).data;
  const t = useQuery({
    queryKey: ['transcript', code, n],
    queryFn: () => getTranscript(code, lesson as NonNullable<typeof lesson>),
    enabled: !!lesson,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [query, setQuery] = useState(initial ?? '');

  const matches = useMemo(() => {
    const terms = normalize(query).trim();
    if (terms.length < 2 || !t.data) return 0;
    return t.data.texts.reduce((s, x) => s + (x ? highlight(x, query).filter((p) => p.match).length : 0), 0);
  }, [query, t.data]);

  if (!t.data)
    return t.error ? (
      <ErrorState error={t.error} onRetry={() => void t.refetch()} />
    ) : (
      <Loading label="Preparo la trascrizione…" />
    );
  const data = t.data;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Lezione ${n}`,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Condividi la trascrizione"
              hitSlop={12}
              onPress={() => Share.share({ title: data.lesson.title, message: transcriptMarkdown(data) })}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={22} color={c.ink} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={c.textMuted} />
        <TextInput
          testID="transcript-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca in questa lezione"
          placeholderTextColor={c.textMuted}
          style={[type.body, { flex: 1, color: c.text, paddingVertical: 10 }]}
          returnKeyType="search"
        />
        {query ? (
          <Txt variant="caption" color="textMuted" testID="transcript-matches">
            {matches === 1 ? '1 risultato' : `${matches} risultati`}
          </Txt>
        ) : null}
      </View>
      <Screen testID="transcript">
        <Txt variant="title" style={{ fontFamily: 'Literata_600SemiBold' }}>
          {data.lesson.title}
        </Txt>
        {data.lesson.paragraphs.map((p, i) => {
          const text = data.texts[i];
          return (
            <View key={p.number} style={{ gap: space.sm }}>
              <Txt variant="readingHeading">
                {data.lesson.number}.{p.number} {p.title}
              </Txt>
              {text ? (
                paragraphs(text).map((line) => (
                  <Highlighted
                    key={line.key}
                    text={line.text}
                    query={query}
                    selectable
                    style={[type.reading, { color: c.text }]}
                  />
                ))
              ) : (
                <Txt variant="small" color="textMuted">
                  Trascrizione non disponibile per questo paragrafo.
                </Txt>
              )}
            </View>
          );
        })}
        <Txt variant="caption" color="textMuted">
          Testo ricavato dai sottotitoli: può contenere errori di riconoscimento. Per formule e definizioni fa
          fede la dispensa.
        </Txt>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
