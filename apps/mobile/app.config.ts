/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Optional built-in platform profile. Public builds ship none: the student connects their university on first
 * launch. Personal builds may embed one: STUDIUM_PROFILE=path/to/profile.json (relative to the repo root), or
 * profiles/default.json when present. STUDIUM_PROFILE=none forces a generic build.
 */
function loadProfile(): Record<string, unknown> | null {
  const root = path.resolve(__dirname, '../..');
  const env = process.env.STUDIUM_PROFILE;
  if (env === 'none') return null;
  const file = env ? path.resolve(root, env) : path.join(root, 'profiles/default.json');
  if (!fs.existsSync(file)) {
    if (env) throw new Error(`STUDIUM_PROFILE not found: ${file}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = loadProfile();
  return {
    ...config,
    name: 'Studium',
    slug: 'studium',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'studium',
    userInterfaceStyle: 'automatic',
    android: {
      package: 'app.studium.companion',
      versionCode: 2,
      adaptiveIcon: {
        backgroundColor: '#F5F7FB',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: true,
      softwareKeyboardLayoutMode: 'resize',
      permissions: ['android.permission.POST_NOTIFICATIONS'],
      blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA'],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-video',
      ['expo-notifications', { color: '#1F3A8A' }],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#F5F7FB',
          image: './assets/images/splash-icon.png',
          imageWidth: 96,
          dark: { backgroundColor: '#0F1422' },
        },
      ],
      './plugins/with-local-cleartext',
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: profile ? { profile } : {},
  };
};
