import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Txt } from '@/components/ui';
import { space, usePalette } from '@/lib/theme';
import { useWebBack } from '@/lib/webBack';

const PAUSE_ALL = `document.querySelectorAll('video,audio').forEach(function (m) { try { m.pause(); } catch (e) {} }); true;`;

/**
 * The platform's own lesson player. Attendance is recorded by the platform, as on the website, while the
 * student watches. Studium never automates it: no autoplay, and playback pauses when the app goes to the
 * background, so a lesson only "plays" while it is actually on screen.
 */
export default function Watch() {
  const c = usePalette();
  const { url } = useLocalSearchParams<{ url: string; title?: string }>();
  // The typings default P to `undefined`, which collapses the props to `never`: pin it to `object`.
  const web = useRef<WebView<object>>(null);
  const onNavigationStateChange = useWebBack(web);

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
      <WebView
        ref={web}
        onNavigationStateChange={onNavigationStateChange}
        testID="watch-webview"
        source={{ uri: url }}
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
