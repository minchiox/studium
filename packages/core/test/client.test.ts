import { describe, expect, it } from 'vitest';
import { assertCourseCode, LmsClient } from '../src/client.ts';
import {
  BlockedRequestError,
  NetworkError,
  NotFoundError,
  PlatformChangedError,
  SessionExpiredError,
} from '../src/errors.ts';
import { assertHostAllowed, classifyRequest, isHostAllowed } from '../src/guard.ts';
import { parseProfile, watchUrl } from '../src/profile.ts';
import { FakeHttp, FakeTokens, PROFILE } from './helpers.ts';

const make = (tokens = new FakeTokens(), http = new FakeHttp()) => ({
  http,
  tokens,
  client: new LmsClient(PROFILE, http, tokens, { retries: 2 }),
});

describe('profile', () => {
  it('normalizes the API base and builds watch URLs', () => {
    expect(PROFILE.apiBase).toBe('https://api.example.edu');
    expect(watchUrl(PROFILE, 'ABC101', 7)).toBe('https://app.example.edu/videolezioni/ABC101/7');
  });
  it('rejects incomplete profiles with a readable error', () => {
    expect(() => parseProfile({ id: 'X Y' })).toThrow(/Invalid platform profile/);
  });
});

describe('guard — the read-only guarantee', () => {
  const API = 'https://api.example.edu';
  it.each(['GET', 'POST', 'PUT'])('blocks attendance tracking with %s, on any host', (m) => {
    expect(classifyRequest(PROFILE, m, `${API}/student/course/X/lesson/view/inizialize`).allow).toBe(false);
    expect(classifyRequest(PROFILE, m, 'https://other.example.org/a/lesson/view').allow).toBe(false);
  });
  it('blocks writes to the student API but not session maintenance or read-only POSTs', () => {
    expect(classifyRequest(PROFILE, 'POST', `${API}/student/course/X/progress`).allow).toBe(false);
    expect(classifyRequest(PROFILE, 'DELETE', `${API}/notice/1`).allow).toBe(false);
    expect(classifyRequest(PROFILE, 'POST', `${API}/oauth/token`).allow).toBe(true);
    expect(classifyRequest(PROFILE, 'POST', `${API}/student/video-lessons/getNotes`).allow).toBe(true);
  });
  it('lets reads, other hosts and non-network URLs through; ignores look-alike paths', () => {
    expect(classifyRequest(PROFILE, 'GET', `${API}/student/info`).allow).toBe(true);
    expect(classifyRequest(PROFILE, 'POST', 'https://app.example.edu/form').allow).toBe(true);
    expect(classifyRequest(PROFILE, 'GET', 'data:text/plain,hi').allow).toBe(true);
    expect(classifyRequest(PROFILE, 'GET', `${API}/lesson/viewer`).allow).toBe(true);
  });
  it('host allowlist: https only, real suffix match, mock profiles may use http', () => {
    expect(isHostAllowed(PROFILE, 'https://media.example.edu/a.pdf')).toBe(true);
    expect(isHostAllowed(PROFILE, 'https://example.edu.evil.com/')).toBe(false);
    expect(isHostAllowed(PROFILE, 'https://evilexample.edu/')).toBe(false);
    expect(isHostAllowed(PROFILE, 'http://media.example.edu/')).toBe(false);
    // Plain HTTP only towards the development machine (mock LMS), even with allowInsecureHttp.
    expect(isHostAllowed({ ...PROFILE, allowInsecureHttp: true }, 'http://media.example.edu/')).toBe(false);
    expect(
      isHostAllowed(
        { ...PROFILE, allowedHostSuffixes: ['localhost'], allowInsecureHttp: true },
        'http://localhost:4010/',
      ),
    ).toBe(true);
    expect(() => assertHostAllowed(PROFILE, 'https://evil.com')).toThrow(/Host not allowed/);
  });
});

describe('LmsClient', () => {
  it('merges study plan and video progress into courses', async () => {
    const courses = await make().client.listCourses();
    expect(courses.map((c) => [c.code, c.year, c.progress])).toEqual([
      ['ABC101', 1, 72],
      ['ABC103', 1, null], // same year and no progress: alphabetical ("Diritto…" < "Lingua…")
      ['ABC102', 1, null],
      ['ABC104', 1, null],
      ['ABD201', 2, 5], // plan code ABC201, LMS code ABD201: paired by title
      ['ZZZ999', null, 10],
      ['YYY888', null, 0],
    ]);
    const first = courses[0];
    expect(first?.exam?.passed).toBe(true);
    expect(first?.lastWatched).toEqual({ lpId: 7, at: '2026-10-31 18:00:00' });
    // lp_id is "" or 0 for courses never opened: no "last watched", no PLATFORM_CHANGED
    expect(courses.find((c) => c.code === 'ZZZ999')?.lastWatched).toBeNull();
  });

  it('still lists courses when the career is unavailable', async () => {
    const { client, http } = make();
    http.routes.delete('GET /student/evaluation/gr/career');
    expect((await client.listCourses()).map((c) => c.code)).toEqual(['ABC101', 'ZZZ999', 'ABD201', 'YYY888']); // by progress without a plan
  });

  it('loads lessons in display order with subtitles mapped through the profile', async () => {
    const lessons = await make().client.listLessons('abc101');
    expect(lessons.map((l) => [l.number, l.lpId])).toEqual([
      [1, 5],
      [2, 7],
    ]);
    expect(lessons[0]?.paragraphs[0]?.vttUrl).toMatch(/^https:\/\/subs\.example\.edu\//);
  });

  it('caches lesson refs between calls', async () => {
    const { client, http } = make();
    await client.getLesson('ABC101', 1);
    await client.getLesson('ABC101', 2);
    expect(http.calls.filter((c) => c.endsWith('/video-lessons/0'))).toHaveLength(1);
    await expect(client.getLesson('ABC101', 9)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('renews the session once on 401, sharing the renewal between concurrent calls', async () => {
    const tokens = new FakeTokens('expired', 'good');
    const { client } = make(tokens);
    const [a, b, c] = await Promise.all([client.getCareer(), client.getStudent(), client.getNotices()]);
    expect(a.summary.acquiredCfu).toBe(15);
    expect(b.firstName).toBe('Maria');
    expect(c).toHaveLength(2);
    expect(tokens.renewals).toBe(1);
  });

  it('throws SessionExpired when renewal fails', async () => {
    const { client } = make(new FakeTokens('expired', null));
    await expect(client.getCareer()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(await make(new FakeTokens('expired', null)).client.isSignedIn()).toBe(false);
  });

  it('retries transient failures on GET, then gives up with a NetworkError', async () => {
    const { client, http } = make();
    http.failNext = [503, 0];
    expect(await client.getUnreadNotices()).toBe(3);
    http.failNext = [0, 0, 0];
    await expect(client.getUnreadNotices()).rejects.toBeInstanceOf(NetworkError);
  });

  it('reports a changed platform instead of returning wrong data', async () => {
    const { client, http } = make();
    http.routes.set('GET /student/get-reservations', [{ nope: true }]);
    await expect(client.getBookings()).rejects.toBeInstanceOf(PlatformChangedError);
  });

  it('never sends tracking or write requests', async () => {
    const blocked: string[] = [];
    const http = new FakeHttp();
    const client = new LmsClient(PROFILE, http, new FakeTokens(), {
      onBlocked: (m, u) => blocked.push(`${m} ${u}`),
    });
    await expect(
      client.send(`${PROFILE.apiBase}/student/course/X/lesson/view/inizialize`, { method: 'POST' }),
    ).rejects.toBeInstanceOf(BlockedRequestError);
    await expect(client.send(`${PROFILE.apiBase}/student/x`, { method: 'PATCH' })).rejects.toBeInstanceOf(
      BlockedRequestError,
    );
    expect(http.calls).toEqual([]);
    expect(blocked).toHaveLength(2);
  });

  it('builds the agenda from all sources and tolerates one failing', async () => {
    const { client, http } = make();
    http.routes.delete('GET /student/class/sessions');
    const agenda = await client.getAgenda({ ABC103: 'Diritto' });
    // the booking for ABC103 on 2026-11-20 hides the matching open session
    expect(agenda.map((a) => a.kind)).toEqual(['booking', 'exam']);
  });

  it('exposes attachment downloads with auth headers, and validates course codes', async () => {
    const { client } = make();
    expect(await client.attachmentRequest('1/a b.pdf')).toEqual({
      url: 'https://api.example.edu/notice/attachment/?file=1%2Fa%20b.pdf',
      headers: { authorization: 'Bearer good' },
    });
    expect(() => assertCourseCode('../etc')).toThrow(NotFoundError);
    expect(assertCourseCode(' abc101 ')).toBe('ABC101');
  });

  it('shares one request between screens asking for the same data at once', async () => {
    const { client, http } = make();
    const [a, b] = await Promise.all([client.getBookings(), client.getExamsOverview()]);
    expect(b.bookings).toEqual(a);
    expect(http.calls.filter((c) => c === 'GET /student/get-reservations')).toHaveLength(1);
    // once settled, a new call goes to the network again (no stale cache in the client)
    await client.getBookings();
    expect(http.calls.filter((c) => c === 'GET /student/get-reservations')).toHaveLength(2);
  });

  it('fetchText returns null on 4xx', async () => {
    expect(await make().client.fetchText('https://subs.example.edu/missing.vtt')).toBeNull();
  });
});
