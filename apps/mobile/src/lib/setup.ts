import {
  fetchTransport,
  findApiBase,
  findTokenCookie,
  LmsClient,
  type PlatformProfile,
  profileFromDiscovery,
  withMediaHosts,
} from '@studium/core';

/**
 * Injected in the university's sign-in page during setup. It reports two things the web app itself exposes:
 * the URLs it has requested (Resource Timing API: no request is intercepted or modified) and the cookies whose
 * value looks like a JWT. Nothing else leaves the page; credentials are never read.
 */
export function discoveryScript(): string {
  return `(function () {
  function post(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function jwtCookies() {
    var out = {};
    (document.cookie ? document.cookie.split(';') : []).forEach(function (c) {
      var i = c.indexOf('='); if (i < 1) return;
      var k = c.slice(0, i).trim(), v = c.slice(i + 1).trim();
      try { v = decodeURIComponent(v); } catch (e) {}
      if (/^eyJ[\\w-]*\\.[\\w-]+\\.[\\w-]*$/.test(v)) out[k] = v;
    });
    return out;
  }
  function urls() {
    try { return performance.getEntriesByType('resource').map(function (e) { return e.name; }).slice(-300); }
    catch (e) { return []; }
  }
  function tick() {
    post({ type: 'probe', cookies: jwtCookies(), urls: urls(), page: location.href });
    setTimeout(tick, 1000);
  }
  tick();
})(); true;`;
}

export interface Probe {
  cookies: Record<string, string>;
  urls: string[];
}

/** What the probes collected so far tell us: the token and the API base, when both are known. */
export function interpretProbes(
  probes: Probe[],
): { token: string; tokenCookie: string; apiBase: string } | null {
  const last = probes[probes.length - 1];
  const tok = last ? findTokenCookie(last.cookies) : null;
  const apiBase = findApiBase(probes.flatMap((p) => p.urls));
  return tok && apiBase ? { token: tok.token, tokenCookie: tok.name, apiBase } : null;
}

export type SetupStep = 'verify' | 'media' | 'done';

/**
 * Turns what the sign-in revealed into a working profile: checks the API answers with the token, then looks
 * at one lesson of the student's courses to find where videos and subtitles live.
 */
export async function buildProfile(
  spaUrl: string,
  found: { token: string; tokenCookie: string; apiBase: string },
  onStep: (s: SetupStep) => void,
): Promise<PlatformProfile> {
  onStep('verify');
  let profile = profileFromDiscovery({ spaUrl, apiBase: found.apiBase, tokenCookie: found.tokenCookie });
  const client = () =>
    new LmsClient(profile, fetchTransport(fetch, 20_000), {
      token: async () => found.token,
      renew: async () => null,
    });
  if (!(await client().isSignedIn())) {
    throw new Error('L’accesso è riuscito, ma l’API della piattaforma non risponde come previsto.');
  }

  onStep('media');
  try {
    const courses = await client().listCourses();
    const withLessons = courses.filter((c) => c.progress !== null).slice(0, 3);
    for (const c of withLessons) {
      const lesson = await client().getLesson(c.code, 1);
      const video = lesson.paragraphs.find((p) => p.videoUrl)?.videoUrl;
      if (!video) continue;
      profile = await withMediaHosts(profile, video, async (url) => {
        const res = await fetch(url, { method: 'GET' });
        return res.status === 200;
      });
      break;
    }
  } catch {
    // Videos and subtitles are optional: the app works without transcripts.
  }
  onStep('done');
  return profile;
}
