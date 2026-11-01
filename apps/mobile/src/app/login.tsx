import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isTokenExpired } from '@studium/core';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ErrorState, Txt } from '@/components/ui';
import { tokenWatcherScript, useAuth } from '@/lib/auth';
import { profile } from '@/lib/profile';
import { space, usePalette } from '@/lib/theme';

/** Sign-in happens on the university's own page; the app only waits for the session cookie it sets. */
export default function Login() {
  const c = usePalette();
  const { completeSignIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);
  const host = new URL(profile.spaUrl).host;

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; token?: string };
      if (msg.type === 'token' && msg.token && !isTokenExpired(msg.token) && !done.current) {
        done.current = true;
        void completeSignIn(msg.token);
      }
    } catch {
      /* not ours */
    }
  };

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <ErrorState
          error={Object.assign(new Error('Pagina di accesso non raggiungibile.'), { code: 'NETWORK' })}
          onRetry={() => {
            setFailed(null);
            setAttempt((a) => a + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.banner, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
        <MaterialCommunityIcons name="lock-outline" size={18} color={c.success} />
        <Txt variant="caption" color="textMuted" style={{ flex: 1 }}>
          Pagina ufficiale di {host}. Studium non vede la tua password.
        </Txt>
      </View>
      <WebView
        key={attempt}
        testID="login-webview"
        source={{ uri: profile.spaUrl }}
        injectedJavaScript={tokenWatcherScript(profile.tokenCookie, null, 0)}
        onMessage={onMessage}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => setFailed(e.nativeEvent)}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: c.bg }}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={c.ink} size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
