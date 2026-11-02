import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isHostAllowed } from '@studium/core';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Empty, Txt } from '@/components/ui';
import { keys } from '@/lib/api';
import { useProfile } from '@/lib/profile';
import { space, usePalette } from '@/lib/theme';
import { navigationGuard } from '@/lib/webGuard';

/**
 * A page of the university's official web app (exam booking, results), opened with the student's session.
 * Whatever the student does here is done by the platform itself, exactly as on the website: Studium never
 * books, cancels or confirms anything on its own. Only the university's own hosts can be opened.
 */
export default function Official() {
  const c = usePalette();
  const qc = useQueryClient();
  const profile = useProfile();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const allowed = !!url && isHostAllowed(profile, url);

  // Bookings may have changed on the official page: refresh what depends on them when leaving.
  useEffect(
    () => () => {
      void qc.invalidateQueries({ queryKey: keys.exams });
      void qc.invalidateQueries({ queryKey: keys.agenda });
    },
    [qc],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: title || 'Pagina ufficiale' }} />
      <View style={[styles.banner, { backgroundColor: c.inkSoft }]}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={c.ink} />
        <Txt variant="caption" style={{ flex: 1, color: c.ink }}>
          Pagina ufficiale della piattaforma: quello che fai qui vale come sul sito.
        </Txt>
      </View>
      {allowed ? (
        <WebView
          testID="official-webview"
          source={{ uri: url }}
          onShouldStartLoadWithRequest={navigationGuard(profile)}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={c.ink} size="large" />
            </View>
          )}
          style={{ flex: 1 }}
        />
      ) : (
        <Empty
          icon="link-variant-off"
          title="Indirizzo non consentito"
          body="Studium apre solo le pagine della tua università."
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
