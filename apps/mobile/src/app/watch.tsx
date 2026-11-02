import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isHostAllowed } from '@studium/core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Empty, Txt } from '@/components/ui';
import { useProfile } from '@/lib/profile';
import { space, usePalette } from '@/lib/theme';
import { navigationGuard } from '@/lib/webGuard';

const PAUSE_ALL = `document.querySelectorAll('video,audio').forEach(function (m) { try { m.pause(); } catch (e) {} }); true;`;

/**
 * The platform's own lesson player. Attendance is recorded by the platform, as on the website, while the
 * student watches. Studium never automates it: no autoplay, and playback pauses when the app goes to the
 * background, so a lesson only "plays" while it is actually on screen.
 */
export default function Watch() {
  const c = usePalette();
  const profile = useProfile();
  const { url } = useLocalSearchParams<{ url: string; title?: string }>();
  // Every route is reachable by deep link (studium://watch?url=…): the address is untrusted input.
  const allowed = !!url && isHostAllowed(profile, url);
  // The typings default P to `undefined`, which collapses the props to `never`: pin it to `object`.
  const web = useRef<WebView<object>>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') web.current?.injectJavaScript(PAUSE_ALL);
    });
    return () => {
      web.current?.injectJavaScript(PAUSE_ALL);
      sub.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.banner, { backgroundColor: c.inkSoft }]}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={c.ink} />
        <Txt variant="caption" style={{ flex: 1, color: c.ink }}>
          Player ufficiale della piattaforma: la visione viene registrata come sul sito.
        </Txt>
      </View>
      {allowed ? (
        <WebView
          ref={web}
          testID="watch-webview"
          source={{ uri: url }}
          onShouldStartLoadWithRequest={navigationGuard(profile)}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction
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
          body="Studium apre nel player solo le pagine della tua università."
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
