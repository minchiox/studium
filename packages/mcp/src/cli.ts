#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  assertCourseCode,
  careerStats,
  computeProgress,
  createLogger,
  ENABLE_AI_FEATURES,
  formatDuration,
  formatError,
  formatVote,
  type Logger,
  NotFoundError,
  slugify,
} from '@studium/core';
import { PlaywrightBrowserTools } from './browser-tools.ts';
import { McpClient } from './client.ts';
import { type Config, loadConfig } from './config.ts';
import { resolveInside } from './fs-safe.ts';
import { interactiveLogin } from './login.ts';
import { createServer } from './server.ts';
import { BrowserSession } from './session.ts';
import { syncCourse } from './sync.ts';
import { VERSION } from './version.ts';

const HELP = `studium-mcp ${VERSION} — read-only AI study assistant for Chamilo-based university platforms

Usage:
  studium-mcp [serve]              Start the MCP server on stdio (what MCP clients run)
  studium-mcp login                Sign in in a browser window and save the session
  studium-mcp logout               Delete the saved session
  studium-mcp status               Check the saved session
  studium-mcp courses              List your courses
  studium-mcp progress [CODE]      What is left to watch
  studium-mcp career                Study plan, grades and averages
  studium-mcp sync CODE [options]  Download handouts and transcripts of a course

Sync options:
  --dir <path>        Folder relative to the workspace (default: course title)
  --no-transcripts    Only PDF handouts
  --force             Download again existing files

Global options:
  --workspace <path>  Download root (env STUDIUM_WORKSPACE, default: current folder)
  -h, --help          Show this help
  -v, --version       Show the version

Docs: see README.md in the repository`;

const out = (s: string) => process.stdout.write(`${s}\n`);
// `studium-mcp courses | head` closes stdout early: that is not an error.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      workspace: { type: 'string' },
      dir: { type: 'string' },
      force: { type: 'boolean', default: false },
      'no-transcripts': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (values.help) {
    out(HELP);
    return 0;
  }
  if (values.version) {
    out(VERSION);
    return 0;
  }

  const config = loadConfig(
    process.env,
    values.workspace ? { workspace: path.resolve(values.workspace) } : {},
  );
  const log = createLogger(config.logLevel);
  const [command = 'serve', arg] = positionals;

  switch (command) {
    case 'serve':
      // The MCP server exists to serve AI assistants: off while AI features are disabled (core/features.ts).
      // The other commands (login, courses, sync…) do not involve AI and keep working.
      if (!ENABLE_AI_FEATURES) {
        process.stderr.write(
          'studium-mcp: the MCP server is temporarily disabled in this version (ENABLE_AI_FEATURES = false).\n',
        );
        return 2;
      }
      return serve(config, log);
    case 'login':
      return login(config, log);
    case 'logout':
      fs.rmSync(config.sessionFile, { force: true });
      out(`Session deleted (${config.sessionFile}).`);
      return 0;
  }

  const session = new BrowserSession(config, log);
  const client = new McpClient(session, log);
  try {
    switch (command) {
      case 'status': {
        const ok = await client.isSignedIn();
        out(ok ? `Logged in to ${config.profile.name}.` : 'Not logged in: run `studium-mcp login`.');
        out(`Session file: ${config.sessionFile}`);
        return ok ? 0 : 1;
      }
      case 'career': {
        const career = await client.getCareer();
        const st = careerStats(career);
        out(
          `CFU ${st.acquiredCfu}/${st.requiredCfu} · exams ${st.passedExams}/${st.totalExams} · weighted average ${st.weightedAverage ?? '—'}`,
        );
        for (const y of career.years) {
          out(`
Year ${y.year}`);
          for (const e of y.exams)
            out(
              `  ${(e.passed ? formatVote(e.vote) : '··').padStart(3)}  ${String(e.requiredCfu).padStart(2)} CFU  ${e.title}`,
            );
        }
        return 0;
      }
      case 'courses': {
        for (const c of await client.listCourses()) {
          const prog = c.progress === null ? '   —' : `${String(c.progress).padStart(3)}%`;
          out(`${c.code.padEnd(16)} ${prog}  ${c.cfu ? `${c.cfu} CFU  ` : ''}${c.title}`);
        }
        return 0;
      }
      case 'progress': {
        const courses = arg
          ? [{ code: assertCourseCode(arg), title: arg, progress: null as number | null }]
          : (await client.listCourses()).filter((c) => c.progress !== null);
        for (const c of courses) {
          const p = computeProgress(await client.listLessons(c.code));
          const platform = c.progress === null ? '' : `platform ${c.progress}% · `;
          out(`\n${c.title} (${c.code})`);
          out(
            `  ${platform}videos ${p.videoPercent}% watched (${p.watchedLessons}/${p.lessons} lessons), ` +
              `${formatDuration(p.remainingS)} left · self-tests to do: ${p.selfTestsPending.length}`,
          );
          for (const l of p.pending.slice(0, arg ? undefined : 5)) {
            out(`  ${String(l.number).padStart(2)}. ${l.title} — ${formatDuration(l.remainingS)} left`);
            out(`      ${client.watchUrl(c.code, l.lpId)}`);
          }
        }
        return 0;
      }
      case 'sync': {
        if (!arg) throw new Error('Usage: studium-mcp sync CODE');
        const code = assertCourseCode(arg);
        const info = (await client.listCourses()).find((c) => c.code === code);
        if (!info) throw new NotFoundError(`Course ${code} among your enrolments`);
        const dir = resolveInside(config.workspace, values.dir ?? slugify(info.title));
        out(`Syncing "${info.title}" into ${dir}`);
        const report = await syncCourse(client, {
          course: code,
          title: info.title,
          dir,
          force: values.force,
          transcripts: !values['no-transcripts'],
          concurrency: config.concurrency,
          onProgress: (done, total, msg) =>
            process.stderr.write(`\r[${done}/${total}] ${msg.slice(0, 70).padEnd(70)}`),
        });
        process.stderr.write('\n');
        out(JSON.stringify(report, null, 2));
        return report.errors.length ? 1 : 0;
      }
      default:
        out(`Unknown command "${command}".\n\n${HELP}`);
        return 2;
    }
  } finally {
    await session.close();
  }
}

async function serve(config: Config, log: Logger): Promise<number> {
  const session = new BrowserSession(config, log);
  const client = new McpClient(session, log);
  const server = createServer({
    config,
    client,
    browser: new PlaywrightBrowserTools(session),
    advancedTools: process.env.STUDIUM_TOOLS !== 'core',
    log,
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await server.close().catch(() => {});
    await session.close();
    process.exit(0);
  };
  process.stdin.on('close', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.connect(new StdioServerTransport());
  log.info(`MCP server ${VERSION} ready (workspace: ${config.workspace})`);
  if (!session.hasSession()) log.warn('no saved session: run `studium-mcp login`');
  return new Promise(() => {}); // runs until stdin closes
}

async function login(config: Config, log: Logger): Promise<number> {
  out('A browser window is opening: sign in to the platform, then close the window.');
  out('Your password is typed into the official site only; this tool never sees it.');
  const { loggedIn } = await interactiveLogin(config, {
    log,
    onLoggedIn: () => out('Login detected — session saved. You can close the window.'),
  });
  out(loggedIn ? `Session saved to ${config.sessionFile}` : 'Window closed before the login completed.');
  return loggedIn ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`Error: ${formatError(err)}`);
    process.exitCode = 1;
  },
);
