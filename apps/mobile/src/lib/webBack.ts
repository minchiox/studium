import { useFocusEffect } from 'expo-router';
import { type RefObject, useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import type { WebView, WebViewNavigation } from 'react-native-webview';

/**
 * Android back inside an in-app web page: first the page's own history (as in a browser), then the screen.
 * The header arrow still closes the page at once. Returns the WebView's `onNavigationStateChange`.
 */
export function useWebBack(web: RefObject<WebView<object> | null>) {
  const canGoBack = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!canGoBack.current) return false;
        web.current?.goBack();
        return true;
      });
      return () => sub.remove();
    }, [web]),
  );
  return useCallback((s: WebViewNavigation) => {
    canGoBack.current = s.canGoBack;
  }, []);
}
