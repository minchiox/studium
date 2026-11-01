import { describe, expect, it } from 'vitest';
import { LmsClient } from '../src/client.ts';
import {
  activeOffers,
  bookingWindow,
  closingSoon,
  daysBetween,
  mapBookableCourses,
  offerLocations,
  offersAt,
  platformDay,
  preferredLocation,
} from '../src/exams.ts';
import { officialPageUrl } from '../src/profile.ts';
import { ApiBookableCourse } from '../src/types.ts';
import { FakeHttp, FakeTokens, fixtureJson, PROFILE } from './helpers.ts';

const raw = () => fixtureJson<unknown[]>('bookable-exams.json').map((c) => ApiBookableCourse.parse(c));
/** Noon, local time: far from midnight in any time zone the tests may run in. */
const at = (ymd: string) => new Date(`${ymd}T12:00:00`).getTime();

describe('platformDay', () => {
  it('reads plain dates, local datetimes and UTC instants of a local midnight', () => {
    expect(platformDay('2026-11-02')).toBe('2026-11-02');
    expect(platformDay('2026-11-02 00:00:00')).toBe('2026-11-02');
    expect(platformDay('2026-11-04T23:00:00.000000Z')).toBe('2026-11-05'); // CET midnight
    expect(platformDay('2026-10-17T22:00:00.000000Z')).toBe('2026-10-18'); // CEST midnight
    expect(platformDay('2026-11-05T00:00:00+01:00')).toBe('2026-11-05');
    expect(platformDay('not a date')).toBeNull();
    expect(platformDay(null)).toBeNull();
  });

  it('counts days across DST changes', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-11-05', '2026-11-04')).toBe(-1);
  });
});

describe('bookable exams', () => {
  it('maps courses and sessions, merging duplicates and marking booked days', () => {
    const bookings = [
      {
        id: '77',
        courseCode: 'ABC103',
        date: '2026-11-20',
        start: '09:30',
        end: null,
        location: null,
        type: null,
        online: true,
      },
    ];
    const courses = mapBookableCourses(raw(), bookings);
    expect(courses.map((c) => [c.code, c.offers.length])).toEqual([
      ['ABC101', 2], // duplicate session merged; sorted by first session date
      ['ABC103', 2],
      ['ABC102', 0],
    ]);
    const law = courses.find((c) => c.code === 'ABC103');
    expect(law?.title).toBe("Diritto dell'informatica");
    expect(law?.cfu).toBe(9);
    expect(law?.offers[0]).toMatchObject({
      date: '2026-11-20',
      start: '09:30',
      location: 'Sede centrale',
      opensOn: '2026-11-01',
      closesOn: '2026-11-18',
      online: null,
      booked: true,
    });
    expect(law?.offers[1]).toMatchObject({ location: 'Sede nord', online: true, booked: false });
  });

  it('tells whether booking is open, upcoming or closed', () => {
    const o = { date: '2026-11-20', opensOn: '2026-11-01', closesOn: '2026-11-18' };
    expect(bookingWindow(o, at('2026-10-30'))).toEqual({ state: 'upcoming', days: 2 });
    expect(bookingWindow(o, at('2026-11-01'))).toEqual({ state: 'open', days: 17 });
    expect(bookingWindow(o, at('2026-11-18'))).toEqual({ state: 'open', days: 0 });
    expect(bookingWindow(o, at('2026-11-19'))).toEqual({ state: 'closed', days: null });
    expect(bookingWindow({ date: '2026-11-20', opensOn: null, closesOn: null }, at('2026-11-19'))).toEqual({
      state: 'open',
      days: null,
    });
    expect(bookingWindow(o, at('2026-11-21')).state).toBe('closed');
  });

  it('lists active offers and the closing deadlines worth a reminder', () => {
    const courses = mapBookableCourses(raw());
    const now = at('2026-11-02');
    expect(activeOffers(courses, now).map((o) => `${o.courseCode} ${o.date}`)).toEqual([
      'ABC101 2026-11-07',
      'ABC103 2026-11-20',
      'ABC103 2026-12-10',
    ]);
    // ABC101 closes in 3 days; ABC103's next window closes in 16 days (beyond the 7-day horizon)
    expect(closingSoon(courses, now).map((o) => [o.courseCode, o.closesOn])).toEqual([
      ['ABC101', '2026-11-05'],
    ]);
    // a course already booked never triggers a reminder
    const booked = mapBookableCourses(raw(), [
      {
        id: '1',
        courseCode: 'ABC101',
        date: '2026-11-07',
        start: null,
        end: null,
        location: null,
        type: null,
        online: false,
      },
    ]);
    expect(closingSoon(booked, now)).toEqual([]);
    // nor does one booked today, even when that session is no longer listed as bookable
    const today = mapBookableCourses(raw(), [
      {
        id: '2',
        courseCode: 'ABC101',
        date: '2026-11-02',
        start: null,
        end: null,
        location: null,
        type: null,
        online: true,
      },
    ]);
    expect(closingSoon(today, now)).toEqual([]);
  });

  it('suggests the usual exam seat and filters offers by location', () => {
    const b = (location: string | null) => ({
      id: 'x',
      courseCode: 'ABC101',
      date: '2026-11-01',
      start: null,
      end: null,
      location,
      type: null,
      online: true,
    });
    expect(preferredLocation([b('Sede nord'), b('Sede centrale'), b('Sede centrale'), b(null)])).toBe(
      'Sede centrale',
    );
    expect(preferredLocation([])).toBeNull();
    const courses = mapBookableCourses(raw());
    expect(offerLocations(courses)).toEqual(['Sede centrale', 'Sede nord']);
    const law = courses.find((c) => c.code === 'ABC103');
    if (!law) throw new Error('missing course');
    const now = at('2026-11-02');
    expect(offersAt(law, 'Sede nord', now).map((o) => o.date)).toEqual(['2026-12-10']);
    expect(offersAt(law, null, now)).toHaveLength(2);
  });
});

describe('exams overview', () => {
  it('combines bookings, bookable sessions and results to confirm', async () => {
    const client = new LmsClient(PROFILE, new FakeHttp(), new FakeTokens());
    const o = await client.getExamsOverview();
    expect(o.bookings.map((b) => b.courseCode)).toEqual(['ABC103']);
    expect(o.courses.find((c) => c.code === 'ABC103')?.offers[0]?.booked).toBe(true);
    expect(o.toConfirm).toBe(2);
  });

  it('still returns the bookings when the optional sources fail', async () => {
    const http = new FakeHttp();
    http.routes.delete('GET /student/get-bookable-exams');
    http.routes.delete('GET /student/exams/to-confirm');
    const o = await new LmsClient(PROFILE, http, new FakeTokens(), { retries: 0 }).getExamsOverview();
    expect(o).toMatchObject({ courses: [], toConfirm: 0 });
    expect(o.bookings).toHaveLength(1);
  });

  it('points booking and results to the official web app, never to a write call', () => {
    expect(officialPageUrl(PROFILE, 'exams')).toBe('https://app.example.edu/appelli');
    expect(officialPageUrl(PROFILE, 'results')).toBe('https://app.example.edu/confirm-exam');
  });
});
