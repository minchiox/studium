import AsyncStorage from '@react-native-async-storage/async-storage';
import { type PlatformProfile, parseProfile } from '@studium/core';
import Constants from 'expo-constants';
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from 'react';

// The university platform the app talks to. Set by the student on first launch (setup screen, or an imported
// configuration) and stored on the device; a build may also ship a default one (see profiles/README.md).
const KEY = 'studium.profile';

const builtIn = (): PlatformProfile | null => {
  const raw = Constants.expoConfig?.extra?.profile;
  if (!raw) return null;
  try {
    return parseProfile(raw);
  } catch {
    return null;
  }
};

let current: PlatformProfile | null = null;
const listeners = new Set<() => void>();

/** Current profile for non-React code (API client, auth bridge). */
export function getProfile(): PlatformProfile {
  if (!current) throw new Error('Nessuna università configurata.');
  return current;
}

export async function loadProfile(): Promise<PlatformProfile | null> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) current = parseProfile(JSON.parse(saved));
  } catch {
    current = null;
  }
  current ??= builtIn();
  return current;
}

export async function saveProfile(p: PlatformProfile): Promise<void> {
  current = parseProfile(p);
  await AsyncStorage.setItem(KEY, JSON.stringify(current));
  for (const l of listeners) l();
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  current = builtIn();
  for (const l of listeners) l();
}

/** Parses a configuration pasted by the student (exported from another device or shared by a classmate). */
export function parseImported(text: string): PlatformProfile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Il testo incollato non è una configurazione valida.');
  }
  try {
    return parseProfile(json);
  } catch {
    throw new Error('La configurazione è incompleta o non riconosciuta.');
  }
}

interface ProfileState {
  profile: PlatformProfile | null;
  ready: boolean;
}

const Ctx = createContext<ProfileState>({ profile: null, ready: false });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfileState>({ profile: null, ready: false });
  const sync = useCallback(() => setState({ profile: current, ready: true }), []);
  useEffect(() => {
    listeners.add(sync);
    void loadProfile().then(sync);
    return () => {
      listeners.delete(sync);
    };
  }, [sync]);
  const value = useMemo(() => state, [state]);
  return <Ctx value={value}>{children}</Ctx>;
}

export const useProfileState = () => use(Ctx);

/** The configured profile; only for screens reachable after setup. */
export function useProfile(): PlatformProfile {
  const { profile } = use(Ctx);
  if (!profile) throw new Error('Nessuna università configurata.');
  return profile;
}
