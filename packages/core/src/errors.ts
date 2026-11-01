/** Base class: every error thrown on purpose carries a stable `code` that UIs can switch on. */
export class StudiumError extends Error {
  readonly code: string;
  readonly hint: string | undefined;
  constructor(message: string, code: string, hint?: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.hint = hint;
  }
}

export class NotLoggedInError extends StudiumError {
  constructor() {
    super('No saved session.', 'NOT_LOGGED_IN', 'Sign in again.');
  }
}

export class SessionExpiredError extends StudiumError {
  constructor() {
    super('The session has expired and could not be renewed.', 'SESSION_EXPIRED', 'Sign in again.');
  }
}

/** Raised by the guard: the request would write to the platform (e.g. attendance tracking). */
export class BlockedRequestError extends StudiumError {
  constructor(method: string, url: string, reason: string) {
    super(`Blocked ${method} ${url}: ${reason}`, 'REQUEST_BLOCKED');
  }
}

export class HostNotAllowedError extends StudiumError {
  constructor(url: string) {
    super(
      `Host not allowed: ${url}`,
      'HOST_NOT_ALLOWED',
      'Only the platform hosts in the profile are reachable.',
    );
  }
}

/** The platform answered with something we cannot parse: its API probably changed. */
export class PlatformChangedError extends StudiumError {
  constructor(what: string, detail: string) {
    super(`Unexpected response from ${what}: ${detail}`, 'PLATFORM_CHANGED', 'Please open an issue.');
  }
}

export class HttpError extends StudiumError {
  readonly status: number;
  constructor(status: number, url: string, body = '') {
    super(`HTTP ${status} on ${url}${body ? `: ${body.slice(0, 200)}` : ''}`, 'HTTP_ERROR');
    this.status = status;
  }
}

export class NetworkError extends StudiumError {
  constructor(url: string, cause: unknown) {
    super(`Network error on ${url}: ${cause instanceof Error ? cause.message : String(cause)}`, 'NETWORK');
  }
}

export class NotFoundError extends StudiumError {
  constructor(what: string) {
    super(`${what} not found.`, 'NOT_FOUND');
  }
}

export function formatError(err: unknown): string {
  if (err instanceof StudiumError) return err.hint ? `${err.message} ${err.hint}` : err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export const errorCode = (err: unknown): string => (err instanceof StudiumError ? err.code : 'UNKNOWN');
