#!/usr/bin/env node
// End-to-end test of the Android app on an emulator or device, against the mock LMS.
//
//   npm run mock                          # terminal 1: mock platform on :4010
//   npx expo start  (or install the APK)  # terminal 2
//   node apps/mobile/e2e/run.mjs [--apk]  # this runner (needs adb on PATH)
//
// It drives the UI through adb + uiautomator (no extra dependencies), takes a screenshot at every step into
// e2e/artifacts/, and finally asks the mock whether the app ever called a tracking or write endpoint.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const APK_MODE = process.argv.includes('--apk');
const PKG = APK_MODE ? 'app.studium.companion' : 'host.exp.exponent';
const MOCK = process.env.MOCK_URL ?? 'http://localhost:4010';
const ART = path.join(import.meta.dirname, 'artifacts');
fs.mkdirSync(ART, { recursive: true });

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
const results = [];

// ------------------------------------------------------------------ device helpers

function dump() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const xml = adb('exec-out', 'cat', '/sdcard/ui.xml');
  return [...xml.matchAll(/<node [^>]*>/g)].map((m) => {
    const a = Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    const [x1, y1, x2, y2] = (a.bounds.match(/\d+/g) ?? []).map(Number);
    const decode = (s = '') =>
      s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
    return {
      id: (a['resource-id'] ?? '').split('/').pop(),
      text: decode(a.text),
      desc: decode(a['content-desc']),
      x: (x1 + x2) >> 1,
      y: (y1 + y2) >> 1,
    };
  });
}

const matches = (n, q) =>
  q.id
    ? n.id === q.id
    : q.exact
      ? n.text === q.text || n.desc === q.text
      : `${n.text}|${n.desc}`.includes(q.text);

async function waitFor(q, { timeout = 15_000, gone = false } = {}) {
  const until = Date.now() + timeout;
  for (;;) {
    const node = dump().find((n) => matches(n, q));
    if (gone ? !node : node) return node;
    if (Date.now() > until)
      throw new Error(`timeout waiting for ${gone ? 'absence of ' : ''}${JSON.stringify(q)}`);
    await sleep(700);
  }
}

async function tap(q, opts) {
  const n = await waitFor(q, opts);
  adb('shell', 'input', 'tap', String(n.x), String(n.y));
  await sleep(600);
}

const typeText = (s) => adb('shell', 'input', 'text', s.replace(/ /g, '%s'));
const key = (code) => adb('shell', 'input', 'keyevent', String(code));
const back = async () => {
  key(4);
  await sleep(800);
};
const swipeDown = () => adb('shell', 'input', 'swipe', '540', '700', '540', '1700', '400');
/** Bottom navigation: the exact label in the lowest part of the screen (titles and body text may repeat it). */
async function tab(label) {
  const until = Date.now() + 10_000;
  for (;;) {
    const n = dump().find((x) => x.text === label && x.y > 2000);
    if (n) {
      adb('shell', 'input', 'tap', String(n.x), String(n.y));
      await sleep(900);
      return;
    }
    if (Date.now() > until) throw new Error(`tab ${label} not found`);
    await sleep(500);
  }
}

function shot(name) {
  const file = path.join(ART, `${String(++step).padStart(2, '0')}-${name}.png`);
  fs.writeFileSync(file, execFileSync('adb', ['exec-out', 'screencap', '-p']));
  return file;
}

const mock = async (p) => (await fetch(`${MOCK}${p}`)).json();

async function run(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    shot(name);
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    shot(`FAIL-${name}`);
    results.push({ name, ok: false, error: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
    throw err;
  }
}

// ------------------------------------------------------------------ scenario

async function launch() {
  adb('reverse', 'tcp:4010', 'tcp:4010');
  adb('shell', 'pm', 'clear', PKG);
  if (APK_MODE) {
    adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  } else {
    adb('reverse', 'tcp:8081', 'tcp:8081');
    // Quoted for the device shell: the URL contains '&'.
    const url =
      'exp://127.0.0.1:8081?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1';
    adb('shell', `am start -a android.intent.action.VIEW -d '${url}' ${PKG}`);
  }
}

async function main() {
  console.log(`Studium E2E (${APK_MODE ? 'APK' : 'Expo Go'}) against ${MOCK}`);
  await mock('/__mock/reset');
  await launch();

  await run('welcome', async () => {
    await waitFor({ id: 'welcome-login' }, { timeout: 90_000 });
  });

  await run('login on the official page', async () => {
    await tap({ id: 'welcome-login' });
    await waitFor({ text: 'Pagina ufficiale di' });
    await sleep(2500); // page load + autofocus
    for (let attempt = 1; ; attempt++) {
      // Focus the username field: through the WebView accessibility tree when exposed, else autofocus.
      const field = dump().find((n) => n.id === 'username' || n.text === 'Nome utente');
      if (field) adb('shell', 'input', 'tap', String(field.x), String(field.y + (field.id ? 0 : 90)));
      await sleep(500);
      typeText('demo');
      key(61); // TAB → password
      typeText('demo');
      key(66); // ENTER submits
      await sleep(4000);
      const nodes = dump();
      if (nodes.some((n) => n.id === 'home')) break;
      if (attempt >= 3) throw new Error('could not sign in');
      if (!nodes.some((n) => n.text.includes('Credenziali non valide'))) await sleep(3000);
    }
    await waitFor({ id: 'home' }, { timeout: 30_000 });
    const stats = await mock('/__mock/stats');
    if (stats.logins !== 1) throw new Error(`expected 1 login, got ${stats.logins}`);
  });

  await run('dashboard', async () => {
    await waitFor({ text: 'Ciao, Alex' });
    await waitFor({ text: '28,00' }); // weighted average with the highlighter
    await waitFor({ text: '6 di 42 CFU' });
    await waitFor({ text: 'Prenotato' });
  });

  await run('courses', async () => {
    await tab('Corsi');
    await waitFor({ id: 'course-DAT101' });
    await waitFor({ text: 'Secondo anno' });
  });

  await run('course detail', async () => {
    await tap({ id: 'course-DAT101' });
    await waitFor({ text: 'Videolezioni viste' });
    await waitFor({ id: 'course-continue' });
  });

  await run('lesson detail', async () => {
    await tap({ id: 'lesson-3' });
    await waitFor({ text: 'Regressione lineare' });
    await waitFor({ id: 'lesson-watch' });
    await waitFor({ text: 'Stimare e interpretare' });
  });

  await run('transcript with search', async () => {
    await tap({ id: 'lesson-transcript' });
    await waitFor({ text: 'minimi quadrati' });
    await tap({ id: 'transcript-search' });
    typeText('residui');
    await waitFor({ text: '1 risultato' });
    key(111); // hide keyboard
  });

  await run('official player (no tracking until the student presses play)', async () => {
    await back();
    await tap({ id: 'lesson-watch' });
    await waitFor({ text: 'Player ufficiale della piattaforma' });
    await sleep(3000);
    const s = await mock('/__mock/stats');
    if (s.trackingCalls !== 0) throw new Error(`tracking called without playing: ${s.trackingCalls}`);
    await back();
  });

  await run('download whole course offline', async () => {
    await back(); // lesson → course
    await tap({ id: 'course-download' });
    const res = await waitFor({ id: 'course-download-result' }, { timeout: 60_000 });
    if (!res.text.includes('offline')) throw new Error(`download result: ${res.text}`);
  });

  await run('offline search across transcripts', async () => {
    await back();
    await tab('Altro');
    await tap({ id: 'more-search' });
    await waitFor({ id: 'search-input' });
    typeText('regressione');
    await waitFor({ text: 'risultat' });
    await waitFor({ text: 'Il modello lineare' });
    key(111);
    await back();
  });

  await run('downloads library', async () => {
    await tap({ id: 'more-downloads' });
    await waitFor({ text: 'Spazio usato' });
    await waitFor({ text: 'Introduzione ai dati' });
    await back();
  });

  await run('career', async () => {
    await tab('Carriera');
    await waitFor({ text: 'Media ponderata' });
    await waitFor({ id: 'exam-ENG103' });
    await waitFor({ text: 'Base di laurea stimata' });
  });

  await run('notices and attachment', async () => {
    await tab('Avvisi');
    await tap({ id: 'notice-3' });
    await waitFor({ text: 'Le prenotazioni per gli appelli' });
    await tap({ id: 'attachment-31' });
    await sleep(3000);
    // The system PDF viewer (or the share sheet) opens on top: come back to the app.
    await back();
    await waitFor({ id: 'notice' }, { timeout: 10_000 }).catch(async () => back());
    await back();
  });

  await run('agenda', async () => {
    await tab('Altro');
    await tap({ id: 'more-agenda' });
    await waitFor({ text: 'Ripasso: regressione' });
    await waitFor({ text: 'Appello aperto' });
    await back();
  });

  await run('session renewal through the web app', async () => {
    await mock('/__mock/expire');
    const before = (await mock('/__mock/stats')).renewals;
    await tab('Home');
    swipeDown(); // pull to refresh
    await sleep(8000);
    const after = (await mock('/__mock/stats')).renewals;
    if (after <= before) throw new Error('the session was not renewed');
    await waitFor({ text: 'Ciao, Alex' });
    const err = dump().find((n) => n.text.includes('Non riesco ad aggiornare'));
    if (err) throw new Error('data not refreshed after renewal');
  });

  await run('read-only guarantee', async () => {
    const s = await mock('/__mock/stats');
    if (s.trackingCalls !== 0) throw new Error(`tracking endpoint called ${s.trackingCalls} times`);
    if (s.blockedWrites !== 0) throw new Error(`write endpoints called ${s.blockedWrites} times`);
    if (s.apiCalls < 10) throw new Error(`suspiciously few API calls: ${s.apiCalls}`);
  });

  await run('sign out', async () => {
    await tab('Altro');
    await tap({ id: 'more-settings' });
    await tap({ id: 'settings-signout' });
    await tap({ text: 'ESCI', exact: true }).catch(() => tap({ text: 'Esci', exact: true }));
    await waitFor({ id: 'welcome-login' }, { timeout: 15_000 });
  });
}

main()
  .then(() => {
    console.log(`\n${results.length} steps passed. Screenshots: ${ART}`);
  })
  .catch(() => {
    console.log(`\nFAILED after ${results.filter((r) => r.ok).length} passing steps. Screenshots: ${ART}`);
    process.exitCode = 1;
  });
