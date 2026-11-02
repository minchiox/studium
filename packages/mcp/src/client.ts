import { assertHostAllowed, LmsClient, type Logger, silentLogger } from '@studium/core';
import { type BrowserSession, playwrightTokens, playwrightTransport } from './session.ts';
import type { FetchedFile, SyncClient } from './sync.ts';

/** Core client over the Playwright session, plus binary downloads for the sync. */
export class McpClient extends LmsClient implements SyncClient {
  private readonly session: BrowserSession;

  constructor(session: BrowserSession, log: Logger = silentLogger) {
    super(session.config.profile, playwrightTransport(session), playwrightTokens(session, log), {
      log,
      concurrency: session.config.concurrency,
    });
    this.session = session;
  }

  async fetchFile(url: string): Promise<FetchedFile | null> {
    // Handout URLs come from the API: never send the session to a host outside the university.
    assertHostAllowed(this.session.config.profile, url, this.session.config.extraAllowedHosts);
    const res = await this.session.fetch(url, { headers: this.session.headersFor(url) });
    if (res.status() >= 400 && res.status() < 500) return null;
    if (!res.ok()) throw new Error(`HTTP ${res.status()} on ${url}`);
    return { body: new Uint8Array(await res.body()), contentType: res.headers()['content-type'] ?? '' };
  }
}

/** What the MCP tools need from the platform (implemented by McpClient, faked in tests). */
export type ToolClient = SyncClient &
  Pick<
    LmsClient,
    'isSignedIn' | 'getCareer' | 'getNotices' | 'getAgenda' | 'getExamsOverview' | 'officialPage' | 'watchUrl'
  >;
