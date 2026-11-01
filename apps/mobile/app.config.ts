/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The platform profile (hosts and cookie names of your university) is injected at build time and never
 * committed: STUDIUM_PROFILE=path/to/profile.json, otherwise profiles/default.json, otherwise the mock.
 */
function loadProfile(): Record<string, unknown> {
  const root = path.resolve(__dirname, '../..');
  const candidates = [
    process.env.STUDIUM_PROFILE,
    path.join(root, 'profiles/default.json'),
    path.join(root, 'profiles/mock.json'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(path.resolve(root, c))) {
      return JSON.parse(fs.readFileSync(path.resolve(root, c), 'utf8')) as Record<string, unknown>;
    }
  }
  throw new Error('No platform profile found: set STUDIUM_PROFILE or create profiles/default.json');
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = loadProfile();
  const insecure = profile.allowInsecureHttp === true;
  return {
    ...config,
    name: 'Studium',
    slug: 'studium',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'studium',
    userInterfaceStyle: 'automatic',
    android: {
      package: 'app.studium.companion',
      versionCode: 1,
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
      ['expo-build-properties', { android: { usesCleartextTraffic: insecure } }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: { profile },
  };
};
