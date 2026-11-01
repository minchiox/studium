import type { z } from 'zod';
import { cleanText } from './parse.ts';
import type { ApiCareer, ApiCareerEntry, ApiStudent, Career, CareerExam, Student } from './types.ts';

const n = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : v;

const yearOf = (y: string | number | null | undefined): number | null => {
  const v = typeof y === 'number' ? y : Number.parseInt(y ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : null;
};

export function mapCareerExam(e: z.infer<typeof ApiCareerEntry>): CareerExam {
  // The last event is the current state of the exam (e.g. "DA SOSTENERE", or a passed exam with its grade).
  const ev = e.events?.[e.events.length - 1];
  const requiredCfu = n(e.required_cfu) ?? 0;
  const acquiredCfu = n(e.acquired_cfu) ?? n(ev?.acquired_cfu) ?? 0;
  const vote = n(ev?.vote);
  return {
    code: e.course_code || e.exam_course_code || '',
    title: cleanText(e.title),
    year: yearOf(e.year),
    ssd: e.ssd?.trim() || null,
    type: e.type_name?.trim() || null,
    optional: !!e.optional_exam,
    requiredCfu,
    acquiredCfu,
    // Data-driven: an exam is passed when its credits are acquired.
    passed: requiredCfu > 0 && acquiredCfu >= requiredCfu,
    statusLabel: ev?.status_name?.trim() || '—',
    statusCode: ev?.status?.trim() || '',
    vote: vote && vote > 0 ? vote : null,
    countsForAverage: ev?.media !== false,
    date: ev?.date_conv?.trim() || null,
  };
}

export function mapCareer(raw: z.infer<typeof ApiCareer>): Career {
  const years = new Map<number, CareerExam[]>();
  (raw.career ?? []).forEach((group, i) => {
    for (const entry of group) {
      const exam = mapCareerExam(entry);
      const y = exam.year ?? i + 1;
      years.set(y, [...(years.get(y) ?? []), exam]);
    }
  });
  const p = raw.profile ?? {};
  const platformAvg = Number.parseFloat(String(p.vote_weighted ?? '').replace(',', '.'));
  const all = [...years.values()].flat();
  const requiredCfu = n(p.required_cfu) ?? all.reduce((s, e) => s + e.requiredCfu, 0);
  const acquiredCfu = n(p.acquired_cfu) ?? all.reduce((s, e) => s + e.acquiredCfu, 0);
  return {
    summary: {
      acquiredCfu,
      requiredCfu,
      remainingCfu: n(p.remaining_cfu) ?? Math.max(0, requiredCfu - acquiredCfu),
      examsRemaining: n(p.num_exam_remaining),
      currentYear: n(p.current_year),
      platformWeightedAverage: Number.isFinite(platformAvg) && platformAvg > 0 ? platformAvg : null,
    },
    years: [...years.entries()].sort(([a], [b]) => a - b).map(([year, exams]) => ({ year, exams })),
  };
}

export function mapStudent(raw: z.infer<typeof ApiStudent>): Student {
  const cap = (s: string | null | undefined) =>
    (s ?? '')
      .toLowerCase()
      .replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase())
      .trim();
  return {
    firstName: cap(raw.registry?.firstname),
    lastName: cap(raw.registry?.lastname),
    studentId: raw.enrolment?.official_code || raw.user?.official_code || '',
    degree: raw.enrolment?.corso?.trim() || '',
    enrolmentYear: raw.enrolment?.anno_accademico_immatricolazione || null,
    currentYear: n(raw.enrolment?.anno_attuale_iscrizione),
    status: raw.enrolment?.stato || null,
  };
}

export interface CareerStats {
  passedExams: number;
  totalExams: number;
  acquiredCfu: number;
  requiredCfu: number;
  /** 0–100 */
  cfuPercent: number;
  arithmeticAverage: number | null;
  weightedAverage: number | null;
  /** Weighted average scaled to 110: an estimate, every university applies its own rules. */
  graduationBase: number | null;
  /** Graded exams used for the averages. */
  graded: number;
}

/** Averages over passed exams with a grade that counts. A "30 e lode" encoded as 31 counts as 30. */
export function careerStats(career: Career): CareerStats {
  const exams = career.years.flatMap((y) => y.exams);
  const graded = exams.filter((e) => e.passed && e.vote !== null && e.vote >= 18 && e.countsForAverage);
  const votes = graded.map((e) => ({
    vote: Math.min(30, e.vote as number),
    cfu: e.acquiredCfu || e.requiredCfu,
  }));
  const sumCfu = votes.reduce((s, v) => s + v.cfu, 0);
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const arithmetic = votes.length ? round2(votes.reduce((s, v) => s + v.vote, 0) / votes.length) : null;
  const weighted = sumCfu ? round2(votes.reduce((s, v) => s + v.vote * v.cfu, 0) / sumCfu) : null;
  const { acquiredCfu, requiredCfu } = career.summary;
  return {
    passedExams: exams.filter((e) => e.passed).length,
    totalExams: exams.length,
    acquiredCfu,
    requiredCfu,
    cfuPercent: requiredCfu ? Math.min(100, Math.round((100 * acquiredCfu) / requiredCfu)) : 0,
    arithmeticAverage: arithmetic,
    weightedAverage: weighted,
    graduationBase: weighted === null ? null : round2((weighted * 110) / 30),
    graded: votes.length,
  };
}

export const formatVote = (vote: number | null): string =>
  vote === null ? '—' : vote > 30 ? '30L' : String(vote);
