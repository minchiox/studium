import { HostNotAllowedError } from './errors.ts';
import type { PlatformProfile } from './profile.ts';

export type Verdict = { allow: true } | { allow: false; reason: string };

/**
 * Endpoints of the student web app that record attendance / progress. They are never called,
 * and the embedded browsers are prevented from calling them where we control the traffic.
 * The web app's player fires `POST …/lesson/view/inizialize` as soon as a lesson opens.
 */
export const TRACKING_PATH_RE = /\/lesson\/view(\/|$)/i;

/** Non-GET API calls that are session maintenance or pure reads: allowed so the web app keeps working. */
export const SAFE_WRITE_PATH_RE = /(\/auth\/|\/oauth\/|\/(refresh|login|logout)\b|token|\/getNotes$)/i;

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Decides whether a request may leave the device. The read-only guarantee:
 * - tracking endpoints are always blocked, whatever the method or host;
 * - non-read requests to the student API are blocked unless they are session maintenance.
 */
export function classifyRequest(
  profile: Pick<PlatformProfile, 'apiBase'>,
  method: string,
  url: string,
): Verdict {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { allow: true }; // data:, blob:, about: never reach the network
  }
  if (TRACKING_PATH_RE.test(u.pathname)) {
    return { allow: false, reason: 'attendance/progress tracking endpoint (read-only app)' };
  }
  const api = new URL(profile.apiBase);
  const isApi = u.host === api.host && u.pathname.startsWith(api.pathname.replace(/\/$/, ''));
  if (isApi && !READ_METHODS.has(method.toUpperCase()) && !SAFE_WRITE_PATH_RE.test(u.pathname)) {
    return { allow: false, reason: 'write request to the student API (read-only app)' };
  }
  return { allow: true };
}

export function isHostAllowed(
  profile: Pick<PlatformProfile, 'allowedHostSuffixes' | 'allowInsecureHttp'>,
  url: string,
  extra: readonly string[] = [],
): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && !(profile.allowInsecureHttp && u.protocol === 'http:')) return false;
  const host = u.hostname.toLowerCase();
  return [...profile.allowedHostSuffixes, ...extra].some((s) => host === s || host.endsWith(`.${s}`));
}

export function assertHostAllowed(
  profile: Pick<PlatformProfile, 'allowedHostSuffixes' | 'allowInsecureHttp'>,
  url: string,
  extra: readonly string[] = [],
): void {
  if (!isHostAllowed(profile, url, extra)) throw new HostNotAllowedError(url);
}
