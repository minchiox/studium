// Negative tests for the trust boundaries: write guard, domains, imported profiles, in-app navigation.
import { describe, expect, it } from 'vitest';
import { profileFromDiscovery } from '../src/discovery.ts';
import { isPublicSuffix, registrableDomain } from '../src/domains.ts';
import { classifyRequest, isHostAllowed, isNavigationAllowed, isUnderPath } from '../src/guard.ts';
import { ProfileValidationError, parseProfile, profileHosts } from '../src/profile.ts';
import { PROFILE } from './helpers.ts';

const API = PROFILE.apiBase; // https://api.example.edu

const BASE = {
  id: 'uni',
  name: 'Uni',
  spaUrl: 'https://lms.uni.example.edu/',
  apiBase: 'https://api.uni.example.edu/api',
  watchUrlTemplate: '{spa}videolezioni/{course}/{lp}',
  tokenCookie: 'uni_token',
  allowedHostSuffixes: ['example.edu'],
};

const violationsOf = (input: unknown) => {
  try {
    parseProfile(input);
    return [];
  } catch (e) {
    if (e instanceof ProfileValidationError) return e.violations.map((v) => v.field);
    throw e;
  }
};

describe('write guard', () => {
  it('allows only anchored session-maintenance writes', () => {
    for (const path of ['/oauth/token', '/api/v1/auth/token', '/auth/refresh', '/refresh-token', '/logout']) {
      expect(classifyRequest(PROFILE, 'POST', `${API}${path}`).allow, path).toBe(true);
    }
  });

  it('blocks writes that merely contain "token", "login" or "auth"', () => {
    for (const path of [
      '/student/tokenized-submit',
      '/student/token-exam/submit',
      '/student/login-history/delete',
      '/student/author/update',
      '/student/exam-booking/del-my-reservation',
      '/student/getNotesAndSave',
    ]) {
      expect(classifyRequest(PROFILE, 'POST', `${API}${path}`).allow, path).toBe(false);
    }
  });

  it('blocks percent-encoded tracking paths', () => {
    expect(classifyRequest(PROFILE, 'POST', `${API}/student/lesson%2Fview/inizialize`).allow).toBe(false);
    expect(classifyRequest(PROFILE, 'GET', 'https://other.example.org/lesson%2Fview').allow).toBe(false);
  });

  it('matches the API base on whole path segments', () => {
    expect(isUnderPath('/api', '/api')).toBe(true);
    expect(isUnderPath('/api/x', '/api/')).toBe(true);
    expect(isUnderPath('/api2/x', '/api')).toBe(false);
    const profile = { apiBase: 'https://h.example.edu/api' };
    expect(classifyRequest(profile, 'POST', 'https://h.example.edu/api/student/x').allow).toBe(false);
    // `/api2` is not the student API: the guard does not treat it as such.
    expect(classifyRequest(profile, 'POST', 'https://h.example.edu/api2/form').allow).toBe(true);
  });
});

describe('domains', () => {
  it('knows multi-label public suffixes', () => {
    expect(registrableDomain('lms.uni.ac.uk')).toBe('uni.ac.uk');
    expect(registrableDomain('a.b.uni.edu.it')).toBe('uni.edu.it');
    expect(registrableDomain('studenti.unipegaso.it')).toBe('unipegaso.it');
    expect(registrableDomain('my-uni.github.io')).toBe('my-uni.github.io');
    expect(registrableDomain('127.0.0.1')).toBe('127.0.0.1');
    for (const s of ['it', 'com', 'ac.uk', 'github.io', 'edu.it']) expect(isPublicSuffix(s), s).toBe(true);
    for (const s of ['unipegaso.it', 'uni.ac.uk', 'localhost']) expect(isPublicSuffix(s), s).toBe(false);
  });

  it('discovery never trusts a public suffix', () => {
    const p = profileFromDiscovery({
      spaUrl: 'https://lms.uni.ac.uk/',
      apiBase: 'https://api.uni.ac.uk',
      tokenCookie: 't',
    });
    expect(p.allowedHostSuffixes).toEqual(['uni.ac.uk']);
  });
});

describe('imported profiles', () => {
  it('accepts a coherent profile and lists its hosts', () => {
    const p = parseProfile({ ...BASE, allowedHostSuffixes: ['Example.EDU'] });
    expect(p.allowedHostSuffixes).toEqual(['example.edu']);
    expect(profileHosts(p)).toEqual([
      { field: 'spaUrl', host: 'lms.uni.example.edu' },
      { field: 'apiBase', host: 'api.uni.example.edu' },
    ]);
  });

  it('rejects addresses outside the allowed domains (the token would leave the university)', () => {
    expect(violationsOf({ ...BASE, apiBase: 'https://evil.example.com/api' })).toEqual(['apiBase']);
    expect(violationsOf({ ...BASE, logoutUrl: 'https://evil.example.com/x' })).toEqual(['logoutUrl']);
    expect(violationsOf({ ...BASE, spaUrl: 'https://example.edu.evil.com/' })).toEqual(['spaUrl']);
    expect(violationsOf({ ...BASE, mediaHost: 'https://cdn.evil.com/' })).toEqual(['mediaHost']);
    expect(violationsOf({ ...BASE, watchUrlTemplate: 'https://evil.com/{course}/{lp}' })).toEqual([
      'watchUrlTemplate',
    ]);
  });

  it('rejects public suffixes, plain HTTP and credentials in URLs', () => {
    expect(violationsOf({ ...BASE, allowedHostSuffixes: ['example.edu', 'com'] })).toEqual([
      'allowedHostSuffixes[1]',
    ]);
    expect(violationsOf({ ...BASE, allowedHostSuffixes: ['ac.uk'] })).toContain('allowedHostSuffixes[0]');
    expect(violationsOf({ ...BASE, allowedHostSuffixes: ['*.example.edu'] })).toContain(
      'allowedHostSuffixes[0]',
    );
    expect(violationsOf({ ...BASE, apiBase: 'http://api.uni.example.edu' })).toEqual(['apiBase']);
    expect(violationsOf({ ...BASE, allowInsecureHttp: true, apiBase: 'http://api.uni.example.edu' })).toEqual(
      ['apiBase'],
    );
    expect(violationsOf({ ...BASE, apiBase: 'https://u:p@api.uni.example.edu' })).toEqual(['apiBase']);
  });

  it('keeps plain HTTP for the local mock only', () => {
    expect(
      violationsOf({
        ...BASE,
        spaUrl: 'http://localhost:4010/',
        apiBase: 'http://localhost:4010/api',
        allowedHostSuffixes: ['localhost'],
        allowInsecureHttp: true,
      }),
    ).toEqual([]);
  });
});

describe('in-app navigation', () => {
  it('stays on the university hosts', () => {
    expect(isNavigationAllowed(PROFILE, 'https://app.example.edu/appelli')).toBe(true);
    expect(isNavigationAllowed(PROFILE, 'https://sso.example.edu/login')).toBe(true);
    expect(isNavigationAllowed(PROFILE, 'about:blank')).toBe(true);
    expect(isNavigationAllowed(PROFILE, 'https://phishing.example.com/')).toBe(false);
    expect(isNavigationAllowed(PROFILE, 'https://example.edu.evil.com/')).toBe(false);
    expect(isNavigationAllowed(PROFILE, 'http://app.example.edu/')).toBe(false);
    expect(isNavigationAllowed(PROFILE, 'intent://scan/#Intent;scheme=zxing;end')).toBe(false);
    expect(isNavigationAllowed(PROFILE, 'javascript:alert(1)')).toBe(false);
    expect(isHostAllowed(PROFILE, 'https://user:pw@app.example.edu/')).toBe(false);
  });
});
