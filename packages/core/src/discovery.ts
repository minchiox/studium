// Building a platform profile from what the student's own browser session reveals: the address they typed,
// the API calls the web app makes, and the cookie holding the access token. Pure functions, unit-tested.
// `registrableDomain` knows multi-label public suffixes ("lms.uni.ac.uk" → "uni.ac.uk", never "ac.uk").
import { registrableDomain } from './domains.ts';
import { jwtExpiry, vttUrl } from './parse.ts';
import { type PlatformProfile, parseProfile } from './profile.ts';

/** Accepts "uni.example.edu", "https://uni.example.edu/login" … and returns the origin with a trailing slash. */
export function normalizeSiteUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('Inserisci l’indirizzo della piattaforma.');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new Error('Questo non sembra un indirizzo web valido.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:')
    throw new Error('L’indirizzo deve iniziare con https://');
  if (!u.hostname.includes('.') && u.hostname !== 'localhost')
    throw new Error('Questo non sembra un indirizzo web valido.');
  return `${u.origin}/`;
}

/**
 * The access-token cookie: a cookie whose value is a JWT that has not expired. Names containing "refresh"
 * are skipped, names containing "token" win ties.
 */
export function findTokenCookie(
  cookies: Record<string, string>,
  now = Date.now(),
): { name: string; token: string } | null {
  const candidates = Object.entries(cookies)
    .filter(([name, value]) => !/refresh/i.test(name) && /^eyJ[\w-]*\.[\w-]+\.[\w-]*$/.test(value))
    .filter(([, value]) => (jwtExpiry(value)?.getTime() ?? 0) > now)
    .sort(([a], [b]) => Number(/token/i.test(b)) - Number(/token/i.test(a)));
  const best = candidates[0];
  return best ? { name: best[0], token: best[1] } : null;
}

/** Student-API base from the URLs the web app requested: everything before "/student/" or "/notice/". */
export function findApiBase(urls: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      const m = u.pathname.match(/^(.*?)\/(student|notice)\//);
      if (!m) continue;
      const base = `${u.origin}${m[1] ?? ''}`;
      counts.set(base, (counts.get(base) ?? 0) + 1);
    } catch {
      /* ignore */
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Where subtitles may live for a given media host: same host first, then the usual sibling hosts. */
export function subtitleHostCandidates(spaUrl: string, mediaHost: string): string[] {
  const spa = new URL(spaUrl);
  const labels = spa.hostname.split('.');
  const rest = labels.slice(1).join('.');
  const domain = registrableDomain(spa.hostname);
  const tenant = labels.length > 2 ? labels[labels.length - 3] : null;
  const out = [
    mediaHost,
    tenant ? `${spa.protocol}//video-${tenant}.${domain}/` : null,
    `${spa.protocol}//video.${rest}/`,
    `${spa.protocol}//video.${domain}/`,
    `${spa.protocol}//media.${domain}/`,
  ];
  return [...new Set(out.filter((x): x is string => !!x))];
}

/** A readable default name for the platform, from its address: "lms.myuni.example.edu" → "Myuni". */
export function nameFromHost(spaUrl: string): string {
  const labels = new URL(spaUrl).hostname.split('.');
  const pick = labels.length > 2 ? labels[labels.length - 3] : labels[0];
  const word = (pick ?? 'università').replace(/[-_]+/g, ' ');
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export interface DiscoveryInput {
  spaUrl: string;
  apiBase: string;
  tokenCookie: string;
  name?: string;
}

/** Profile from the discovered essentials; media hosts are added later by `withMediaHosts`. */
export function profileFromDiscovery(d: DiscoveryInput): PlatformProfile {
  const spa = new URL(d.spaUrl);
  const api = new URL(d.apiBase);
  return parseProfile({
    id: `site-${spa.hostname.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`.slice(0, 60),
    name: d.name?.trim() || nameFromHost(d.spaUrl),
    spaUrl: `${spa.origin}/`,
    apiBase: d.apiBase,
    watchUrlTemplate: '{spa}videolezioni/{course}/{lp}',
    tokenCookie: d.tokenCookie,
    allowedHostSuffixes: [...new Set([registrableDomain(spa.hostname), registrableDomain(api.hostname)])],
    allowInsecureHttp: spa.protocol === 'http:',
  });
}

/**
 * Adds media and subtitle hosts using one real video URL of the student's courses: the media host is its origin,
 * the subtitle host the first candidate whose `.vtt` actually answers.
 */
export async function withMediaHosts(
  profile: PlatformProfile,
  sampleVideoUrl: string,
  exists: (url: string) => Promise<boolean>,
): Promise<PlatformProfile> {
  const media = new URL(sampleVideoUrl);
  const mediaHost = `${media.origin}/`;
  let subtitleHost: string | undefined;
  for (const candidate of subtitleHostCandidates(profile.spaUrl, mediaHost)) {
    const url = vttUrl({ mediaHost, subtitleHost: candidate }, sampleVideoUrl);
    if (url && (await exists(url).catch(() => false))) {
      subtitleHost = candidate;
      break;
    }
  }
  const hosts = [mediaHost, subtitleHost].filter((h): h is string => !!h).map((h) => new URL(h).hostname);
  return parseProfile({
    ...profile,
    mediaHost,
    ...(subtitleHost ? { subtitleHost } : {}),
    allowedHostSuffixes: [...new Set([...profile.allowedHostSuffixes, ...hosts])],
  });
}
