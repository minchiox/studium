import fs from 'node:fs';
import path from 'node:path';
import type { HttpRequest, HttpResponse, TokenSource, Transport } from '../src/client.ts';
import { parseLesson } from '../src/parse.ts';
import { type PlatformProfile, parseProfile } from '../src/profile.ts';
import { ApiLessonItem, ApiLessonRef, type Lesson } from '../src/types.ts';

export const fixture = (name: string): string =>
  fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');
export const fixtureJson = <T = unknown>(name: string): T => JSON.parse(fixture(name)) as T;
const data = <T>(name: string): T => fixtureJson<{ data: T }>(name).data;

export const PROFILE: PlatformProfile = parseProfile({
  id: 'test-uni',
  name: 'Università di prova',
  spaUrl: 'https://app.example.edu/',
  apiBase: 'https://api.example.edu/',
  watchUrlTemplate: '{spa}videolezioni/{course}/{lp}',
  tokenCookie: 'st_token',
  refreshCookie: 'st_refresh',
  mediaHost: 'https://media.example.edu/',
  subtitleHost: 'https://subs.example.edu/',
  allowedHostSuffixes: ['example.edu'],
});

export const refs = (): ApiLessonRef[] =>
  data<unknown[]>('lesson-refs.json').map((r) => ApiLessonRef.parse(r));
export const items = (): ApiLessonItem[] =>
  data<unknown[]>('lesson-items.json').map((r) => ApiLessonItem.parse(r));

export function makeLesson(number: number, overrides: Partial<Lesson> = {}): Lesson {
  return {
    ...parseLesson(
      { lp_id: number, display_order: number, title: `Lezione ${number}`, percentage: 100 },
      items(),
      PROFILE,
    ),
    ...overrides,
  };
}

/** Realistic JWT shape: base64url JSON header (starts with "eyJ"), payload with `exp`, signature. */
export const jwt = (exp: number) =>
  `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`;

type Handler = (url: URL, req: HttpRequest) => { status: number; body: unknown } | undefined;

/** In-memory HTTP: routes by "METHOD /path" on the API host, records every call. */
export class FakeHttp implements Transport {
  readonly calls: string[] = [];
  validToken = 'good';
  failNext: number[] = [];
  readonly routes = new Map<string, unknown>();
  extra: Handler | undefined;

  constructor() {
    this.routes.set('GET /student/info', fixtureJson('student.json'));
    this.routes.set('GET /student/evaluation/gr/career', fixtureJson('career.json'));
    this.routes.set('GET /student/video-lessons/getCourses', fixtureJson('courses-progress.json'));
    this.routes.set('GET /student/get-reservations', fixtureJson('reservations.json'));
    this.routes.set('GET /student/exam-online/exams-list-active', fixtureJson('exams-active.json'));
    this.routes.set('GET /student/class/sessions', fixtureJson('live-classes.json'));
    this.routes.set('GET /notice/fp_notices', fixtureJson('notices.json'));
    this.routes.set('GET /notice/unread', 3);
    this.routes.set('GET /student/course/ABC101/video-lessons/0', fixtureJson('lesson-refs.json'));
    this.routes.set(
      'GET /student/course/ABC101/video-lesson/5/paragraphs/5',
      fixtureJson('lesson-items.json'),
    );
    this.routes.set(
      'GET /student/course/ABC101/video-lesson/7/paragraphs/7',
      fixtureJson('lesson-items.json'),
    );
  }

  async request(raw: string, req: HttpRequest = {}): Promise<HttpResponse> {
    const url = new URL(raw);
    const method = req.method ?? 'GET';
    this.calls.push(`${method} ${url.pathname}${url.search}`);
    const status = this.failNext.shift();
    if (status === 0) throw new Error('socket hang up');
    if (status) return respond(status, { error: 'boom' });
    const custom = this.extra?.(url, req);
    if (custom) return respond(custom.status, custom.body);
    if (url.host === 'api.example.edu') {
      if (req.headers?.authorization !== `Bearer ${this.validToken}`)
        return respond(401, { message: 'Unauthenticated' });
      const body = this.routes.get(`${method} ${url.pathname}`);
      return body === undefined ? respond(404, {}) : respond(200, body);
    }
    return respond(404, '');
  }
}

const respond = (status: number, body: unknown): HttpResponse => ({
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

export class FakeTokens implements TokenSource {
  renewals = 0;
  constructor(
    public current: string | null = 'good',
    public next: string | null = 'good',
  ) {}
  async token() {
    return this.current;
  }
  async renew() {
    this.renewals++;
    await new Promise((r) => setTimeout(r, 5));
    this.current = this.next;
    return this.next;
  }
}
