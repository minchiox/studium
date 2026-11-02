// Host and domain helpers shared by profile validation, discovery and the navigation guard.
// Pure functions without Node or DOM dependencies (they run on Hermes too).

/**
 * Public suffixes made of more than one label: registries (`ac.uk`) and shared hosting platforms
 * (`github.io`), under which unrelated parties own sibling domains. A static subset of the Public Suffix List
 * (https://publicsuffix.org), enough for the hosts these platforms use: an unknown multi-label suffix makes
 * `registrableDomain` too broad by one label, and profile validation then rejects it as a public suffix only if
 * it is listed here, so keep this list generous rather than short.
 * Single-label suffixes (`it`, `com`, `edu`, …) need no listing: every TLD is a public suffix.
 */
export const MULTI_LABEL_PUBLIC_SUFFIXES: ReadonlySet<string> = new Set([
  // Italy (second-level suffixes registered in the PSL)
  'edu.it',
  'gov.it',
  'roma.it',
  'rm.it',
  'milano.it',
  'mi.it',
  'napoli.it',
  'na.it',
  'torino.it',
  'to.it',
  // United Kingdom
  'ac.uk',
  'co.uk',
  'gov.uk',
  'ltd.uk',
  'me.uk',
  'net.uk',
  'nhs.uk',
  'org.uk',
  'plc.uk',
  'sch.uk',
  // Elsewhere: academic and commercial second levels
  'ac.at',
  'co.at',
  'com.au',
  'edu.au',
  'gov.au',
  'net.au',
  'org.au',
  'com.br',
  'edu.br',
  'com.cn',
  'edu.cn',
  'edu.es',
  'com.es',
  'com.hk',
  'edu.hk',
  'ac.il',
  'co.il',
  'ac.in',
  'co.in',
  'edu.in',
  'ac.jp',
  'co.jp',
  'ne.jp',
  'or.jp',
  'ac.kr',
  'co.kr',
  'com.mx',
  'edu.mx',
  'ac.nz',
  'co.nz',
  'com.pl',
  'edu.pl',
  'com.sg',
  'edu.sg',
  'com.tr',
  'edu.tr',
  'ac.za',
  'co.za',
  // Shared hosting and cloud platforms (PSL private section)
  'amazonaws.com',
  's3.amazonaws.com',
  'cloudfront.net',
  'appspot.com',
  'azurewebsites.net',
  'azureedge.net',
  'cloudapp.net',
  'blob.core.windows.net',
  'trafficmanager.net',
  'blogspot.com',
  'firebaseapp.com',
  'web.app',
  'github.io',
  'githubusercontent.com',
  'gitlab.io',
  'herokuapp.com',
  'netlify.app',
  'vercel.app',
  'pages.dev',
  'workers.dev',
  'onrender.com',
  'fly.dev',
  'ngrok.io',
  'ngrok-free.app',
  'wordpress.com',
]);

/** Hosts reachable over plain HTTP: only the development machine (mock LMS, Android emulator). */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

const isIpLiteral = (host: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');

/** A syntactically valid DNS hostname (no scheme, port, path or wildcard). `localhost` counts. */
export function isValidHostname(host: string): boolean {
  const h = normalizeHost(host);
  if (!h || h.length > 253) return false;
  if (isIpLiteral(h)) return true;
  return h.split('.').every((label) => LABEL_RE.test(label));
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(normalizeHost(host));
}

/**
 * True when `suffix` is a public suffix: anyone can register a domain under it, so trusting it would trust
 * strangers. Every single label is one (`it`, `edu`, `com`), except `localhost`.
 */
export function isPublicSuffix(suffix: string): boolean {
  const s = normalizeHost(suffix);
  if (s === 'localhost') return false;
  if (!s.includes('.')) return true;
  return MULTI_LABEL_PUBLIC_SUFFIXES.has(s);
}

/** The public suffix `host` sits under: the longest listed one, else its TLD. */
export function publicSuffixOf(host: string): string {
  const labels = normalizeHost(host).split('.').filter(Boolean);
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.');
    if (MULTI_LABEL_PUBLIC_SUFFIXES.has(candidate)) return candidate;
  }
  return labels[labels.length - 1] ?? '';
}

/**
 * The domain a single owner controls: the public suffix plus one label.
 * "lms.uni.example.edu" → "example.edu", "lms.uni.ac.uk" → "uni.ac.uk", "uni.github.io" → "uni.github.io".
 * IP literals, `localhost` and bare suffixes are returned unchanged.
 */
export function registrableDomain(host: string): string {
  const h = normalizeHost(host);
  if (h === 'localhost' || isIpLiteral(h)) return h;
  const labels = h.split('.').filter(Boolean);
  const suffix = publicSuffixOf(h);
  const suffixLabels = suffix.split('.').length;
  if (labels.length <= suffixLabels) return h;
  return labels.slice(-(suffixLabels + 1)).join('.');
}

/** `host` equals one of the suffixes or is a subdomain of it ("a.example.edu" matches "example.edu"). */
export function hostMatchesSuffixes(host: string, suffixes: readonly string[]): boolean {
  const h = normalizeHost(host);
  return suffixes.some((raw) => {
    const s = normalizeHost(raw);
    return !!s && (h === s || h.endsWith(`.${s}`));
  });
}
