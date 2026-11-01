import { describe, expect, it } from 'vitest';
import { buildAgenda, mapNotice, wallClock } from '../src/agenda.ts';
import { careerStats, formatVote, mapCareer, mapStudent } from '../src/career.ts';
import { mapPool, sleep } from '../src/pool.ts';
import { computeProgress } from '../src/progress.ts';
import { highlight, normalize, search } from '../src/search.ts';
import { fetchTranscripts, renderLessonMarkdown } from '../src/transcript.ts';
import { ApiCareer, ApiNotice, ApiStudent } from '../src/types.ts';
import { fixture, fixtureJson, makeLesson } from './helpers.ts';

const career = () => mapCareer(ApiCareer.parse(fixtureJson<{ data: unknown }>('career.json').data));

describe('career', () => {
  it('groups exams by year and maps outcomes', () => {
    const c = career();
    expect(c.years.map((y) => [y.year, y.exams.length])).toEqual([
      [1, 4],
      [2, 1],
    ]);
    const [data, english, law, internship] = c.years[0]?.exams ?? [];
    expect(data).toMatchObject({
      code: 'ABC101',
      passed: true,
      vote: 28,
      statusLabel: 'SUPERATO',
      ssd: 'SECS-S/01',
    });
    expect(english?.vote).toBe(31);
    expect(law).toMatchObject({ passed: false, vote: null, statusLabel: 'DA SOSTENERE' });
    expect(internship).toMatchObject({ passed: true, vote: null, countsForAverage: false });
    expect(c.years[1]?.exams[0]?.optional).toBe(true);
    expect(c.summary).toMatchObject({ acquiredCfu: 15, requiredCfu: 120, platformWeightedAverage: 27.6 });
  });

  it('computes averages counting 30L as 30 and estimates the graduation base', () => {
    const s = careerStats(career());
    // (28·9 + 30·6) / 15 = 28.8
    expect(s).toMatchObject({
      passedExams: 3,
      totalExams: 5,
      graded: 2,
      arithmeticAverage: 29,
      weightedAverage: 28.8,
      graduationBase: 105.6,
      cfuPercent: 13,
    });
    expect(formatVote(31)).toBe('30L');
    expect(formatVote(null)).toBe('—');
  });

  it('handles an empty career', () => {
    const s = careerStats(mapCareer({ profile: null, career: null }));
    expect(s).toMatchObject({ weightedAverage: null, graduationBase: null, cfuPercent: 0 });
  });

  it('maps the student with proper capitalization', () => {
    const st = mapStudent(ApiStudent.parse(fixtureJson<{ data: unknown }>('student.json').data));
    expect(st).toEqual({
      firstName: 'Maria',
      lastName: 'De Rossi-Bianchi',
      studentId: '0000001234',
      degree: 'LM-00 - Corso di prova',
      enrolmentYear: '2026/2027',
      currentYear: 1,
      status: 'Regolare',
    });
  });
});

describe('notices and agenda', () => {
  it('maps notices with plain text and attachments', () => {
    const n = mapNotice(ApiNotice.parse(fixtureJson<unknown[]>('notices.json')[0]));
    expect(n).toMatchObject({
      id: '11',
      title: "Sessione d'esame di dicembre",
      text: 'Le prenotazioni aprono il 15 novembre.',
      category: 'Didattica',
    });
    expect(n.attachments[0]).toEqual({
      id: '5',
      title: 'Calendario',
      file: '1/calendario.pdf',
      size: '120 KB',
      extension: 'pdf',
    });
  });

  it('sorts the agenda, hides past items and sessions already booked', () => {
    const now = wallClock('2026-11-01', '12:00');
    const agenda = buildAgenda(
      {
        bookings: [
          {
            id: '1',
            courseCode: 'A',
            date: '2026-11-20',
            start: '09:30',
            end: null,
            location: 'Roma',
            type: 'Scritto',
            online: false,
          },
        ],
        exams: [
          {
            id: '9',
            courseCode: 'A',
            title: 'A',
            module: null,
            date: '2026-11-20',
            start: '09:30',
            end: null,
            cfu: 9,
            type: null,
          },
          {
            id: '8',
            courseCode: 'B',
            title: 'B',
            module: 'Appello',
            date: '2026-11-05',
            start: null,
            end: null,
            cfu: 6,
            type: null,
          },
          {
            id: '7',
            courseCode: 'C',
            title: 'C',
            module: null,
            date: '2026-10-01',
            start: '10:00',
            end: null,
            cfu: 6,
            type: null,
          },
        ],
        live: [
          {
            id: '3',
            title: 'Live',
            description: null,
            start: '2026-11-10T14:00:00.000Z',
            end: null,
            state: null,
            courses: [],
          },
        ],
        titles: { A: 'Corso A' },
      },
      now,
    );
    expect(agenda.map((a) => `${a.kind}:${a.title}`)).toEqual(['exam:B', 'live:Live', 'booking:Corso A']);
    expect(agenda[2]?.subtitle).toBe('Scritto · Roma');
  });
});

describe('search', () => {
  const docs = [
    {
      id: '1',
      title: 'Regressione lineare',
      text: 'Il modello di regressione stima la relazione tra variabili.',
    },
    {
      id: '2',
      title: 'Introduzione',
      text: 'Perché studiare la statistica? La regressione è uno strumento.',
    },
    { id: '3', title: 'Altro', text: 'Niente di rilevante.' },
  ];
  it('requires all terms, ranks title matches first and is accent-insensitive', () => {
    expect(search(docs, 'regressione').map((h) => h.id)).toEqual(['1', '2']);
    expect(search(docs, 'perche regressione').map((h) => h.id)).toEqual(['2']);
    expect(search(docs, 'x')).toEqual([]);
    expect(search(docs, 'regressione')[1]?.snippet).toContain('regressione');
  });
  it('highlights matches preserving the original text', () => {
    const parts = highlight('Perché sì', 'perche');
    expect(parts).toEqual([
      { text: 'Perché', match: true },
      { text: ' sì', match: false },
    ]);
    expect(normalize('ÀÈ')).toBe('ae');
  });
});

describe('progress and transcripts', () => {
  it('weights by duration and separates videos from self-tests', () => {
    const done = makeLesson(1, { progress: 100 });
    for (const p of done.paragraphs) p.progress = 100;
    const partial = makeLesson(2, { progress: 60 });
    const p = computeProgress([done, partial]);
    expect(p).toMatchObject({
      lessons: 2,
      watchedLessons: 1,
      totalS: 1914,
      remainingS: 150,
      videoPercent: 92,
    });
    expect(p.selfTestsPending).toEqual([1, 2]);
  });

  it('fetches transcripts and renders Markdown', async () => {
    const l = makeLesson(3);
    const vtt = fixture('sample.vtt');
    const texts = await fetchTranscripts({ fetchText: async (u) => (u.endsWith('__1.vtt') ? vtt : null) }, l);
    expect(texts[0]).toContain('Buongiorno a tutti.');
    expect(texts[1]).toBeNull();
    const md = renderLessonMarkdown(l, texts);
    expect(md).toMatch(/^# Lezione 3 — Lezione 3\n\nDocente: Mario Rossi/);
    expect(md).toContain('_Trascrizione non disponibile._');
  });

  it('mapPool keeps order within the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapPool([20, 5, 10, 1], 2, async (ms, i) => {
      peak = Math.max(peak, ++inFlight);
      await sleep(ms);
      inFlight--;
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });
});
