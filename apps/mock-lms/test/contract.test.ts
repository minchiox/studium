// Contract test: the real core client against the mock, through the same cookie flow the app uses.
import fs from 'node:fs';
import path from 'node:path';
import {
  BlockedRequestError,
  careerStats,
  computeProgress,
  fetchTranscripts,
  fetchTransport,
  isPdf,
  LmsClient,
  parseProfile,
  readCookie,
  type TokenSource,
} from '@studium/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockServer } from '../src/server.ts';

const mock = createMockServer({ port: 0, tokenTtlS: 3600 });
let base = '';
let profile: ReturnType<typeof parseProfile>;

/** Minimal cookie jar emulating the WebView: login once, then "load the web app home" to renew. */
class JarTokens implements TokenSource {
  jar = new Map<string, string>();
  renewals = 0;
  private header = () => [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  private absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = (kv ?? '').split('=');
      if (k) this.jar.set(k, v ?? '');
    }
  }
  async login(user = 'demo', pass = 'demo') {
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      body: new URLSearchParams({ username: user, password: pass }),
      redirect: 'manual',
    });
    this.absorb(res);
  }
  async token() {
    return readCookie(this.header(), profile.tokenCookie) || null;
  }
  async renew() {
    this.renewals++;
    const res = await fetch(profile.spaUrl, { headers: { cookie: this.header() }, redirect: 'manual' });
    this.absorb(res);
    return res.status === 200 ? this.token() : null;
  }
}

beforeAll(async () => {
  const port = await mock.listen();
  base = `http://localhost:${port}`;
  const raw = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, '../../../profiles/mock.json'), 'utf8'),
  );
  profile = parseProfile(JSON.parse(JSON.stringify(raw).replaceAll('localhost:4010', `localhost:${port}`)));
});
afterAll(() => mock.close());

describe('mock LMS ↔ core client contract', () => {
  it('rejects wrong credentials', async () => {
    const t = new JarTokens();
    await t.login('demo', 'nope');
    expect(await t.token()).toBeNull();
  });

  it('serves every screen of the app with valid data, never hitting tracking or write endpoints', async () => {
    const tokens = new JarTokens();
    await tokens.login();
    const client = new LmsClient(profile, fetchTransport(), tokens);

    const courses = await client.listCourses();
    expect(courses.map((c) => c.code)).toEqual(['DAT101', 'LAW102', 'ENG103', 'CRY202', 'SEC201', 'TIR203']);
    const lessons = await client.listLessons('DAT101');
    expect(lessons).toHaveLength(4);
    expect(computeProgress(lessons).pending.map((l) => l.number)).toEqual([3, 4]);

    const texts = await fetchTranscripts(client, lessons[0] as NonNullable<(typeof lessons)[0]>);
    expect(texts[0]).toContain('Buongiorno a tutti');

    const pdf = await fetch(lessons[0]?.dispensaUrl as string);
    expect(isPdf(new Uint8Array(await pdf.arrayBuffer()))).toBe(true);

    const career = await client.getCareer();
    expect(careerStats(career)).toMatchObject({ passedExams: 1, weightedAverage: 28 });
    expect((await client.getStudent()).firstName).toBe('Alex');
    expect(await client.getNotices()).toHaveLength(3);
    expect((await client.getAgenda()).map((a) => a.kind)).toEqual(['live', 'booking', 'exam']);

    const att = await client.attachmentRequest('3/calendario-appelli.pdf');
    const attRes = await fetch(att.url, { headers: att.headers });
    expect(isPdf(new Uint8Array(await attRes.arrayBuffer()))).toBe(true);

    await expect(
      client.send(`${profile.apiBase}/student/course/DAT101/lesson/view/inizialize`, { method: 'POST' }),
    ).rejects.toBeInstanceOf(BlockedRequestError);
    expect(mock.stats).toMatchObject({ trackingCalls: 0, blockedWrites: 0 });
  });

  it('renews an expired access token through the web app home, once for concurrent calls', async () => {
    const tokens = new JarTokens();
    await tokens.login();
    const client = new LmsClient(profile, fetchTransport(), tokens);
    await fetch(`${base}/__mock/expire`);
    const [a, b] = await Promise.all([client.getCareer(), client.getNotices()]);
    expect(a.years.length).toBeGreaterThan(0);
    expect(b.length).toBe(3);
    expect(tokens.renewals).toBe(1);
  });

  it('reports signed-out when the refresh cookie is gone', async () => {
    const tokens = new JarTokens();
    await tokens.login();
    tokens.jar.delete('st_refresh');
    await fetch(`${base}/__mock/expire`);
    expect(await new LmsClient(profile, fetchTransport(), tokens).isSignedIn()).toBe(false);
  });

  it('the official player page is where tracking happens (when the student presses play)', async () => {
    const tokens = new JarTokens();
    await tokens.login();
    const html = await (
      await fetch(`${base}/videolezioni/DAT101/101`, {
        headers: { cookie: `st_refresh=${tokens.jar.get('st_refresh')}` },
      })
    ).text();
    expect(html).toContain('/lesson/view/inizialize');
  });
});
