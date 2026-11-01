import type { AgendaItem } from '@studium/core';

export const KIND_LABEL: Record<AgendaItem['kind'], { label: string; tone: 'ink' | 'success' | 'neutral' }> =
  {
    booking: { label: 'Prenotato', tone: 'success' },
    exam: { label: 'Appello aperto', tone: 'ink' },
    live: { label: 'Lezione live', tone: 'neutral' },
  };
