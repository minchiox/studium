import { z } from 'zod';
import {
  hostMatchesSuffixes,
  isLoopbackHost,
  isPublicSuffix,
  isValidHostname,
  normalizeHost,
} from './domains.ts';
import { StudiumError } from './errors.ts';

/**
 * Everything that identifies a specific university instance lives in a profile (JSON),
 * kept outside the source tree. The code only knows the generic shape of the student web app.
 */
export const PlatformProfile = z.object({
  /** Short id, e.g. "my-university". */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Display name shown in the app, e.g. "La mia università". */
  name: z.string().min(1),
  /** Student web app home: used to sign in and to let the web app renew its own session. */
  spaUrl: z.url(),
  /** Student REST API base URL (no trailing slash). */
  apiBase: z.url(),
  /** Optional legacy portal (Chamilo) home. */
  portalUrl: z.url().optional(),
  /** Lesson player in the web app: `{course}` and `{lp}` are replaced. */
  watchUrlTemplate: z.string().includes('{course}'),
  /** Cookie holding the access token (JWT) set by the web app. */
  tokenCookie: z.string().min(1),
  /** HttpOnly cookie holding the refresh token (informational: never read by this code). */
  refreshCookie: z.string().min(1).optional(),
  /** Host serving videos and PDF handouts, with trailing slash. */
  mediaHost: z.url().optional(),
  /** Host serving subtitles (.vtt) with the same paths as the videos, with trailing slash. */
  subtitleHost: z.url().optional(),
  /** Hostname suffixes the tools may reach. */
  allowedHostSuffixes: z.array(z.string().min(1)).min(1),
  /** Page or endpoint that ends the web session (clears the refresh cookie). */
  logoutUrl: z.url().optional(),
  /** Allow plain HTTP (only for local mock servers). */
  allowInsecureHttp: z.boolean().default(false),
});
export type PlatformProfile = z.infer<typeof PlatformProfile>;

/** One address or host of a profile that breaks the trust rules, as shown to the student. */
export interface ProfileViolation {
  /** Profile field, e.g. "apiBase" or "allowedHostSuffixes[1]". */
  field: string;
  /** The offending URL or host. */
  value: string;
  reason: string;
}

/** A profile that would let the app talk to hosts outside the university: never saved, never used. */
export class ProfileValidationError extends StudiumError {
  constructor(readonly violations: readonly ProfileViolation[]) {
    super(
      `Invalid platform profile: ${violations.map((v) => `${v.field} (${v.value}): ${v.reason}`).join('; ')}`,
      'PROFILE_REJECTED',
      'Use only configurations exported by Studium or created by the setup of your own university.',
    );
  }
}

/** Fields holding addresses the app connects to with the token or the student's session. */
const URL_FIELDS = ['spaUrl', 'apiBase', 'portalUrl', 'mediaHost', 'subtitleHost', 'logoutUrl'] as const;

/**
 * Trust rules of a profile. A profile may come from a classmate, so it is untrusted input: the token is sent to
 * `apiBase` and `logoutUrl`, and the in-app browsers open only allowed hosts. The rules:
 * - every allowed suffix is a valid host name and not a public suffix (`it`, `ac.uk`, `github.io` …);
 * - every address uses HTTPS (plain HTTP only towards the development machine, with `allowInsecureHttp`),
 *   carries no credentials and sits under an allowed suffix;
 * - the lesson player template stays on the web app (`{spa}…`) or on an allowed host.
 * The suffix list comes from the same file, so this is no proof of origin: the mobile app also asks the
 * student to confirm the domains before an import.
 */
export function profileViolations(p: PlatformProfile): ProfileViolation[] {
  const out: ProfileViolation[] = [];
  const suffixes = p.allowedHostSuffixes.map(normalizeHost);

  suffixes.forEach((s, i) => {
    const field = `allowedHostSuffixes[${i}]`;
    if (!isValidHostname(s)) out.push({ field, value: s, reason: 'not a valid host name' });
    else if (isPublicSuffix(s))
      out.push({ field, value: s, reason: 'public suffix: it would trust domains owned by anyone' });
  });

  const checkUrl = (field: string, raw: string) => {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      out.push({ field, value: raw, reason: 'not a valid URL' });
      return;
    }
    const insecureOk = p.allowInsecureHttp && u.protocol === 'http:' && isLoopbackHost(u.hostname);
    if (u.protocol !== 'https:' && !insecureOk) {
      out.push({ field, value: raw, reason: 'must use https://' });
    } else if (u.username || u.password) {
      out.push({ field, value: raw, reason: 'must not contain credentials' });
    } else if (!hostMatchesSuffixes(u.hostname, suffixes)) {
      out.push({ field, value: u.hostname, reason: 'host outside the allowed domains' });
    }
  };
  for (const field of URL_FIELDS) {
    const value = p[field];
    if (value !== undefined) checkUrl(field, value);
  }
  if (!p.watchUrlTemplate.startsWith('{spa}')) {
    checkUrl('watchUrlTemplate', p.watchUrlTemplate.replace('{course}', 'COURSE').replace('{lp}', '1'));
  }
  return out;
}

/** Parses and validates a profile; throws `ProfileValidationError` when it breaks the trust rules. */
export function parseProfile(input: unknown): PlatformProfile {
  const res = PlatformProfile.safeParse(input);
  if (!res.success) throw new Error(`Invalid platform profile: ${z.prettifyError(res.error)}`);
  const profile: PlatformProfile = {
    ...res.data,
    apiBase: res.data.apiBase.replace(/\/+$/, ''),
    allowedHostSuffixes: [...new Set(res.data.allowedHostSuffixes.map(normalizeHost))],
  };
  const violations = profileViolations(profile);
  if (violations.length) throw new ProfileValidationError(violations);
  return profile;
}

/** Every address the profile lets the app reach, for the confirmation shown before an import. */
export function profileHosts(p: PlatformProfile): { field: string; host: string }[] {
  const out: { field: string; host: string }[] = [];
  for (const field of URL_FIELDS) {
    const value = p[field];
    if (value) out.push({ field, host: new URL(value).host });
  }
  return out;
}

/** Pages of the official web app that Studium opens instead of writing to the platform. */
export const OFFICIAL_PAGES = {
  /** Exam calendar: booking and cancelling exams. */
  exams: 'appelli',
  /** Accepting or rejecting exam results. */
  results: 'confirm-exam',
} as const;

export type OfficialPage = keyof typeof OFFICIAL_PAGES;

export function officialPageUrl(profile: PlatformProfile, page: OfficialPage): string {
  return new URL(OFFICIAL_PAGES[page], profile.spaUrl).toString();
}

export function watchUrl(profile: PlatformProfile, course: string, lpId: number): string {
  return profile.watchUrlTemplate
    .replace('{spa}', profile.spaUrl)
    .replace('{course}', encodeURIComponent(course))
    .replace('{lp}', String(lpId));
}
