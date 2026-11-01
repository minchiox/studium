import { Stack } from 'expo-router';
import { fonts } from '@/lib/theme';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontFamily: fonts.uiBold }, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Avvisi' }} />
    </Stack>
  );
}
