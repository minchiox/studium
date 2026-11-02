import { MaterialCommunityIcons } from '@expo/vector-icons';
import { normalize } from '@studium/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Group, Row, Screen, Txt } from '@/components/ui';
import { saveExamSeat } from '@/lib/examSeat';
import { fonts, radius, space, usePalette } from '@/lib/theme';

/** Picks the exam seat used to filter bookable sessions. */
export default function ExamSeat() {
  const c = usePalette();
  const params = useLocalSearchParams<{ locations?: string; current?: string }>();
  const locations = useMemo<string[]>(() => {
    try {
      const v = JSON.parse(params.locations ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, [params.locations]);
  const current = params.current || null;
  const [query, setQuery] = useState('');
  const shown = query ? locations.filter((l) => normalize(l).includes(normalize(query))) : locations;

  const pick = async (seat: string | null) => {
    await saveExamSeat(seat);
    router.back();
  };
  const check = (on: boolean) =>
    on ? <MaterialCommunityIcons name="check" size={22} color={c.ink} /> : undefined;

  return (
    <Screen testID="exam-seat" keyboardShouldPersistTaps="handled">
      <TextInput
        testID="exam-seat-search"
        value={query}
        onChangeText={setQuery}
        placeholder="Cerca una sede"
        placeholderTextColor={c.textMuted}
        autoCorrect={false}
        style={{
          fontFamily: fonts.ui,
          fontSize: 16,
          color: c.text,
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      />
      <Group>
        <Row
          title="Tutte le sedi"
          icon="earth"
          right={check(!current)}
          chevron={false}
          onPress={() => void pick(null)}
        />
      </Group>
      {shown.length ? (
        <Group>
          {shown.map((l) => (
            <Row
              key={l}
              testID={`exam-seat-${l}`}
              title={l}
              icon="map-marker-outline"
              right={check(l === current)}
              chevron={false}
              onPress={() => void pick(l)}
            />
          ))}
        </Group>
      ) : (
        <View>
          <Txt variant="small" color="textMuted">
            Nessuna sede trovata.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
