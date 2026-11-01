import type { z } from 'zod';
import { cleanText, htmlToText } from './parse.ts';
import type {
  ApiActiveExam,
  ApiLiveClass,
  ApiNotice,
  ApiReservation,
  ExamBooking,
  ExamSession,
  LiveClass,
  Notice,
} from './types.ts';

const hhmm = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null);
const ymd = (d: string): string => d.slice(0, 10);

export function mapReservation(r: z.infer<typeof ApiReservation>): ExamBooking {
  return {
    id: String(r.id_reservation),
    courseCode: r.course_code,
    date: ymd(r.exam_date),
    start: hhmm(r.exam_hour),
    end: hhmm(r.exam_hour_finish),
    location: r.location?.trim() || null,
    type: r.type_of_exam?.trim() || null,
    online: r.exam_online_flag === 1,
  };
}

export function mapActiveExam(e: z.infer<typeof ApiActiveExam>): ExamSession {
  return {
    id: String(e.exam_id),
    courseCode: e.course_code,
    title: cleanText(e.title_exam),
    module: e.title_module?.trim() || null,
    date: ymd(e.date_exam),
    start: hhmm(e.exam_hour),
    end: hhmm(e.exam_hour_finish),
    cfu: e.cfu ?? null,
    type: e.exam_type?.trim() || null,
  };
}

export function mapNotice(raw: z.infer<typeof ApiNotice>): Notice {
  const html = raw.body ?? '';
  return {
    id: String(raw.id),
    title: cleanText(raw.title),
    html,
    text: htmlToText(html),
    category: raw.notice_category?.name?.trim() || null,
    start: raw.start ?? null,
    end: raw.end ?? null,
    createdAt: raw.created_at ?? null,
    attachments: (raw.attachments ?? []).map((a) => ({
      id: String(a.id),
      title: a.title?.trim() || a.file.split('/').pop() || 'allegato',
      file: a.file,
      size: a.filesize ?? null,
      extension: a.typefile?.extension?.toLowerCase() ?? a.file.split('.').pop()?.toLowerCase() ?? null,
    })),
  };
}

export function mapLiveClass(c: z.infer<typeof ApiLiveClass>): LiveClass {
  return {
    id: String(c.id),
    title: cleanText(c.name_class) || 'Lezione live',
    description: c.description_class?.trim() || null,
    start: c.start_class,
    end: c.end_class ?? null,
    state: c.state ?? null,
    courses: (c.courses ?? []).map((x) => ({ code: x.code, title: cleanText(x.title) || x.code })),
  };
}

export type AgendaKind = 'booking' | 'exam' | 'live';

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  subtitle: string | null;
  /** Epoch ms. Exam dates/times are wall-clock times, interpreted in the device time zone. */
  startsAt: number;
  endsAt: number | null;
  courseCode: string | null;
}

/** "2026-11-02" + "09:30" → epoch ms in the device time zone. */
export function wallClock(date: string, time: string | null): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).getTime();
}

/**
 * Merges bookings, open exam sessions and live classes into one chronological agenda,
 * dropping exam sessions already covered by a booking for the same course and day.
 */
export function buildAgenda(
  input: {
    bookings: ExamBooking[];
    exams: ExamSession[];
    live: LiveClass[];
    titles?: Record<string, string>;
  },
  now = Date.now(),
): AgendaItem[] {
  const title = (code: string) => input.titles?.[code] ?? code;
  const booked = new Set(input.bookings.map((b) => `${b.courseCode}|${b.date}`));
  const items: AgendaItem[] = [
    ...input.bookings.map((b) => ({
      id: `booking:${b.id}`,
      kind: 'booking' as const,
      title: title(b.courseCode),
      subtitle: [b.type, b.online ? 'online' : b.location].filter(Boolean).join(' · ') || null,
      startsAt: wallClock(b.date, b.start),
      endsAt: b.end ? wallClock(b.date, b.end) : null,
      courseCode: b.courseCode,
    })),
    ...input.exams
      .filter((e) => !booked.has(`${e.courseCode}|${e.date}`))
      .map((e) => ({
        id: `exam:${e.id}`,
        kind: 'exam' as const,
        title: e.title,
        subtitle: [e.module, e.type].filter(Boolean).join(' · ') || null,
        startsAt: wallClock(e.date, e.start),
        endsAt: e.end ? wallClock(e.date, e.end) : null,
        courseCode: e.courseCode,
      })),
    ...input.live.map((c) => ({
      id: `live:${c.id}`,
      kind: 'live' as const,
      title: c.title,
      subtitle: c.courses.map((x) => x.title).join(', ') || c.description,
      startsAt: Date.parse(c.start),
      endsAt: c.end ? Date.parse(c.end) : null,
      courseCode: c.courses[0]?.code ?? null,
    })),
  ];
  return items
    .filter((i) => Number.isFinite(i.startsAt) && (i.endsAt ?? i.startsAt) >= now - 3600_000)
    .sort((a, b) => a.startsAt - b.startsAt);
}
