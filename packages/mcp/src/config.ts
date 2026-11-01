import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type LogLevel, type PlatformProfile, parseProfile } from '@studium/core';

export interface Config {
  /** Root folder for downloads: every file the tools write stays inside it. */
  workspace: string;
  /** Private folder (mode 700) for the session, the profile and optional debug captures. */
  dataDir: string;
  sessionFile: string;
  captureDir: string;
  profile: PlatformProfile;
  headless: boolean;
  /** Playwright channel, e.g. "chrome" or "msedge", to use an installed browser instead of bundled Chromium. */
  browserChannel: string | undefined;
  extraAllowedHosts: string[];
  logLevel: LogLevel;
  concurrency: number;
}

type Env = Record<string, string | undefined>;

export function defaultDataDir(
  env: Env = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
): string {
  const app = 'studium';
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), app);
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', app);
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), app);
}

const truthy = (v: string | undefined, fallback: boolean): boolean =>
  v === undefined || v === '' ? fallback : !/^(0|false|no|off)$/i.test(v);

/** Profile from STUDIUM_PROFILE, else `<dataDir>/profile.json`. */
export function loadProfile(env: Env, dataDir: string): PlatformProfile {
  const file = env.STUDIUM_PROFILE ? path.resolve(env.STUDIUM_PROFILE) : path.join(dataDir, 'profile.json');
  if (!fs.existsSync(file)) {
    throw new Error(
      `Platform profile not found at ${file}. Copy profiles/example.json, fill in your university's hosts, ` +
        'and set STUDIUM_PROFILE to its path (or save it as profile.json in the data folder).',
    );
  }
  return parseProfile(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function loadConfig(env: Env = process.env, overrides: Partial<Config> = {}): Config {
  const dataDir = path.resolve(env.STUDIUM_HOME || defaultDataDir(env));
  const concurrency = Number.parseInt(env.STUDIUM_CONCURRENCY ?? '', 10);
  const level = env.STUDIUM_LOG_LEVEL;
  return {
    workspace: path.resolve(env.STUDIUM_WORKSPACE || process.cwd()),
    dataDir,
    sessionFile: path.join(dataDir, 'session.json'),
    captureDir: path.join(dataDir, 'captures'),
    profile: overrides.profile ?? loadProfile(env, dataDir),
    headless: truthy(env.STUDIUM_HEADLESS, true),
    browserChannel: env.STUDIUM_BROWSER_CHANNEL || undefined,
    extraAllowedHosts: (env.STUDIUM_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
    logLevel:
      level && ['debug', 'info', 'warn', 'error', 'silent'].includes(level) ? (level as LogLevel) : 'info',
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? Math.min(concurrency, 16) : 4,
    ...overrides,
  };
}
