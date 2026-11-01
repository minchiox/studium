import type { StudyClient } from './client.ts';
import { formatDuration, vttToText } from './parse.ts';
import { mapPool } from './pool.ts';
import type { Lesson } from './types.ts';

/** Transcript per paragraph (same order as `lesson.paragraphs`); null when subtitles are unavailable. */
export async function fetchTranscripts(
  client: Pick<StudyClient, 'fetchText'>,
  lesson: Lesson,
  concurrency = 4,
): Promise<(string | null)[]> {
  return mapPool(lesson.paragraphs, concurrency, async (p) => {
    if (!p.vttUrl) return null;
    const vtt = await client.fetchText(p.vttUrl);
    return vtt ? vttToText(vtt) || null : null;
  });
}

export function renderLessonMarkdown(lesson: Lesson, texts: readonly (string | null)[]): string {
  const out = [`# Lezione ${lesson.number} — ${lesson.title}`, ''];
  if (lesson.teacher) out.push(`Docente: ${lesson.teacher}`, '');
  if (lesson.objectives) out.push('## Obiettivi', '', lesson.objectives, '');
  lesson.paragraphs.forEach((p, i) => {
    out.push(`## ${lesson.number}.${p.number} ${p.title} (${formatDuration(p.durationS)})`, '');
    out.push(texts[i] ?? '_Trascrizione non disponibile._', '');
  });
  return out.join('\n');
}
