import { type PlatformProfile, parseProfile } from '@studium/core';
import Constants from 'expo-constants';

/** Platform profile injected at build time by app.config.ts (see profiles/README). */
export const profile: PlatformProfile = parseProfile(Constants.expoConfig?.extra?.profile);
