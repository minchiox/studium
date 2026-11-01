import { describe, expect, it } from 'vitest';
import {
  findApiBase,
  findTokenCookie,
  nameFromHost,
  normalizeSiteUrl,
  profileFromDiscovery,
  registrableDomain,
  subtitleHostCandidates,
  withMediaHosts,
} from '../src/discovery.ts';
import { jwt } from './helpers.ts';

const future = Math.floor(Date.now() / 1000) + 3600;

describe('site address', () => {
  it('normalizes what a student would type', () => {
    expect(normalizeSiteUrl('lms.uni.example.edu')).toBe('https://lms.uni.example.edu/');
    expect(normalizeSiteUrl(' https://lms.uni.example.edu/login?x=1 ')).toBe('https://lms.uni.example.edu/');
    expect(normalizeSiteUrl('http://localhost:4010')).toBe('http://localhost:4010/');
  });
  it('explains invalid input', () => {
    expect(() => normalizeSiteUrl('')).toThrow(/Inserisci/);
    expect(() => normalizeSiteUrl('ciao')).toThrow(/indirizzo web valido/);
    expect(() => normalizeSiteUrl('ftp://uni.example.edu')).toThrow(/https/);
  });
  it('derives domain and display name', () => {
    expect(registrableDomain('lms-api.prod.uni.example.edu')).toBe('example.edu');
    expect(registrableDomain('localhost')).toBe('localhost');
    expect(nameFromHost('https://lms.myuni.example.edu/')).toBe('Myuni');
  });
});

describe('session discovery', () => {
  it('finds the access-token cookie, skipping refresh tokens, expired tokens and non-JWT values', () => {
    const cookies = {
      session_id: 'abc',
      x_refresh_token: jwt(future),
      old_token: jwt(1000),
      uni_token: jwt(future),
    };
    expect(findTokenCookie(cookies)).toEqual({ name: 'uni_token', token: cookies.uni_token });
    expect(findTokenCookie({ a: 'b' })).toBeNull();
  });
  it('finds the API base from the web app requests', () => {
    const urls = [
      'https://cdn.example.com/app.js',
      'https://api.prod.uni.example.edu/student/info',
      'https://api.prod.uni.example.edu/notice/unread',
      'http://localhost:4010/api/student/menu',
    ];
    expect(findApiBase(urls)).toBe('https://api.prod.uni.example.edu');
    expect(findApiBase(['http://localhost:4010/api/student/menu'])).toBe('http://localhost:4010/api');
    expect(findApiBase(['https://x.example.edu/other'])).toBeNull();
  });
});

describe('profile building', () => {
  const base = profileFromDiscovery({
    spaUrl: 'https://lms.myuni.example.edu/',
    apiBase: 'https://lms-api.prod.myuni.example.edu',
    tokenCookie: 'myuni_token',
  });

  it('fills sensible defaults', () => {
    expect(base).toMatchObject({
      id: 'site-lms-myuni-example-edu',
      name: 'Myuni',
      spaUrl: 'https://lms.myuni.example.edu/',
      watchUrlTemplate: '{spa}videolezioni/{course}/{lp}',
      allowedHostSuffixes: ['example.edu'],
      allowInsecureHttp: false,
    });
  });

  it('proposes the usual subtitle hosts', () => {
    expect(subtitleHostCandidates(base.spaUrl, 'https://cdn123.cloudfront.example/')).toEqual([
      'https://cdn123.cloudfront.example/',
      'https://video-myuni.example.edu/',
      'https://video.myuni.example.edu/',
      'https://video.example.edu/',
      'https://media.example.edu/',
    ]);
  });

  it('adds media and the first subtitle host that answers', async () => {
    const probed: string[] = [];
    const p = await withMediaHosts(
      base,
      'https://cdn123.cloudfront.example/prof/a/video/A_1.mp4',
      async (url) => {
        probed.push(url);
        return url.startsWith('https://video-myuni.example.edu/');
      },
    );
    expect(probed[0]).toBe('https://cdn123.cloudfront.example/prof/a/video/A_1.vtt');
    expect(p.mediaHost).toBe('https://cdn123.cloudfront.example/');
    expect(p.subtitleHost).toBe('https://video-myuni.example.edu/');
    expect(p.allowedHostSuffixes).toEqual([
      'example.edu',
      'cdn123.cloudfront.example',
      'video-myuni.example.edu',
    ]);
  });

  it('works without subtitles', async () => {
    const p = await withMediaHosts(base, 'https://media.example.edu/a.mp4', async () => false);
    expect(p.subtitleHost).toBeUndefined();
  });
});
