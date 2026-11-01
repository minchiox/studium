/** Builds a tiny but valid one-page PDF with a title and some lines of text (Helvetica, WinAnsi). */
export function pdf(title: string, lines: string[] = []): Buffer {
  const esc = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // base-14 fonts: keep it ASCII
      .replace(/[’‘]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/([\\()])/g, '\\$1');
  const wrap = (s: string, n = 85) => s.match(new RegExp(`.{1,${n}}(\\s|$)`, 'g')) ?? [s];
  const body = [
    'BT /F1 18 Tf 50 790 Td',
    `(${esc(title)}) Tj`,
    '/F1 11 Tf 0 -30 Td 14 TL',
    ...lines.flatMap((l) => wrap(l)).map((l) => `(${esc(l.trim())}) '`),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
