// Offline full-text search over lesson titles and downloaded transcripts. Small corpora (a few MB), so a
// linear scan over normalized text is fast enough and avoids maintaining an index.

export interface SearchDoc {
  id: string;
  title: string;
  text: string;
  /** Free-form data returned with hits (e.g. course code and lesson number). */
  meta?: Record<string, string | number>;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
  meta?: Record<string, string | number>;
}

/** Lowercase, no accents: "Perché" → "perche". Keeps string length so offsets map back to the original. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const tokenize = (q: string): string[] =>
  normalize(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);

/** All query terms must appear (in title or text). Title matches weigh more; snippet around the first hit. */
export function search(
  docs: readonly SearchDoc[],
  query: string,
  limit = 30,
  snippetRadius = 70,
): SearchHit[] {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  for (const d of docs) {
    // Normalize per character so indexes line up with the original text.
    const textN = [...d.text].map((c) => normalize(c)[0] ?? c).join('');
    const titleN = normalize(d.title);
    let score = 0;
    let first = -1;
    let ok = true;
    for (const t of terms) {
      const inTitle = titleN.includes(t);
      const idx = textN.indexOf(t);
      if (!inTitle && idx === -1) {
        ok = false;
        break;
      }
      if (inTitle) score += 10;
      if (idx !== -1) {
        score += 1 + Math.min(5, textN.split(t).length - 2);
        if (first === -1 || idx < first) first = idx;
      }
    }
    if (!ok) continue;
    const chars = [...d.text];
    let snippet = '';
    if (first !== -1) {
      const from = Math.max(0, first - snippetRadius);
      const to = Math.min(chars.length, first + snippetRadius * 2);
      snippet = `${from > 0 ? '…' : ''}${chars.slice(from, to).join('').replace(/\s+/g, ' ').trim()}${to < chars.length ? '…' : ''}`;
    }
    hits.push({ id: d.id, title: d.title, snippet, score, ...(d.meta ? { meta: d.meta } : {}) });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/** Splits `text` into segments marking the query terms, for highlighting in a UI. */
export function highlight(text: string, query: string): { text: string; match: boolean }[] {
  const terms = tokenize(query);
  if (!terms.length) return [{ text, match: false }];
  const chars = [...text];
  const norm = chars.map((c) => normalize(c)[0] ?? c).join('');
  const marks = new Array<boolean>(chars.length).fill(false);
  for (const t of terms) {
    for (let i = norm.indexOf(t); i !== -1; i = norm.indexOf(t, i + t.length)) {
      for (let k = i; k < i + t.length; k++) marks[k] = true;
    }
  }
  const out: { text: string; match: boolean }[] = [];
  chars.forEach((c, i) => {
    const m = marks[i] ?? false;
    const last = out[out.length - 1];
    if (last && last.match === m) last.text += c;
    else out.push({ text: c, match: m });
  });
  return out;
}
