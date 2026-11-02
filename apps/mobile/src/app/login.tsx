import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isTokenExpired } from '@studium/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Button, ErrorState, Txt } from '@/components/ui';
import { tokenWatcherScript, useAuth } from '@/lib/auth';
import { saveProfile, useProfileState } from '@/lib/profile';
import { buildProfile, discoveryScript, interpretProbes, type Probe, type SetupStep } from '@/lib/setup';
import { space, usePalette } from '@/lib/theme';
import { navigationGuard, siteScope } from '@/lib/webGuard';

const STEP_LABEL: Record<SetupStep, string> = {
  verify: 'Verifico l’accesso…',
  media: 'Cerco video e sottotitoli delle tue lezioni…',
  done: 'Fatto.',
};

/**
 * Sign-in happens on the university's own page; the app only waits for the session cookie it sets.
 * With `setup`, the page is also observed to recognise the platform (API address, token cookie).
 */
export default function Login() {
  const c = usePalette();
  const { completeSignIn } = useAuth();
  const { profile } = useProfileState();
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const site = setup ?? profile?.spaUrl;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<SetupStep | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const done = useRef(false);
  const probes = useRef<Probe[]>([]);
  const tokenSeenAt = useRef<number | null>(null);

  if (!site) {
    router.replace('/setup');
    return null;
  }
  const host = new URL(site).host;

  const finishSetup = async (found: { token: string; tokenCookie: string; apiBase: string }) => {
    try {
      const p = await buildProfile(site, found, setStep);
      await saveProfile(p);
      await completeSignIn(found.token);
    } catch (e) {
      done.current = false;
      setStep(null);
      setSetupError(e instanceof Error ? e.message : String(e));
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    if (done.current) return;
    let msg: { type: string; token?: string; cookies?: Record<string, string>; urls?: string[] };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (!setup) {
      if (msg.type === 'token' && msg.token && !isTokenExpired(msg.token)) {
        done.current = true;
        void completeSignIn(msg.token);
      }
      return;
    }
    if (msg.type !== 'probe') return;
    probes.current = [...probes.current.slice(-20), { cookies: msg.cookies ?? {}, urls: msg.urls ?? [] }];
    const found = interpretProbes(probes.current);
    if (found) {
      done.current = true;
      void finishSetup(found);
      return;
    }
    // Signed in (a token appeared) but the web app has not called its API yet: give it a few seconds.
    if (Object.keys(msg.cookies ?? {}).length) {
      tokenSeenAt.current ??= Date.now();
      if (Date.now() - tokenSeenAt.current > 20_000) {
        done.current = true;
        setSetupError(
          'Accesso riuscito, ma non riconosco questa piattaforma: non usa l’API studenti supportata. ' +
            'Se hai una configurazione esportata, puoi importarla.',
        );
      }
    }
  };

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
        <ErrorState
          error={Object.assign(new Error(`Non riesco ad aprire ${host}.`), { code: 'NETWORK' })}
          onRetry={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        />
      </View>
    );
  }

  if (step || setupError) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]} testID="setup-progress">
        {setupError ? (
          <>
            <MaterialCommunityIcons name="help-circle-outline" size={40} color={c.textMuted} />
            <Txt variant="body" style={{ textAlign: 'center' }} testID="setup-failed">
              {setupError}
            </Txt>
            <Button label="Torna indietro" kind="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <ActivityIndicator color={c.ink} size="large" />
            <Txt variant="heading" style={{ textAlign: 'center' }}>
              Configuro Studium per {host}
            </Txt>
            <Txt variant="small" color="textMuted">
              {step ? STEP_LABEL[step] : ''}
            </Txt>
          </>
        )}
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
        source={{ uri: site }}
        injectedJavaScript={
          setup ? discoveryScript() : tokenWatcherScript(profile?.tokenCookie ?? '', null, 0)
        }
        onMessage={onMessage}
        // During setup no profile exists yet: the typed site and its sibling hosts are the scope.
        onShouldStartLoadWithRequest={navigationGuard(setup || !profile ? siteScope(site) : profile)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
});
