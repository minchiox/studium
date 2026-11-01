import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, type IconName, Marked, Txt } from '@/components/ui';
import { useProfileState } from '@/lib/profile';
import { space, usePalette } from '@/lib/theme';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'text-box-search-outline', text: 'Leggi e cerca le trascrizioni delle lezioni.' },
  { icon: 'download-circle-outline', text: 'Tieni le dispense sul telefono, anche offline.' },
  { icon: 'calendar-check-outline', text: 'Carriera, appelli e avvisi a colpo d’occhio.' },
];

export default function Welcome() {
  const c = usePalette();
  const { profile } = useProfileState();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={{ gap: space.xxl }}>
        <View style={{ gap: space.md }}>
          <Marked>Studium</Marked>
          <Txt variant="title">Lezioni, dispense e carriera in tasca.</Txt>
        </View>
        <View style={{ gap: space.lg }}>
          {POINTS.map((p) => (
            <View key={p.icon} style={styles.point}>
              <MaterialCommunityIcons name={p.icon} size={26} color={c.ink} />
              <Txt variant="body" style={{ flex: 1 }}>
                {p.text}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <View style={[styles.note, { backgroundColor: c.surfaceAlt }]}>
          <Txt variant="small" color="textMuted">
            App non ufficiale. Accedi sulla pagina della tua università: la password non passa da Studium. La
            frequenza delle lezioni la registra solo il player ufficiale, mentre guardi.
          </Txt>
        </View>
        <Button
          testID="welcome-login"
          label={profile ? `Accedi a ${profile.name}` : 'Collega la tua università'}
          icon={profile ? 'login' : 'school-outline'}
          onPress={() => router.push(profile ? '/login' : '/setup')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: space.xl,
    justifyContent: 'space-between',
    paddingTop: 72,
    paddingBottom: space.xl,
  },
  point: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  note: { borderRadius: 12, padding: space.lg },
});
