import * as SecureStore from 'expo-secure-store';

// Only the short-lived access token is stored by the app, encrypted with the Android Keystore.
// The refresh token stays in the WebView cookie jar as an HttpOnly cookie and is never read by our code.
const KEY = 'studium.accessToken';

let cached: string | null | undefined;

export async function loadToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function saveToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY);
}
