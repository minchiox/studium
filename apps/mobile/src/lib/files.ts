import {
  fetchTranscripts,
  type Lesson,
  mapPool,
  renderLessonMarkdown,
  type SearchDoc,
  safeFileName,
} from '@studium/core';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { api } from './api';

// Offline library on the device:
//   studium/<COURSE>/dispense/<NN> - <title>.pdf
//   studium/<COURSE>/trascrizioni/<NN>.json   { lesson, texts }
//   studium/allegati/<notice id>/<file>
const root = () => new Directory(Paths.document, 'studium');
const courseDir = (code: string) => new Directory(root(), code);
const ensure = (d: Directory) => {
  d.create({ idempotent: true, intermediates: true });
  return d;
};
const pad = (n: number) => String(n).padStart(2, '0');

export const handoutFile = (code: string, l: Pick<Lesson, 'number' | 'title'>) =>
  new File(courseDir(code), 'dispense', `${pad(l.number)} - ${safeFileName(l.title, 60)}.pdf`);

const transcriptFile = (code: string, n: number) =>
  new File(courseDir(code), 'trascrizioni', `${pad(n)}.json`);

export interface StoredTranscript {
  lesson: Lesson;
  texts: (string | null)[];
  savedAt: string;
}

async function download(url: string, dest: File, headers?: Record<string, string>): Promise<File> {
  ensure(new Directory(dest.parentDirectory.uri));
  if (dest.exists) dest.delete();
  const out = await File.downloadFileAsync(url, dest, headers ? { headers } : undefined);
  const file = out instanceof File ? out : dest;
  // A PDF starts with "%PDF": an HTML error page saved as .pdf would be useless offline.
  if (dest.uri.endsWith('.pdf')) {
    const head = (await file.bytes()).slice(0, 4);
    if (String.fromCharCode(...head) !== '%PDF') {
      file.delete();
      throw new Error('Il server non ha restituito un PDF valido.');
    }
  }
  return file;
}

export async function getHandout(code: string, lesson: Lesson): Promise<File> {
  const f = handoutFile(code, lesson);
  if (f.exists && f.size > 0) return f;
  if (!lesson.dispensaUrl) throw new Error('Questa lezione non ha una dispensa.');
  return download(lesson.dispensaUrl, f);
}

export async function getAttachment(
  noticeId: string,
  file: string,
  title: string,
  ext: string | null,
): Promise<File> {
  const name = `${safeFileName(title, 60)}${ext && !title.toLowerCase().endsWith(`.${ext}`) ? `.${ext}` : ''}`;
  const f = new File(root(), 'allegati', noticeId, name);
  if (f.exists && f.size > 0) return f;
  const req = await api().attachmentRequest(file);
  return download(req.url, f, req.headers);
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/** Opens a downloaded file with the system viewer; falls back to the share sheet if no app can open it. */
export async function openFile(file: File): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const type = MIME[ext] ?? 'application/octet-stream';
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type,
    });
  } catch {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: type });
    else throw new Error('Nessuna app installata può aprire questo file.');
  }
}

// ------------------------------------------------------------------ transcripts

export async function getTranscript(
  code: string,
  lesson: Lesson,
  refresh = false,
): Promise<StoredTranscript> {
  const f = transcriptFile(code, lesson.number);
  if (f.exists && !refresh) {
    try {
      return JSON.parse(await f.text()) as StoredTranscript;
    } catch {
      /* corrupted: fetch again */
    }
  }
  const texts = await fetchTranscripts(api(), lesson, 3);
  const stored: StoredTranscript = { lesson, texts, savedAt: new Date().toISOString() };
  ensure(new Directory(f.parentDirectory.uri));
  f.write(JSON.stringify(stored));
  return stored;
}

export const transcriptMarkdown = (t: StoredTranscript) => renderLessonMarkdown(t.lesson, t.texts);

export const hasTranscript = (code: string, n: number) => transcriptFile(code, n).exists;

// ------------------------------------------------------------------ whole course

export interface CourseDownloadProgress {
  done: number;
  total: number;
  failed: number;
}

/** Downloads every handout and transcript of a course; existing files are kept. */
export async function downloadCourse(
  code: string,
  lessons: Lesson[],
  onProgress: (p: CourseDownloadProgress) => void,
): Promise<CourseDownloadProgress> {
  const p = { done: 0, total: lessons.length, failed: 0 };
  onProgress({ ...p });
  const seenPdf = new Set<string>();
  await mapPool(lessons, 3, async (l) => {
    try {
      if (l.dispensaUrl && !seenPdf.has(l.dispensaUrl)) {
        seenPdf.add(l.dispensaUrl);
        await getHandout(code, l);
      }
      if (l.paragraphs.length) await getTranscript(code, l);
    } catch {
      p.failed++;
    } finally {
      p.done++;
      onProgress({ ...p });
    }
  });
  return p;
}

// ------------------------------------------------------------------ library

export interface LibraryCourse {
  code: string;
  handouts: File[];
  transcripts: number;
  bytes: number;
}

export function library(): LibraryCourse[] {
  if (!root().exists) return [];
  return root()
    .list()
    .filter((d): d is Directory => d instanceof Directory && d.name !== 'allegati')
    .map((d) => {
      const disp = new Directory(d, 'dispense');
      const tr = new Directory(d, 'trascrizioni');
      const handouts = disp.exists ? disp.list().filter((f): f is File => f instanceof File) : [];
      const transcripts = tr.exists ? tr.list().filter((f) => f instanceof File).length : 0;
      return { code: d.name, handouts, transcripts, bytes: d.size ?? 0 };
    })
    .filter((c) => c.handouts.length || c.transcripts);
}

export function deleteCourseFiles(code: string): void {
  const d = courseDir(code);
  if (d.exists) d.delete();
}

export function deleteAll(): void {
  if (root().exists) root().delete();
}

export const totalBytes = () => (root().exists ? (root().size ?? 0) : 0);

/** Search corpus: every downloaded transcript, one document per paragraph. */
export async function transcriptDocs(titles: Record<string, string>): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  for (const c of library()) {
    const tr = new Directory(courseDir(c.code), 'trascrizioni');
    if (!tr.exists) continue;
    for (const f of tr.list()) {
      if (!(f instanceof File)) continue;
      try {
        const t = JSON.parse(await f.text()) as StoredTranscript;
        t.lesson.paragraphs.forEach((p, i) => {
          const text = t.texts[i];
          if (!text) return;
          docs.push({
            id: `${c.code}:${t.lesson.number}:${p.number}`,
            title: `${t.lesson.number}.${p.number} ${p.title}`,
            text,
            meta: {
              code: c.code,
              lesson: t.lesson.number,
              paragraph: p.number,
              course: titles[c.code] ?? c.code,
            },
          });
        });
      } catch {
        /* skip unreadable files */
      }
    }
  }
  return docs;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
}
