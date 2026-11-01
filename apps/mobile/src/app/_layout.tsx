import { Figtree_400Regular, Figtree_500Medium, Figtree_700Bold, useFonts } from '@expo-google-fonts/figtree';
import { Literata_400Regular, Literata_600SemiBold } from '@expo-google-fonts/literata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorCode } from '@studium/core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fonts, palettes } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const NO_RETRY = new Set([
  'SESSION_EXPIRED',
  'NOT_LOGGED_IN',
  'PLATFORM_CHANGED',
  'NOT_FOUND',
  'REQUEST_BLOCKED',
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 7 * 24 * 3600_000, // keep cached data for a week: the app works offline
      retry: (count, err) => !NO_RETRY.has(errorCode(err)) && count < 1,
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'studium.cache' });

export default function RootLayout() {
  const [loaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_700Bold,
    Literata_400Regular,
    Literata_600SemiBold,
  });
  const scheme = useColorScheme();
  const c = palettes[scheme === 'dark' ? 'dark' : 'light'];
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: c.bg,
        card: c.bg,
        text: c.text,
        primary: c.ink,
        border: c.border,
      },
    };
  }, [scheme, c]);

  if (!loaded) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 3600_000 }}
    >
      <ThemeProvider value={navTheme}>
        <AuthProvider onSignedOut={() => queryClient.clear()}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Navigator />
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function Navigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.uiBold },
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Accedi' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[code]" options={{ title: '' }} />
        <Stack.Screen name="lesson/[code]/[n]" options={{ title: '' }} />
        <Stack.Screen name="transcript/[code]/[n]" options={{ title: 'Trascrizione' }} />
        <Stack.Screen name="watch" options={{ title: 'Player ufficiale' }} />
        <Stack.Screen name="review" options={{ title: 'Ripasso video' }} />
        <Stack.Screen name="notice/[id]" options={{ title: 'Avviso' }} />
        <Stack.Screen name="agenda" options={{ title: 'Agenda' }} />
        <Stack.Screen name="downloads" options={{ title: 'Download' }} />
        <Stack.Screen name="search" options={{ title: 'Cerca nelle trascrizioni' }} />
        <Stack.Screen name="settings" options={{ title: 'Impostazioni' }} />
        <Stack.Screen name="about" options={{ title: 'Informazioni' }} />
      </Stack.Protected>
    </Stack>
  );
}
