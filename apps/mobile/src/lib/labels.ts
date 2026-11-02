import { type AgendaItem, bookingWindow, type ExamOffer } from '@studium/core';
import { formatDate } from './format';

export const KIND_LABEL: Record<AgendaItem['kind'], { label: string; tone: 'ink' | 'success' | 'neutral' }> =
  {
    booking: { label: 'Prenotato', tone: 'success' },
    exam: { label: 'Appello aperto', tone: 'ink' },
    live: { label: 'Lezione live', tone: 'neutral' },
  };

type Tone = 'ink' | 'success' | 'neutral' | 'danger';

/** Booking status of an exam session, as a short pill. */
export function offerStatus(o: ExamOffer, now = Date.now()): { label: string; tone: Tone } {
  if (o.booked) return { label: 'Prenotato', tone: 'success' };
  const w = bookingWindow(o, now);
  if (w.state === 'upcoming')
    return { label: `Apre il ${formatDate(o.opensOn).replace(/ \d{4}$/, '')}`, tone: 'neutral' };
  if (w.state === 'closed') return { label: 'Chiuso', tone: 'neutral' };
  if (w.days === 0) return { label: 'Ultimo giorno', tone: 'danger' };
  if (w.days !== null && w.days <= 3) return { label: `Chiude tra ${w.days} gg`, tone: 'danger' };
  return { label: 'Prenotabile', tone: 'ink' };
}
