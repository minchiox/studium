import {
  type Course,
  closingSoon,
  daysBetween,
  type ExamsOverview,
  localDay,
  wallClock,
} from '@studium/core';
import type { IconName } from '@/components/ui';
import { formatDate, formatTime, plural } from './format';

export interface TodoItem {
  id: string;
  title: string;
  subtitle: string | null;
  icon: IconName;
  /** Needs doing today: gets the highlighter. */
  urgent: boolean;
  href:
    | { pathname: '/exams' }
    | { pathname: '/practice' }
    | { pathname: '/quiz'; params: { mode: 'review' } }
    | { pathname: '/course/[code]'; params: { code: string } };
}

const shortDate = (ymd: string | null) => formatDate(ymd).replace(/ \d{4}$/, '');

/**
 * What the student should do next, most pressing first: results to confirm, an exam today or tomorrow,
 * bookings about to close, the review queue, the course they were following.
 */
export function buildTodo(input: {
  exams?: ExamsOverview | undefined;
  courses?: Course[] | undefined;
  dueReviews: number;
  titles: Record<string, string>;
  now?: number;
}): TodoItem[] {
  const now = input.now ?? Date.now();
  const today = localDay(now);
  const out: TodoItem[] = [];
  const ex = input.exams;
  if (ex?.toConfirm)
    out.push({
      id: 'results',
      title: plural(ex.toConfirm, 'esito da confermare', 'esiti da confermare'),
      subtitle: 'Accetta o rifiuta il voto sulla pagina ufficiale',
      icon: 'clipboard-check-outline',
      urgent: true,
      href: { pathname: '/exams' },
    });
  for (const b of ex?.bookings ?? []) {
    const d = daysBetween(today, b.date);
    if (d < 0 || d > 1) continue;
    out.push({
      id: `exam:${b.id}`,
      title: `${d === 0 ? 'Esame oggi' : 'Esame domani'}: ${input.titles[b.courseCode] ?? b.courseCode}`,
      subtitle: [b.start ? `alle ${formatTime(wallClock(b.date, b.start))}` : null, b.type]
        .filter(Boolean)
        .join(', '),
      icon: 'pencil-box-outline',
      urgent: d === 0,
      href: { pathname: '/exams' },
    });
  }
  for (const o of ex ? closingSoon(ex.courses, now, 3) : []) {
    const last = o.closesOn === today;
    out.push({
      id: `closing:${o.id}`,
      title: last ? `Ultimo giorno per prenotare ${o.courseTitle}` : `Prenota ${o.courseTitle}`,
      subtitle: `Appello del ${shortDate(o.date)}${last ? '' : `, prenotazioni fino al ${shortDate(o.closesOn)}`}`,
      icon: 'calendar-alert',
      urgent: last,
      href: { pathname: '/exams' },
    });
  }
  if (input.dueReviews > 0)
    out.push({
      id: 'review',
      title: `Ripassa ${plural(input.dueReviews, 'domanda', 'domande')}`,
      subtitle: 'Il ripasso di oggi, dalla tua banca di quiz',
      icon: 'cards-outline',
      urgent: false,
      href: { pathname: '/quiz', params: { mode: 'review' } },
    });
  const current = (input.courses ?? [])
    .filter((c) => c.progress !== null && c.progress < 100 && !c.exam?.passed && c.lastWatched)
    .sort((a, b) => (b.lastWatched?.at ?? '').localeCompare(a.lastWatched?.at ?? ''))[0];
  if (current)
    out.push({
      id: `course:${current.code}`,
      title: `Riprendi ${current.title}`,
      subtitle: `${current.progress}% delle videolezioni`,
      icon: 'play-circle-outline',
      urgent: false,
      href: { pathname: '/course/[code]', params: { code: current.code } },
    });
  return out.slice(0, 4);
}
