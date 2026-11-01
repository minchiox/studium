import { z } from 'zod';
import {
  type AgendaItem,
  buildAgenda,
  mapActiveExam,
  mapLiveClass,
  mapNotice,
  mapReservation,
} from './agenda.ts';
import { mapCareer, mapStudent } from './career.ts';
import {
  BlockedRequestError,
  HttpError,
  NetworkError,
  NotFoundError,
  PlatformChangedError,
  SessionExpiredError,
} from './errors.ts';
import { classifyRequest } from './guard.ts';
import { type Logger, silentLogger } from './logger.ts';
import { parseLesson } from './parse.ts';
import { mapPool, sleep } from './pool.ts';
import { type PlatformProfile, watchUrl } from './profile.ts';
import {
  ApiActiveExam,
  ApiCareer,
  ApiCourseProgress,
  ApiLessonItem,
  ApiLessonRef,
  ApiLiveClass,
  ApiNotice,
  ApiReservation,
  ApiStudent,
  type Career,
  type Course,
  type ExamBooking,
  type ExamSession,
  type Lesson,
  type LiveClass,
  type Notice,
  type Student,
} from './types.ts';

// ---------------------------------------------------------------- transport abstraction

export interface HttpRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  text(): Promise<string>;
}

/** Minimal HTTP client: `fetch` in React Native, Playwright's request context in Node. */
export interface Transport {
  request(url: string, req?: HttpRequest): Promise<HttpResponse>;
}

/** Where the access token comes from, and how to get a fresh one. */
export interface TokenSource {
  token(): Promise<string | null>;
  /** Asks the web app to renew the session; resolves to the new token, or null if signed out. */
  renew(): Promise<string | null>;
}

/** `fetch`-based transport with a timeout (works in React Native, browsers and Node ≥ 18). */
export function fetchTransport(fetchImpl: typeof fetch = fetch, defaultTimeoutMs = 30_000): Transport {
  return {
    async request(url, req = {}) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? defaultTimeoutMs);
      try {
        const res = await fetchImpl(url, {
          method: req.method ?? 'GET',
          headers: req.headers,
          body: req.body,
          signal: ctrl.signal,
          credentials: 'include',
        });
        return { status: res.status, text: () => res.text() };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ---------------------------------------------------------------- API paths of the student web app

export const API = {
  student: '/student/info',
  coursesProgress: '/student/video-lessons/getCourses',
  lessons: (course: string) => `/student/course/${course}/video-lessons/0`,
  lessonItems: (course: string, lpId: number) =>
    `/student/course/${course}/video-lesson/${lpId}/paragraphs/${lpId}`,
  career: '/student/evaluation/gr/career',
  reservations: '/student/get-reservations',
  activeExams: '/student/exam-online/exams-list-active',
  notices: '/notice/fp_notices',
  unreadNotices: '/notice/unread',
  noticeAttachment: (file: string) => `/notice/attachment/?file=${encodeURIComponent(file)}`,
  liveClasses: '/student/class/sessions?status=scheduled',
} as const;

/** Course codes are uppercase alphanumerics; validated before building URLs. */
export const COURSE_CODE_RE = /^[A-Z0-9]{3,32}$/;

export function assertCourseCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (!COURSE_CODE_RE.test(c)) throw new NotFoundError(`Course "${code}" (invalid code)`);
  return c;
}

/** The read-only study operations used by transcripts, progress and sync (easy to fake in tests). */
export interface StudyClient {
  listCourses(): Promise<Course[]>;
  listLessons(course: string): Promise<Lesson[]>;
  getLesson(course: string, lessonNumber: number): Promise<Lesson>;
  /** Text resource (e.g. subtitles); null on 4xx. */
  fetchText(url: string): Promise<string | null>;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const REF_TTL_MS = 60_000;

export interface ClientOptions {
  concurrency?: number;
  retries?: number;
  log?: Logger;
  /** Called for every request stopped by the guard (for diagnostics). */
  onBlocked?: (method: string, url: string) => void;
}

export class LmsClient implements StudyClient {
  private readonly log: Logger;
  private readonly concurrency: number;
  private readonly retries: number;
  private renewing: Promise<string | null> | undefined;
  private readonly refCache = new Map<
    string,
    { at: number; refs: Promise<z.infer<typeof ApiLessonRef>[]> }
  >();

  constructor(
    readonly profile: PlatformProfile,
    private readonly http: Transport,
    private readonly tokens: TokenSource,
    private readonly opts: ClientOptions = {},
  ) {
    this.log = opts.log ?? silentLogger;
    this.concurrency = opts.concurrency ?? 4;
    this.retries = opts.retries ?? 2;
  }

  // ------------------------------------------------------------ study

  /** Study-plan courses (from the career) merged with video progress; courses outside the plan are kept too. */
  async listCourses(): Promise<Course[]> {
    const [career, progress] = await Promise.all([
      this.getCareer().catch((err) => {
        this.log.warn('career unavailable, listing courses from video progress only', err);
        return null;
      }),
      this.apiGet(API.coursesProgress, z.array(ApiCourseProgress)),
    ]);
    const byCode = new Map<string, Course>();
    for (const y of career?.years ?? []) {
      for (const e of y.exams) {
        if (!e.code) continue;
        byCode.set(e.code, {
          code: e.code,
          title: e.title,
          cfu: e.requiredCfu || null,
          year: e.year ?? y.year,
          ssd: e.ssd,
          progress: null,
          completed: null,
          exam: e,
          lastWatched: null,
        });
      }
    }
    for (const p of progress) {
      const prev = byCode.get(p.code);
      const lp = p.lp_id?.lp_id;
      byCode.set(p.code, {
        code: p.code,
        title: prev?.title ?? p.title.trim(),
        cfu: prev?.cfu ?? p.cfu ?? null,
        year: prev?.year ?? null,
        ssd: prev?.ssd ?? null,
        progress: p.progress === null || p.progress === undefined ? null : Math.round(p.progress),
        completed: p.completed ?? null,
        exam: prev?.exam ?? null,
        lastWatched: lp ? { lpId: lp, at: p.lp_id?.watched_at ?? '' } : null,
      });
    }
    return [...byCode.values()].sort(
      (a, b) =>
        (a.year ?? 99) - (b.year ?? 99) ||
        (b.progress ?? -1) - (a.progress ?? -1) ||
        a.title.localeCompare(b.title),
    );
  }

  async listLessons(course: string): Promise<Lesson[]> {
    const code = assertCourseCode(course);
    const refs = await this.lessonRefs(code);
    return mapPool(refs, this.concurrency, (ref) => this.loadLesson(code, ref));
  }

  async getLesson(course: string, lessonNumber: number): Promise<Lesson> {
    const code = assertCourseCode(course);
    const ref = (await this.lessonRefs(code)).find((r) => r.display_order === lessonNumber);
    if (!ref) throw new NotFoundError(`Lesson ${lessonNumber} of course ${code}`);
    return this.loadLesson(code, ref);
  }

  watchUrl(course: string, lpId: number): string {
    return watchUrl(this.profile, assertCourseCode(course), lpId);
  }

  // ------------------------------------------------------------ career & agenda

  async getStudent(): Promise<Student> {
    return mapStudent(await this.apiGet(API.student, ApiStudent));
  }

  async getCareer(): Promise<Career> {
    return mapCareer(await this.apiGet(API.career, ApiCareer));
  }

  async getBookings(): Promise<ExamBooking[]> {
    return (await this.apiGet(API.reservations, z.array(ApiReservation), { envelope: false })).map(
      mapReservation,
    );
  }

  async getExamSessions(): Promise<ExamSession[]> {
    return (await this.apiGet(API.activeExams, z.array(ApiActiveExam))).map(mapActiveExam);
  }

  async getLiveClasses(): Promise<LiveClass[]> {
    const page = await this.apiGet(API.liveClasses, z.looseObject({ data: z.array(ApiLiveClass) }));
    return page.data.map(mapLiveClass);
  }

  async getNotices(): Promise<Notice[]> {
    const raw = await this.apiGet(API.notices, z.array(ApiNotice), { envelope: false });
    return raw
      .map(mapNotice)
      .sort((a, b) => (b.start ?? b.createdAt ?? '').localeCompare(a.start ?? a.createdAt ?? ''));
  }

  async getUnreadNotices(): Promise<number> {
    return this.apiGet(API.unreadNotices, z.coerce.number(), { envelope: false });
  }

  /** Bookings, open exam sessions and live classes in one list. Each source failing alone is tolerated. */
  async getAgenda(titles?: Record<string, string>): Promise<AgendaItem[]> {
    const soft = <T>(p: Promise<T[]>, what: string) =>
      p.catch((err) => {
        if (err instanceof SessionExpiredError) throw err;
        this.log.warn(`${what} unavailable`, err);
        return [] as T[];
      });
    const [bookings, exams, live] = await Promise.all([
      soft(this.getBookings(), 'bookings'),
      soft(this.getExamSessions(), 'exam sessions'),
      soft(this.getLiveClasses(), 'live classes'),
    ]);
    return buildAgenda({ bookings, exams, live, ...(titles ? { titles } : {}) });
  }

  /** URL and headers to download a notice attachment (needs the session token). */
  async attachmentRequest(file: string): Promise<{ url: string; headers: Record<string, string> }> {
    return { url: this.profile.apiBase + API.noticeAttachment(file), headers: await this.authHeaders() };
  }

  async authHeaders(): Promise<Record<string, string>> {
    const t = await this.tokens.token();
    return t ? { authorization: `Bearer ${t}` } : {};
  }

  // ------------------------------------------------------------ low level

  /** Session check: one cheap authenticated call. */
  async isSignedIn(): Promise<boolean> {
    try {
      await this.apiGet(API.unreadNotices, z.unknown(), { envelope: false });
      return true;
    } catch (err) {
      if (err instanceof SessionExpiredError) return false;
      throw err;
    }
  }

  async fetchText(url: string): Promise<string | null> {
    const res = await this.send(url);
    if (res.status >= 400 && res.status < 500) return null;
    if (res.status >= 400) throw new HttpError(res.status, url);
    return res.text();
  }

  /** GET on the student API, validated against `schema`. Renews the session once on 401. */
  async apiGet<T extends z.ZodType>(path: string, schema: T, { envelope = true } = {}): Promise<z.infer<T>> {
    const url = this.profile.apiBase + path;
    for (let attempt = 0; ; attempt++) {
      const token = await this.tokens.token();
      const res = await this.send(url, {
        headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });
      if (res.status === 401) {
        if (attempt > 0 || !(await this.renew())) throw new SessionExpiredError();
        continue;
      }
      if (res.status === 404) throw new NotFoundError(path);
      if (res.status >= 400) throw new HttpError(res.status, path, await res.text().catch(() => ''));
      let json: unknown;
      try {
        json = JSON.parse(await res.text());
      } catch {
        throw new PlatformChangedError(path, 'response is not JSON');
      }
      const target = envelope ? z.looseObject({ data: schema }) : schema;
      const parsed = target.safeParse(json);
      if (!parsed.success) throw new PlatformChangedError(path, z.prettifyError(parsed.error).slice(0, 400));
      return (envelope ? (parsed.data as { data: unknown }).data : parsed.data) as z.infer<T>;
    }
  }

  /** Guarded request with retries (GET only) on network errors and transient statuses. */
  async send(url: string, req: HttpRequest = {}): Promise<HttpResponse> {
    const method = (req.method ?? 'GET').toUpperCase();
    const verdict = classifyRequest(this.profile, method, url);
    if (!verdict.allow) {
      this.opts.onBlocked?.(method, url);
      throw new BlockedRequestError(method, url, verdict.reason);
    }
    const retries = method === 'GET' ? this.retries : 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.http.request(url, { ...req, method });
        if (RETRYABLE.has(res.status) && attempt < retries) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        return res;
      } catch (err) {
        if (attempt >= retries) throw new NetworkError(url, err);
        await sleep(400 * 2 ** attempt);
      }
    }
  }

  /** Single-flight: concurrent 401s share one renewal. */
  private renew(): Promise<string | null> {
    this.renewing ??= this.tokens.renew().finally(() => {
      this.renewing = undefined;
    });
    return this.renewing;
  }

  private async loadLesson(code: string, ref: z.infer<typeof ApiLessonRef>): Promise<Lesson> {
    const items = await this.apiGet(API.lessonItems(code, ref.lp_id), z.array(ApiLessonItem));
    return parseLesson(ref, items, this.profile);
  }

  private lessonRefs(code: string): Promise<z.infer<typeof ApiLessonRef>[]> {
    const hit = this.refCache.get(code);
    if (hit && Date.now() - hit.at < REF_TTL_MS) return hit.refs;
    const refs = this.apiGet(API.lessons(code), z.array(ApiLessonRef))
      .then((r) => [...r].sort((a, b) => a.display_order - b.display_order))
      .catch((err) => {
        this.refCache.delete(code);
        throw err;
      });
    this.refCache.set(code, { at: Date.now(), refs });
    return refs;
  }
}
