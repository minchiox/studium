// Bookable exam sessions ("appelli") and their booking windows. Pure functions, unit-tested.
// Booking itself happens on the university's official page: Studium only reads.
import type { z } from 'zod';
import { cleanText } from './parse.ts';
import type { ApiBookableCourse, ApiBookableSlot, BookableCourse, ExamBooking, ExamOffer } from './types.ts';

/**
 * Platform dates come as "2026-11-02", "2026-11-02 00:00:00" or as the UTC instant of a local midnight
 * ("2026-11-04T23:00:00.000000Z" = 5 November in Italy). Returns the platform-local day, whatever the
 * device time zone: a local midnight shifted by at most ±12 h always lands on the right UTC day.
 */
export function platformDay(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.trim();
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(v)) return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  const ms = Date.parse(v.replace(/(\.\d{3})\d+/, '$1')); // Hermes rejects microseconds
  return Number.isFinite(ms) ? new Date(ms + 12 * 3600_000).toISOString().slice(0, 10) : null;
}

/** Today in the device time zone, as YYYY-MM-DD. */
export function localDay(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from `a` to `b` (YYYY-MM-DD), DST-proof. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const hhmm = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null);

function locationOf(slot: z.infer<typeof ApiBookableSlot>): string | null {
  const l = slot.location;
  if (!l) return null;
  if (typeof l === 'string') return l.trim() || null;
  return l.place_ext?.trim() || l.city?.replace(/\s*\(.*\)\s*$/, '').trim() || null;
}

export function mapBookableCourses(
  raw: z.infer<typeof ApiBookableCourse>[],
  bookings: readonly ExamBooking[] = [],
): BookableCourse[] {
  const booked = new Set(bookings.map((b) => `${b.courseCode}|${b.date}`));
  return raw
    .map((c) => {
      const title = cleanText(c.title) || c.code;
      const seen = new Set<string>();
      const offers: ExamOffer[] = [];
      for (const slot of (c.exams ?? []).flat()) {
        const date = platformDay(slot.exam_date);
        if (!date) continue;
        const start = hhmm(slot.exam_hour);
        const location = locationOf(slot);
        const id = `${c.code}|${date}|${start ?? ''}|${slot.location_id ?? location ?? ''}`;
        if (seen.has(id)) continue;
        seen.add(id);
        offers.push({
          id,
          courseCode: c.code,
          courseTitle: title,
          date,
          start,
          end: hhmm(slot.exam_hour_finish),
          location,
          place: slot.exam_place?.trim() || null,
          type: slot.type_of_exam?.trim() || null,
          online:
            slot.exam_online_flag === null || slot.exam_online_flag === undefined
              ? null
              : slot.exam_online_flag === 1,
          opensOn: platformDay(slot.start_date),
          closesOn: platformDay(slot.end_date),
          booked: booked.has(`${c.code}|${date}`),
        });
      }
      offers.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
      const bookedOn = bookings
        .filter((b) => b.courseCode === c.code)
        .map((b) => b.date)
        .sort();
      return { code: c.code, title, cfu: c.cfu ?? null, offers, bookedOn };
    })
    .sort((a, b) => (a.offers[0]?.date ?? '9').localeCompare(b.offers[0]?.date ?? '9'));
}

export type WindowState = 'upcoming' | 'open' | 'closed';

export interface BookingWindow {
  state: WindowState;
  /** open: days left including today (0 = last day); upcoming: days until it opens. */
  days: number | null;
}

/** Where an offer stands today. Without dates, an offer whose exam is still ahead counts as open. */
export function bookingWindow(
  offer: Pick<ExamOffer, 'date' | 'opensOn' | 'closesOn'>,
  now = Date.now(),
): BookingWindow {
  const today = localDay(now);
  if (offer.date < today) return { state: 'closed', days: null };
  if (offer.opensOn && today < offer.opensOn)
    return { state: 'upcoming', days: daysBetween(today, offer.opensOn) };
  if (offer.closesOn && today > offer.closesOn) return { state: 'closed', days: null };
  return { state: 'open', days: offer.closesOn ? daysBetween(today, offer.closesOn) : null };
}

/** Offers still worth showing (exam ahead, window not closed), soonest first. */
export function activeOffers(courses: readonly BookableCourse[], now = Date.now()): ExamOffer[] {
  return courses
    .flatMap((c) => c.offers)
    .filter((o) => bookingWindow(o, now).state !== 'closed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.courseTitle.localeCompare(b.courseTitle));
}

/**
 * For reminders: per course, the next open offer not yet booked, if its window closes within `withinDays`.
 * One per course keeps notifications few and useful.
 */
export function closingSoon(
  courses: readonly BookableCourse[],
  now = Date.now(),
  withinDays = 7,
): ExamOffer[] {
  const today = localDay(now);
  const out: ExamOffer[] = [];
  for (const c of courses) {
    if (c.bookedOn.some((d) => d >= today) || c.offers.some((o) => o.booked && o.date >= today)) continue;
    const next = c.offers.find((o) => {
      const w = bookingWindow(o, now);
      return w.state === 'open' && !!o.closesOn && w.days !== null && w.days <= withinDays;
    });
    if (next) out.push(next);
  }
  return out.sort((a, b) => (a.closesOn ?? '').localeCompare(b.closesOn ?? ''));
}

/** The student's usual exam seat: the most frequent location among their bookings, if any. */
export function preferredLocation(bookings: readonly ExamBooking[]): string | null {
  const counts = new Map<string, number>();
  for (const b of bookings) if (b.location) counts.set(b.location, (counts.get(b.location) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/** All locations offered, alphabetical (Italian collation). */
export function offerLocations(courses: readonly BookableCourse[]): string[] {
  const set = new Set(
    courses.flatMap((c) => c.offers.map((o) => o.location).filter((l): l is string => !!l)),
  );
  return [...set].sort((a, b) => a.localeCompare(b, 'it'));
}

/** Offers at one location (all when `location` is null), still open or upcoming. */
export function offersAt(course: BookableCourse, location: string | null, now = Date.now()): ExamOffer[] {
  return course.offers.filter(
    (o) => (!location || o.location === location) && bookingWindow(o, now).state !== 'closed',
  );
}
