// Mock of a Chamilo-based student web app + REST API, for end-to-end tests and demos.
// Run: node apps/mock-lms/src/server.ts   (Node ≥ 22.18 runs TypeScript directly)
//
// It reproduces the contracts the app depends on:
//  - sign-in page that sets a readable access-token cookie and an HttpOnly refresh cookie;
//  - the web app home renews an expired access token from the refresh cookie (like the real SPA);
//  - Bearer-protected API under /api with the real paths and response shapes;
//  - a lesson player page that calls the attendance-tracking endpoint when the video plays;
//  - /__mock/stats to assert, in tests, that the app itself never calls tracking or write endpoints.
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { COURSES, type MockCourse, notices, OTHER_EXAMS, STUDENT } from './data.ts';
import { pdf } from './pdf.ts';

export interface MockOptions {
  port?: number;
  host?: string;
  /** Access-token lifetime: short values exercise the renewal flow. */
  tokenTtlS?: number;
  username?: string;
  password?: string;
  /** Public base URL as seen by the client (e.g. http://localhost:4010 through `adb reverse`). */
  publicBase?: string;
}

export interface MockStats {
  apiCalls: number;
  trackingCalls: number;
  blockedWrites: number;
  logins: number;
  renewals: number;
  unauthorized: number;
}

const b64url = (s: string) => Buffer.from(s).toString('base64url');

export function createMockServer(opts: MockOptions = {}) {
  const ttl = opts.tokenTtlS ?? 3600;
  const user = opts.username ?? 'demo';
  const pass = opts.password ?? 'demo';
  const tokens = new Map<string, number>(); // token -> exp (s)
  const refresh = new Set<string>();
  const stats: MockStats = {
    apiCalls: 0,
    trackingCalls: 0,
    blockedWrites: 0,
    logins: 0,
    renewals: 0,
    unauthorized: 0,
  };
  let boundPort = opts.port ?? 4010;
  const base = () => opts.publicBase ?? `http://localhost:${boundPort}`;

  const issueToken = (): string => {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const t = `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify({ sub: 'demo', exp, jti: randomBytes(6).toString('hex') }))}.mock`;
    tokens.set(t, exp);
    return t;
  };
  const tokenCookie = (t: string) => `st_token=${t}; Path=/; SameSite=Lax; Max-Age=${ttl}`;

  const cookies = (req: http.IncomingMessage): Record<string, string> =>
    Object.fromEntries(
      (req.headers.cookie ?? '')
        .split(';')
        .map((c) => c.trim().split('='))
        .filter((kv) => kv.length >= 2)
        .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
    );
  const validToken = (t: string | undefined) => !!t && (tokens.get(t) ?? 0) > Date.now() / 1000;

  const send = (
    res: http.ServerResponse,
    status: number,
    body: unknown,
    headers: Record<string, string | string[]> = {},
  ) => {
    const isBuf = Buffer.isBuffer(body);
    const text = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, {
      'content-type': isBuf
        ? 'application/octet-stream'
        : typeof body === 'string'
          ? 'text/html; charset=utf-8'
          : 'application/json',
      ...headers,
    });
    res.end(text);
  };

  const media = (c: MockCourse, lpId: number, n: number, ext: 'mp4' | 'vtt' | 'pdf', host = 'media') =>
    `${base()}/${host}/${c.code}/${lpId}/${ext === 'pdf' ? 'dispensa' : `p${n}`}.${ext}`;

  // ------------------------------------------------------------------ API data builders

  const careerEntry = (e: {
    code: string;
    title: string;
    cfu: number;
    year: number;
    ssd: string;
    vote: number | null;
    date?: string;
  }) => ({
    course_code: e.code,
    exam_course_code: `${e.code}E`,
    required_cfu: e.cfu,
    acquired_cfu: e.vote ? e.cfu : 0,
    year: String(e.year),
    title: e.title,
    ssd: e.ssd,
    type_name: 'ESAME',
    optional_exam: false,
    events: [
      e.vote
        ? {
            status: 'sup',
            status_name: 'SUPERATO',
            date_conv: e.date ?? '',
            vote: e.vote,
            media: true,
            acquired_cfu: e.cfu,
          }
        : {
            status: 'sost',
            status_name: 'DA SOSTENERE',
            date_conv: '',
            vote: 0,
            media: true,
            acquired_cfu: 0,
          },
    ],
  });

  const career = () => {
    const all = [...COURSES.map((c) => ({ ...c })), ...OTHER_EXAMS];
    const acquired = all.reduce((s, e) => s + (e.vote ? e.cfu : 0), 0);
    const required = all.reduce((s, e) => s + e.cfu, 0);
    return {
      data: {
        profile: {
          acquired_cfu: acquired,
          required_cfu: required,
          remaining_cfu: required - acquired,
          num_exam_remaining: all.filter((e) => !e.vote).length,
          current_year: 1,
          vote_weighted: '28',
        },
        career: [1, 2].map((y) => all.filter((e) => e.year === y).map(careerEntry)),
      },
    };
  };

  const lessonItems = (c: MockCourse, lpIndex: number) => {
    const l = c.lessons[lpIndex];
    if (!l) return null;
    return {
      data: [
        { contentType: 'intro', title: 'Obiettivi', description: `<p>${l.objectives}</p>`, percentage: 100 },
        ...l.paragraphs.map((p, i) => ({
          contentType: 'video',
          title: p.title,
          paragNumber: i + 1,
          duration_s: p.durationS,
          videoUrl: media(c, l.lpId, i + 1, 'mp4'),
          percentage: p.progress,
        })),
        { contentType: 'test', title: 'Test di autovalutazione', percentage: l.selfTestDone ? 100 : 0 },
        {
          contentType: 'lesson',
          title: l.title,
          teacherName: c.teacher[0],
          teacherSurname: c.teacher[1],
          mer_BookUrl: media(c, l.lpId, 0, 'pdf'),
        },
      ],
    };
  };

  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  const api = (method: string, path: string, query: URLSearchParams): { status: number; body: unknown } => {
    if (method !== 'GET' && method !== 'HEAD') {
      if (/getNotes$/.test(path)) return { status: 200, body: { data: [] } };
      stats.blockedWrites++;
      return {
        status: 405,
        body: { message: 'mock is read-only: write requests are counted as violations' },
      };
    }
    const progress = (c: MockCourse) =>
      Math.round(c.lessons.reduce((s, l) => s + l.progress, 0) / Math.max(1, c.lessons.length));
    let m: RegExpMatchArray | null;
    if (path === '/student/info') return { status: 200, body: { data: STUDENT } };
    if (path === '/student/evaluation/gr/career') return { status: 200, body: career() };
    if (path === '/student/video-lessons/getCourses')
      return {
        status: 200,
        body: {
          data: COURSES.filter((c) => !c.vote).map((c) => ({
            code: c.code,
            title: c.title,
            cfu: c.cfu,
            progress: progress(c),
            completed: false,
            lp_id: {
              lp_id: c.lessons.find((l) => l.progress < 100)?.lpId ?? c.lessons[0]?.lpId,
              watched_at: `${day(-1)} 18:00:00`,
            },
          })),
        },
      };
    if ((m = path.match(/^\/student\/course\/([A-Z0-9]+)\/video-lessons\/0$/))) {
      const c = COURSES.find((x) => x.code === m?.[1]);
      if (!c) return { status: 404, body: {} };
      return {
        status: 200,
        body: {
          data: c.lessons.map((l, i) => ({
            lp_id: l.lpId,
            display_order: i + 1,
            title: l.title,
            percentage: l.progress,
          })),
        },
      };
    }
    if ((m = path.match(/^\/student\/course\/([A-Z0-9]+)\/video-lesson\/(\d+)\/paragraphs\/\d+$/))) {
      const c = COURSES.find((x) => x.code === m?.[1]);
      const idx = c?.lessons.findIndex((l) => l.lpId === Number(m?.[2])) ?? -1;
      const body = c && idx >= 0 ? lessonItems(c, idx) : null;
      return body ? { status: 200, body } : { status: 404, body: {} };
    }
    if (path === '/student/get-reservations')
      return {
        status: 200,
        body: [
          {
            id_reservation: 1,
            course_code: 'DAT101',
            exam_date: day(12),
            exam_hour: '09:30:00',
            exam_hour_finish: '12:00:00',
            location: 'Sede centrale',
            type_of_exam: 'Scritto online',
            exam_online_flag: 1,
          },
        ],
      };
    if (path === '/student/exam-online/exams-list-active')
      return {
        status: 200,
        body: {
          data: [
            {
              exam_id: 7,
              course_code: 'LAW102',
              title_exam: "Diritto dell'informatica",
              title_module: 'Appello standard',
              date_exam: `${day(20)} 00:00:00`,
              exam_hour: '10:00:00',
              exam_hour_finish: '18:00:00',
              cfu: 9,
              exam_type: 'Scritto online',
            },
          ],
          code: 200,
        },
      };
    if (path === '/student/class/sessions' && query.get('status') === 'scheduled')
      return {
        status: 200,
        body: {
          data: {
            data: [
              {
                id: 5,
                name_class: 'Ripasso: regressione',
                description_class: 'Domande e risposte con il docente',
                start_class: new Date(Date.now() + 3 * 86_400_000).toISOString(),
                end_class: new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString(),
                state: 'scheduled',
                courses: [{ code: 'DAT101', title: 'Analisi dei dati' }],
              },
            ],
            total_records: 1,
          },
          code: 200,
        },
      };
    if (path === '/notice/fp_notices') return { status: 200, body: notices(new Date()) };
    if (path === '/notice/unread') return { status: 200, body: 2 };
    if (path === '/notice/attachment/') {
      const file = query.get('file') ?? '';
      return file ? { status: 200, body: pdf(`Allegato: ${file}`) } : { status: 404, body: {} };
    }
    return { status: 404, body: { message: 'not found' } };
  };

  // ------------------------------------------------------------------ HTML pages

  const page = (title: string, body: string) => `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f4f5f7;color:#1d2433}
.card{background:#fff;border-radius:12px;padding:20px;max-width:420px;margin:40px auto;box-shadow:0 2px 8px #0001}
input,button{display:block;width:100%;box-sizing:border-box;font-size:16px;padding:12px;margin:8px 0;border-radius:8px;border:1px solid #ccd}
button{background:#2d4ea3;color:#fff;border:0}.err{color:#b00020}</style></head><body>${body}</body></html>`;

  const loginPage = (error = '') =>
    page(
      'Accesso studenti',
      `<div class="card"><h1>Accesso studenti</h1><p>Portale di prova (mock).</p>
${error ? `<p class="err" id="error">${error}</p>` : ''}
<form method="post" action="/login"><label>Nome utente<input name="username" id="username" autocomplete="username" autofocus></label>
<label>Password<input name="password" id="password" type="password" autocomplete="current-password"></label>
<button type="submit" id="submit">Accedi</button></form></div>`,
    );

  const playerPage = (course: string, lpId: number) =>
    page(
      'Videolezione',
      `<div class="card"><h1>Videolezione</h1><p id="status">Premi play per guardare la lezione.</p>
<video id="v" controls width="100%" src="${base()}/media/${course}/${lpId}/p1.mp4"></video>
<button id="play" onclick="document.getElementById('v').dispatchEvent(new Event('play'))">Play</button></div>
<script>
// The official player records attendance when the student watches: this is the platform's own tracking.
document.getElementById('v').addEventListener('play', function () {
  fetch('/api/student/course/${course}/lesson/view/inizialize', { method: 'POST', credentials: 'include' })
    .then(function () { document.getElementById('status').textContent = 'Visione registrata dalla piattaforma.'; });
});
</script>`,
    );

  // ------------------------------------------------------------------ router

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const jar = cookies(req);

    if (path === '/__mock/stats') return send(res, 200, stats);
    if (path === '/__mock/reset') {
      Object.assign(stats, {
        apiCalls: 0,
        trackingCalls: 0,
        blockedWrites: 0,
        logins: 0,
        renewals: 0,
        unauthorized: 0,
      });
      return send(res, 200, stats);
    }
    if (path === '/__mock/expire') {
      // Expire every access token now (to exercise renewal in E2E tests).
      for (const t of tokens.keys()) tokens.set(t, 0);
      return send(res, 200, { expired: tokens.size });
    }

    if (path === '/login' && method === 'GET') return send(res, 200, loginPage());
    if (path === '/login' && method === 'POST') {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        const form = new URLSearchParams(raw);
        if (form.get('username') !== user || form.get('password') !== pass) {
          return send(res, 200, loginPage('Credenziali non valide.'));
        }
        stats.logins++;
        const r = randomBytes(16).toString('hex');
        refresh.add(r);
        send(res, 302, '', {
          location: '/',
          'set-cookie': [
            tokenCookie(issueToken()),
            `st_refresh=${r}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
          ],
        });
      });
      return;
    }
    if (path === '/logout') {
      if (jar.st_refresh) refresh.delete(jar.st_refresh);
      return send(res, 302, '', {
        location: '/login',
        'set-cookie': ['st_token=; Path=/; Max-Age=0', 'st_refresh=; Path=/; HttpOnly; Max-Age=0'],
      });
    }

    // Web app home: like the real SPA, it renews an expired access token using the refresh cookie.
    if (path === '/' || path === '/home') {
      const hasRefresh = !!jar.st_refresh && refresh.has(jar.st_refresh);
      if (!hasRefresh) return send(res, 302, '', { location: '/login' });
      const headers: Record<string, string | string[]> = {};
      if (!validToken(jar.st_token)) {
        stats.renewals++;
        headers['set-cookie'] = [tokenCookie(issueToken())];
      }
      return send(
        res,
        200,
        page(
          'Home studente',
          // Like the real web app, the home page calls the student API with the token from its cookie.
          `<div class="card"><h1 id="home">Home studente</h1><p>Benvenuto nel portale di prova.</p></div>
<script>
var m = document.cookie.match(/(?:^|; )st_token=([^;]+)/);
if (m) fetch('/api/student/info', { headers: { Authorization: 'Bearer ' + decodeURIComponent(m[1]) } });
</script>`,
        ),
        headers,
      );
    }

    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/videolezioni\/([A-Z0-9]+)\/(\d+)$/))) {
      if (!jar.st_refresh || !refresh.has(jar.st_refresh)) return send(res, 302, '', { location: '/login' });
      return send(res, 200, playerPage(m[1] as string, Number(m[2])));
    }

    if ((m = path.match(/^\/(media|subs)\/([A-Z0-9]+)\/(\d+)\/(p(\d+)\.(vtt|mp4)|dispensa\.pdf)$/))) {
      const c = COURSES.find((x) => x.code === m?.[2]);
      const l = c?.lessons.find((x) => x.lpId === Number(m?.[3]));
      if (!c || !l) return send(res, 404, '');
      if (m[4] === 'dispensa.pdf') {
        return send(
          res,
          200,
          pdf(
            `${c.title} — ${l.title}`,
            l.paragraphs.flatMap((p) => p.sentences),
          ),
          { 'content-type': 'application/pdf' },
        );
      }
      const para = l.paragraphs[Number(m[5]) - 1];
      if (!para) return send(res, 404, '');
      if (m[6] === 'vtt') {
        let t = 0;
        const cue = (s: number) => new Date(s * 1000).toISOString().slice(11, 23);
        const body = [
          'WEBVTT',
          '',
          ...para.sentences.flatMap((s, i) => [String(i + 1), `${cue(t)} --> ${cue((t += 6))}`, s, '']),
        ].join('\n');
        return send(res, 200, body, { 'content-type': 'text/vtt; charset=utf-8' });
      }
      return send(res, 404, ''); // no video files in the mock
    }

    if (path.startsWith('/api/')) {
      const apiPath = path.slice(4);
      if (/\/lesson\/view(\/|$)/i.test(apiPath)) {
        stats.trackingCalls++;
        return send(res, 200, { data: 'tracked' });
      }
      const auth = req.headers.authorization?.replace(/^Bearer /, '');
      if (!validToken(auth)) {
        stats.unauthorized++;
        return send(res, 401, { message: 'Unauthenticated.' });
      }
      stats.apiCalls++;
      const out = api(method, apiPath, url.searchParams);
      if (Buffer.isBuffer(out.body))
        return send(res, out.status, out.body, { 'content-type': 'application/pdf' });
      return send(res, out.status, out.body);
    }

    return send(res, 404, page('Non trovato', '<p>404</p>'));
  });

  return {
    server,
    stats,
    listen: () =>
      new Promise<number>((resolve) => {
        server.listen(opts.port ?? 4010, opts.host ?? '0.0.0.0', () => {
          const addr = server.address();
          if (typeof addr === 'object' && addr) boundPort = addr.port;
          resolve(boundPort);
        });
      }),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 4010);
  const mock = createMockServer({
    port,
    tokenTtlS: Number(process.env.TOKEN_TTL_S ?? 3600),
    ...(process.env.PUBLIC_BASE ? { publicBase: process.env.PUBLIC_BASE } : {}),
  });
  await mock.listen();
  console.warn(`mock LMS on http://localhost:${port}  (login: demo / demo)`);
}
