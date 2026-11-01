// Italian formatting helpers (Hermes ships Intl on Android).

const dayFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const longDayFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatDay = (ms: number) => dayFmt.format(ms);
export const formatLongDay = (ms: number) => longDayFmt.format(ms);
export const formatTime = (ms: number) => timeFmt.format(ms);

/** "2026-11-02" or ISO → "2 novembre 2026"; returns the input when it is not a date. */
export function formatDate(s: string | null | undefined): string {
  if (!s) return '';
  const ms = Date.parse(s.length === 10 ? `${s}T12:00:00` : s);
  return Number.isFinite(ms) ? dateFmt.format(ms) : s;
}

export function relativeDay(ms: number, now = Date.now()): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOf(ms) - startOf(now)) / 86_400_000);
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days === -1) return 'ieri';
  if (days > 1) return `tra ${days} giorni`;
  return `${-days} giorni fa`;
}

/** 28.8 → "28,80" */
export const formatAverage = (n: number | null) => (n === null ? '—' : n.toFixed(2).replace('.', ','));

/** 1914 s → "32 min", 5400 → "1 h 30 min" */
export function humanDuration(totalS: number): string {
  const m = Math.round(totalS / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
