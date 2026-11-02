// End-to-end: MCP client ↔ MCP server ↔ core client ↔ mock LMS over real HTTP.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fetchTransport, LmsClient, parseProfile, readCookie, type TokenSource } from '@studium/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockServer } from '../../../apps/mock-lms/src/server.ts';
import type { BrowserTools } from '../src/browser-tools.ts';
import type { ToolClient } from '../src/client.ts';
import { loadConfig } from '../src/config.ts';
import { createServer } from '../src/server.ts';

const mock = createMockServer({ port: 0 });
let base = '';

class JarTokens implements TokenSource {
  jar = new Map<string, string>();
  constructor(private profile: ReturnType<typeof parseProfile>) {}
  private header = () => [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  private absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = (c.split(';')[0] ?? '').split('=');
      if (k) this.jar.set(k, v ?? '');
    }
  }
  async login() {
    this.absorb(
      await fetch(`${base}/login`, {
        method: 'POST',
        body: new URLSearchParams({ username: 'demo', password: 'demo' }),
        redirect: 'manual',
      }),
    );
  }
  async token() {
    return readCookie(this.header(), this.profile.tokenCookie);
  }
  async renew() {
    this.absorb(await fetch(this.profile.spaUrl, { headers: { cookie: this.header() }, redirect: 'manual' }));
    return this.token();
  }
}

async function connect(advancedTools = true) {
  const raw = fs.readFileSync(path.join(import.meta.dirname, '../../../profiles/mock.json'), 'utf8');
  const profile = parseProfile(JSON.parse(raw.replaceAll('localhost:4010', new URL(base).host)));
  const tokens = new JarTokens(profile);
  await tokens.login();
  const lms = new LmsClient(profile, fetchTransport(), tokens);
  const client = Object.assign(lms, {
    async fetchFile(url: string) {
      const res = await fetch(url);
      if (res.status >= 400) return null;
      return {
        body: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') ?? '',
      };
    },
  }) as ToolClient;
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'studium-mcp-'));
  const config = loadConfig({ STUDIUM_WORKSPACE: workspace, STUDIUM_HOME: workspace }, { profile });
  const unused = async (): Promise<never> => {
    throw new Error('not used');
  };
  const browser: BrowserTools = { openPage: unused, click: unused, downloadByClick: unused, get: unused };
  const server = createServer({ config, client, browser, advancedTools });
  const mcp = new Client({ name: 'test', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
    const first = res.content[0];
    return { isError: !!res.isError, text: first?.type === 'text' ? first.text : '' };
  };
  return { mcp, call, workspace };
}

beforeAll(async () => {
  base = `http://localhost:${await mock.listen()}`;
});
afterAll(() => mock.close());

describe('MCP server on the mock platform', () => {
  it('lists study, career and advanced tools with read-only annotations', async () => {
    const { mcp } = await connect();
    const tools = Object.fromEntries((await mcp.listTools()).tools.map((t) => [t.name, t]));
    for (const name of [
      'status',
      'list_courses',
      'list_lessons',
      'get_lesson',
      'get_transcript',
      'course_progress',
      'get_career',
      'list_notices',
      'get_agenda',
      'get_exams',
      'practice_quiz',
    ]) {
      expect(tools[name]?.annotations?.readOnlyHint, name).toBe(true);
    }
    expect(tools.sync_course?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(Object.keys(tools)).toContain('open_page');
    const core = (await (await connect(false)).mcp.listTools()).tools.map((t) => t.name);
    expect(core).not.toContain('open_page');
  });

  it('answers study questions end to end', async () => {
    const { call } = await connect();
    expect(JSON.parse((await call('status')).text)).toMatchObject({
      loggedIn: true,
      platform: 'Università di prova',
    });
    expect(JSON.parse((await call('list_courses')).text).map((c: { code: string }) => c.code)).toContain(
      'DAT101',
    );
    const t = await call('get_transcript', { course: 'DAT101', lesson: 3, paragraph: 1 });
    expect(t.text).toContain('minimi quadrati');
    const lesson = JSON.parse((await call('get_lesson', { course: 'DAT101', lesson: 1 })).text);
    expect(lesson.watchUrl).toMatch(/\/videolezioni\/DAT101\/\d+$/);
    const progress = JSON.parse((await call('course_progress', { course: 'DAT101' })).text);
    expect(progress.pending.map((l: { number: number }) => l.number)).toEqual([3, 4]);
  });

  it('serves career, notices and agenda', async () => {
    const { call } = await connect();
    const career = JSON.parse((await call('get_career')).text);
    expect(career.stats).toMatchObject({ passedExams: 1, weightedAverage: 28 });
    expect(career.years[0].exams.find((e: { title: string }) => e.title === 'Lingua inglese').vote).toBe(
      '28',
    );
    const notices = JSON.parse((await call('list_notices', { limit: 2 })).text);
    expect(notices).toHaveLength(2);
    expect(notices[0].attachments).toEqual(['Calendario appelli']);
    const agenda = JSON.parse((await call('get_agenda')).text);
    expect(agenda.map((a: { kind: string }) => a.kind)).toEqual(['live', 'booking', 'exam']);
    expect(agenda[1].title).toBe('Analisi dei dati');
  });

  it('lists exams and bookable sessions, and builds a practice quiz, without booking anything', async () => {
    const { call } = await connect();
    const exams = JSON.parse((await call('get_exams', { location: 'all' })).text);
    expect(exams.bookings[0]).toMatchObject({ courseCode: 'DAT101', course: 'Analisi dei dati' });
    expect(exams.sessions.map((c: { code: string }) => c.code)).toEqual(['LAW102', 'DAT101']);
    expect(exams.sessions[1].sessions[0].booked).toBe(true);
    expect(exams.resultsToConfirm).toBe(1);
    expect(exams.bookingUrl).toMatch(/\/appelli$/);
    const seat = JSON.parse((await call('get_exams', {})).text);
    expect(seat.seat).toBe('Sede centrale');
    const quiz = JSON.parse((await call('practice_quiz', { course: 'DAT101', lesson: 3, count: 4 })).text);
    expect(quiz.length).toBeGreaterThan(0);
    for (const q of quiz) expect(q.options).toContain(q.answer);
  });

  it('syncs a course into the workspace and refuses paths outside it', async () => {
    const { call, workspace } = await connect();
    const res = JSON.parse((await call('sync_course', { course: 'LAW102' })).text);
    expect(res).toMatchObject({
      folder: 'Diritto-dell-informatica',
      lessons: 3,
      dispense: 3,
      transcripts: 3,
      errors: [],
    });
    const dir = path.join(workspace, 'Diritto-dell-informatica', 'risorse');
    expect(fs.readdirSync(path.join(dir, 'dispense'))).toHaveLength(3);
    expect(fs.readFileSync(path.join(dir, 'indice.md'), 'utf8')).toContain('Reati informatici');
    expect((await call('sync_course', { course: 'LAW102', folder: '../escape' })).text).toMatch(
      /PATH_OUTSIDE_WORKSPACE/,
    );
  });

  it('reports errors as tool errors with codes, and the platform never sees tracking or writes', async () => {
    const { call } = await connect();
    expect((await call('get_lesson', { course: 'DAT101', lesson: 99 })).text).toMatch(/^Error \[NOT_FOUND\]/);
    expect((await call('list_lessons', { course: '../etc' })).isError).toBe(true);
    expect(mock.stats).toMatchObject({ trackingCalls: 0, blockedWrites: 0 });
  });
});
