import { describe, expect, it } from 'vitest';
import {
  decodeBase64Url,
  decodeHtmlEntities,
  formatDuration,
  htmlToText,
  isPdf,
  isTokenExpired,
  jwtExpiry,
  parseCoursesFromPortal,
  parseLesson,
  readCookie,
  safeFileName,
  slugify,
  vttToText,
  vttUrl,
} from '../src/parse.ts';
import { fixture, items, PROFILE, refs } from './helpers.ts';

describe('decodeHtmlEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeHtmlEntities('perch&eacute; &amp; L&#39;a &#x41; &laquo;x&raquo;')).toBe(
      "perché & L'a A «x»",
    );
  });
  it('leaves unknown or invalid entities untouched', () => {
    expect(decodeHtmlEntities('&unknown; &#0; &#xFFFFFFF;')).toBe('&unknown; &#0; &#xFFFFFFF;');
  });
});

describe('htmlToText', () => {
  it('keeps structure as line breaks and bullets', () => {
    expect(htmlToText('<p>Uno <b>due</b></p><ul><li>a</li><li>b</li></ul>')).toBe('Uno due\n- a\n- b');
    expect(htmlToText('riga uno. \r\nriga due')).toBe('riga uno.\nriga due');
  });
});

describe('parseCoursesFromPortal', () => {
  it('extracts unique course links with decoded titles', () => {
    expect(parseCoursesFromPortal(fixture('portal.html'))).toEqual([
      { code: 'ABC101', title: 'Analisi dei dati' },
      { code: 'ABC103', title: "Diritto dell'informatica e criminalità" },
      { code: 'ABC201', title: 'Sicurezza delle reti' },
    ]);
  });
  it('returns nothing for a login page', () => {
    expect(parseCoursesFromPortal('<form><input type="password"></form>')).toEqual([]);
  });
});

describe('vttUrl', () => {
  it('maps media-host videos to the subtitle host', () => {
    expect(vttUrl(PROFILE, 'https://media.example.edu/prof_x/a/video/A_1__1.mp4')).toBe(
      'https://subs.example.edu/prof_x/a/video/A_1__1.vtt',
    );
  });
  it('returns null for unknown hosts, missing URLs or profiles without subtitle host', () => {
    expect(vttUrl(PROFILE, 'https://example.com/a.mp4')).toBeNull();
    expect(vttUrl(PROFILE, null)).toBeNull();
    expect(vttUrl({}, 'https://media.example.edu/a.mp4')).toBeNull();
  });
});

describe('vttToText', () => {
  const text = vttToText(fixture('sample.vtt'));
  it('drops header, NOTE, STYLE blocks, cue ids and timings', () => {
    expect(text).not.toMatch(/WEBVTT|NOTE|STYLE|-->|intro-cue|cue \{/);
  });
  it('strips tags, decodes entities, removes repeated cues and splits sentences', () => {
    expect(text).toBe(
      "Buongiorno a tutti.\nOggi parliamo di dati e di informazione.\nL'analisi è importante!\nVediamo perché.",
    );
  });
  it('handles empty input', () => {
    expect(vttToText('WEBVTT\n\n')).toBe('');
  });
});

describe('parseLesson', () => {
  const [, first] = refs(); // fixture refs are deliberately out of order
  const lesson = parseLesson(first as NonNullable<typeof first>, items(), PROFILE);

  it('maps metadata and prefers mer_BookUrl', () => {
    expect(lesson).toMatchObject({
      number: 1,
      lpId: 5,
      title: 'Introduzione ai Big Data',
      teacher: 'Mario Rossi',
      progress: 100,
      dispensaUrl: 'https://media.example.edu/prof_example/2001_Demo/book.pdf',
      selfTest: { title: 'Test di autovalutazione', progress: 0 },
    });
    expect(lesson.objectives).toBe(
      'La lezione introduce le motivazioni per lo studio dei dati.\n- Cosa sono i dati\n- Il ciclo di vita',
    );
  });

  it('sorts paragraphs and derives subtitle URLs', () => {
    expect(lesson.paragraphs.map((p) => [p.number, p.durationS, p.progress])).toEqual([
      [1, 657, 100],
      [2, 300, 50],
    ]);
    expect(lesson.paragraphs[0]?.vttUrl).toMatch(/^https:\/\/subs\.example\.edu\/.*\.vtt$/);
  });

  it('tolerates a lesson with no metadata items', () => {
    expect(parseLesson({ lp_id: 1, display_order: 1, title: 'X', percentage: null }, [])).toMatchObject({
      teacher: null,
      objectives: null,
      dispensaUrl: null,
      selfTest: null,
      paragraphs: [],
      progress: null,
    });
  });
});

describe('names and formatting', () => {
  it('slugify', () => {
    expect(slugify("Economia e gestione dell'innovazione")).toBe('Economia-e-gestione-dell-innovazione');
    expect(slugify('  Criminalità & più ')).toBe('Criminalita-piu');
  });
  it('safeFileName removes reserved characters and trailing dots', () => {
    expect(safeFileName('a/b:c*d?"e"<f>|g.  ')).toBe('abcdefg');
    expect(safeFileName('???')).toBe('untitled');
    expect(safeFileName('x'.repeat(200))).toHaveLength(90);
  });
  it('formatDuration', () => {
    expect(formatDuration(657)).toBe('10:57');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('jwtExpiry', () => {
  const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
  it('reads exp', () => {
    expect(jwtExpiry(jwt({ exp: 1_800_000_000 }))?.toISOString()).toBe('2027-01-15T08:00:00.000Z');
  });
  it('returns null on malformed tokens', () => {
    expect(jwtExpiry('nope')).toBeNull();
    expect(jwtExpiry('a.!!!.c')).toBeNull();
    expect(jwtExpiry(jwt({ sub: 1 }))).toBeNull();
  });
});

describe('isPdf', () => {
  it('checks the magic number', () => {
    expect(isPdf(Buffer.from('%PDF-1.4'))).toBe(true);
    expect(isPdf(Buffer.from('<html>'))).toBe(false);
  });
});

describe('tokens and cookies', () => {
  const jwt = (p: object) => `h.${Buffer.from(JSON.stringify(p)).toString('base64url')}.s`;
  it('decodes base64url without padding', () => {
    expect(decodeBase64Url(Buffer.from('{"a":1}').toString('base64url'))).toBe('{"a":1}');
  });
  it('isTokenExpired honours the clock skew', () => {
    const now = 1_800_000_000_000;
    expect(isTokenExpired(jwt({ exp: now / 1000 + 3600 }), now)).toBe(false);
    expect(isTokenExpired(jwt({ exp: now / 1000 + 30 }), now)).toBe(true);
    expect(isTokenExpired(null, now)).toBe(true);
    expect(isTokenExpired('garbage', now)).toBe(true);
  });
  it('readCookie finds and decodes a cookie', () => {
    expect(readCookie('a=1; st_token=abc%3D; b=2', 'st_token')).toBe('abc=');
    expect(readCookie('xst_token=1', 'st_token')).toBeNull();
    expect(readCookie('', 'st_token')).toBeNull();
  });
});
