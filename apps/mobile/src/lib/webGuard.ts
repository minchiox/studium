import { isNavigationAllowed, type PlatformProfile, registrableDomain } from '@studium/core';
import { Alert, Linking } from 'react-native';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

/** The part of a profile that decides which hosts an in-app browser may show. */
export type NavigationScope = Pick<PlatformProfile, 'allowedHostSuffixes' | 'allowInsecureHttp'>;

/**
 * Scope for the sign-in page during setup, before a profile exists: the site the student typed and its
 * sibling hosts (same registrable domain, so "lms.uni.it" may redirect to "sso.uni.it").
 */
export function siteScope(siteUrl: string): NavigationScope {
  const u = new URL(siteUrl);
  return { allowedHostSuffixes: [registrableDomain(u.hostname)], allowInsecureHttp: u.protocol === 'http:' };
}

export type BlockedNavigation = 'silent' | 'offer-browser';

/**
 * `onShouldStartLoadWithRequest` for every in-app browser (sign-in, official pages, player, session renewal).
 * The student's session lives in the WebView cookie jar, so the WebView only ever shows the university's hosts:
 * any other navigation — external link, redirect, `target=_blank`, custom scheme — is cancelled. With
 * `offer-browser`, an external http(s) link may be opened in the system browser, which does not share the
 * session; the hidden renewal view uses `silent`.
 */
export function navigationGuard(scope: NavigationScope, onBlocked: BlockedNavigation = 'offer-browser') {
  return (req: ShouldStartLoadRequest): boolean => {
    if (isNavigationAllowed(scope, req.url)) return true;
    if (onBlocked === 'offer-browser' && req.isTopFrame !== false && /^https?:\/\//i.test(req.url)) {
      const host = new URL(req.url).host;
      Alert.alert(
        'Link esterno',
        `${host} non fa parte della tua università. Per sicurezza Studium non lo apre qui dentro: puoi aprirlo nel browser, senza la tua sessione.`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Apri nel browser', onPress: () => void Linking.openURL(req.url).catch(() => undefined) },
        ],
      );
    }
    return false;
  };
}
