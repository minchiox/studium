import { hostMatchesSuffixes, isLoopbackHost } from './domains.ts';
import { HostNotAllowedError } from './errors.ts';
import type { PlatformProfile } from './profile.ts';

export type Verdict = { allow: true } | { allow: false; reason: string };

/**
 * Endpoints of the student web app that record attendance / progress. They are never called,
 * and the embedded browsers are prevented from calling them where we control the traffic.
 * The web app's player fires `POST …/lesson/view/inizialize` as soon as a lesson opens.
 */
export const TRACKING_PATH_RE = /\/lesson\/view(\/|$)/i;

/**
 * Non-GET API calls that are session maintenance or pure reads, allowed so the web app keeps working.
 * Each pattern is anchored to whole path segments and to the end of the path: "token" or "login" somewhere in
 * a path (e.g. `/student/tokenized-submit`, `/student/login-history/delete`) is NOT enough.
 * - anything under an `auth` or `oauth` segment: `/oauth/token`, `/api/v1/auth/token`, `/auth/refresh`;
 * - a final segment that is exactly `token`, `refresh`, `refresh-token`, `refresh_token`, `login` or `logout`;
 * - the notes reader of the video lessons, a POST that only reads.
 */
export const SAFE_WRITE_PATHS: readonly RegExp[] = [
  /\/o?auth\/[\w.-]+(\/[\w.-]+)*\/?$/i,
  /\/(token|refresh|refresh[-_]token|login|logout)\/?$/i,
  /\/video-lessons\/getNotes\/?$/i,
];

export function isSafeWritePath(pathname: string): boolean {
  return SAFE_WRITE_PATHS.some((re) => re.test(pathname));
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The path as written and as a server would see it after percent-decoding (`/lesson%2Fview` → `/lesson/view`). */
function pathVariants(pathname: string): string[] {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded === pathname ? [pathname] : [pathname, decoded];
  } catch {
    return [pathname];
  }
}

/** `pathname` is `base` itself or below it: `/api` matches `/api` and `/api/x`, never `/api2`. */
export function isUnderPath(pathname: string, base: string): boolean {
  const b = base.replace(/\/+$/, '');
  return b === '' || pathname === b || pathname.startsWith(`${b}/`);
}

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
  const paths = pathVariants(u.pathname);
  if (paths.some((p) => TRACKING_PATH_RE.test(p))) {
    return { allow: false, reason: 'attendance/progress tracking endpoint (read-only app)' };
  }
  const api = new URL(profile.apiBase);
  const isApi = u.host === api.host && paths.some((p) => isUnderPath(p, api.pathname));
  if (isApi && !READ_METHODS.has(method.toUpperCase()) && !paths.every(isSafeWritePath)) {
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
  if (u.username || u.password) return false;
  const insecureOk = profile.allowInsecureHttp && u.protocol === 'http:' && isLoopbackHost(u.hostname);
  if (u.protocol !== 'https:' && !insecureOk) return false;
  return hostMatchesSuffixes(u.hostname, [...profile.allowedHostSuffixes, ...extra]);
}

export function assertHostAllowed(
  profile: Pick<PlatformProfile, 'allowedHostSuffixes' | 'allowInsecureHttp'>,
  url: string,
  extra: readonly string[] = [],
): void {
  if (!isHostAllowed(profile, url, extra)) throw new HostNotAllowedError(url);
}

/** Pseudo-URLs a page may load in its own frame without reaching the network. */
const LOCAL_NAVIGATION_RE = /^(about:(blank|srcdoc)|blob:|data:)/i;

/**
 * Whether an in-app browser (sign-in, official pages, player, session renewal) may navigate to `url`.
 * Only the university's hosts and local pseudo-URLs: an external link, a redirect to another site or a custom
 * scheme (`intent:`, `market:` …) is refused, so the student's session never shows up on a page we do not trust.
 */
export function isNavigationAllowed(
  profile: Pick<PlatformProfile, 'allowedHostSuffixes' | 'allowInsecureHttp'>,
  url: string,
): boolean {
  if (LOCAL_NAVIGATION_RE.test(url)) return true;
  return isHostAllowed(profile, url);
}
