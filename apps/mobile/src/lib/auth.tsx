import { isTokenExpired, type TokenSource } from '@studium/core';
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { profile } from './profile';
import { clearToken, loadToken, saveToken } from './session';

/**
 * Script injected in the platform's web app. It only *reads* the access-token cookie that the web app
 * itself sets (it is not HttpOnly) and hands it to the app. Credentials are typed into the official page
 * and never touch our code; the refresh token stays an HttpOnly cookie that only the web app uses.
 */
export function tokenWatcherScript(cookieName: string, previous: string | null, timeoutMs: number): string {
  return `(function () {
  var NAME = ${JSON.stringify(cookieName)}, OLD = ${JSON.stringify(previous)};
  var DEADLINE = ${timeoutMs > 0 ? `Date.now() + ${timeoutMs}` : 0}, started = Date.now();
  function post(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function read() {
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(NAME + '=') === 0) { try { return decodeURIComponent(c.slice(NAME.length + 1)); } catch (e) { return c.slice(NAME.length + 1); } }
    }
    return null;
  }
  function exp(t) {
    try { var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); while (p.length % 4) p += '=';
      return JSON.parse(atob(p)).exp * 1000; } catch (e) { return 0; }
  }
  function tick() {
    var t = read();
    if (t && t !== OLD && exp(t) > Date.now() + 60000) { post({ type: 'token', token: t }); return; }
    if (DEADLINE && Date.now() - started > 2500 && document.querySelector('input[type=password]')) { post({ type: 'signed-out' }); return; }
    if (DEADLINE && Date.now() > DEADLINE) { post({ type: 'timeout' }); return; }
    setTimeout(tick, 400);
  }
  tick();
})(); true;`;
}

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthApi {
  status: Status;
  /** Called by the login screen when the web app has set the token. */
  completeSignIn(token: string): Promise<void>;
  signOut(): Promise<void>;
  tokens: TokenSource;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

const RENEW_TIMEOUT_MS = 20_000;

let renewImpl: (() => Promise<string | null>) | null = null;

/** Shared by the API client. Renewal is delegated to the mounted AuthProvider (hidden web view). */
export const tokenSource: TokenSource = {
  token: loadToken,
  renew: () => (renewImpl ? renewImpl() : Promise.resolve(null)),
};

interface Renewal {
  id: number;
  previous: string | null;
  resolve: (token: string | null) => void;
  done: boolean;
}

type Outcome = { token: string } | { signedOut: true } | { failed: true };

/** Holds the session and renders the hidden web view the web app uses to renew it. */
export function AuthProvider({ children, onSignedOut }: { children: ReactNode; onSignedOut?: () => void }) {
  const [status, setStatus] = useState<Status>('loading');
  const [renewal, setRenewal] = useState<Renewal | null>(null);
  const pending = useRef<Promise<string | null> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    loadToken().then((t) => setStatus(t ? 'signedIn' : 'signedOut'));
  }, []);

  // Only an explicit sign-in page means "signed out". A timeout or a network error (e.g. offline) keeps the
  // session: the request fails, the UI shows cached data and lets the student retry.
  const finishRenewal = useCallback(
    async (r: Renewal, outcome: Outcome) => {
      if (r.done) return;
      r.done = true;
      setRenewal((cur) => (cur?.id === r.id ? null : cur));
      if ('token' in outcome) {
        await saveToken(outcome.token);
        r.resolve(outcome.token);
        return;
      }
      if ('signedOut' in outcome) {
        await clearToken();
        setStatus('signedOut');
        onSignedOut?.();
      }
      r.resolve(null);
    },
    [onSignedOut],
  );

  const tokens = useMemo<TokenSource>(
    () => ({
      token: loadToken,
      renew: () => {
        // Single flight: concurrent 401s wait for the same renewal.
        pending.current ??= new Promise<string | null>((resolve) => {
          loadToken().then((previous) => {
            const r: Renewal = { id: ++seq.current, previous, resolve, done: false };
            setRenewal(r);
            setTimeout(() => void finishRenewal(r, { failed: true }), RENEW_TIMEOUT_MS + 2000);
          });
        }).finally(() => {
          pending.current = null;
        });
        return pending.current;
      },
    }),
    [finishRenewal],
  );

  useEffect(() => {
    renewImpl = tokens.renew;
    return () => {
      renewImpl = null;
    };
  }, [tokens]);

  const api = useMemo<AuthApi>(
    () => ({
      status,
      tokens,
      async completeSignIn(token) {
        await saveToken(token);
        setStatus('signedIn');
      },
      async signOut() {
        const token = await loadToken();
        await clearToken();
        if (profile.logoutUrl) {
          // Ends the web session too, so the next sign-in asks for credentials again.
          await fetch(profile.logoutUrl, {
            credentials: 'include',
            headers: token ? { authorization: `Bearer ${token}` } : {},
          }).catch(() => undefined);
        }
        setStatus('signedOut');
        onSignedOut?.();
      },
    }),
    [status, tokens, onSignedOut],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    if (!renewal) return;
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; token?: string };
      if (msg.type === 'token' && msg.token && !isTokenExpired(msg.token))
        void finishRenewal(renewal, { token: msg.token });
      else if (msg.type === 'signed-out') void finishRenewal(renewal, { signedOut: true });
      else if (msg.type === 'timeout') void finishRenewal(renewal, { failed: true });
    } catch {
      /* ignore foreign messages */
    }
  };

  return (
    <AuthContext value={api}>
      {children}
      {renewal ? (
        <View style={styles.hidden} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <WebView
            key={renewal.id}
            source={{ uri: profile.spaUrl }}
            injectedJavaScript={tokenWatcherScript(profile.tokenCookie, renewal.previous, RENEW_TIMEOUT_MS)}
            onMessage={onMessage}
            onError={(): void => {
              void finishRenewal(renewal, { failed: true });
            }}
            onHttpError={(): void => {
              void finishRenewal(renewal, { failed: true });
            }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            mediaPlaybackRequiresUserAction
          />
        </View>
      ) : null}
    </AuthContext>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
