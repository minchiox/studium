import { z } from 'zod';

/**
 * Everything that identifies a specific university instance lives in a profile (JSON),
 * kept outside the source tree. The code only knows the generic shape of the student web app.
 */
export const PlatformProfile = z.object({
  /** Short id, e.g. "my-university". */
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Display name shown in the app, e.g. "La mia università". */
  name: z.string().min(1),
  /** Student web app home: used to sign in and to let the web app renew its own session. */
  spaUrl: z.url(),
  /** Student REST API base URL (no trailing slash). */
  apiBase: z.url(),
  /** Optional legacy portal (Chamilo) home. */
  portalUrl: z.url().optional(),
  /** Lesson player in the web app: `{course}` and `{lp}` are replaced. */
  watchUrlTemplate: z.string().includes('{course}'),
  /** Cookie holding the access token (JWT) set by the web app. */
  tokenCookie: z.string().min(1),
  /** HttpOnly cookie holding the refresh token (never read by this code). */
  refreshCookie: z.string().min(1),
  /** Host serving videos and PDF handouts, with trailing slash. */
  mediaHost: z.url().optional(),
  /** Host serving subtitles (.vtt) with the same paths as the videos, with trailing slash. */
  subtitleHost: z.url().optional(),
  /** Hostname suffixes the tools may reach. */
  allowedHostSuffixes: z.array(z.string().min(1)).min(1),
  /** Page or endpoint that ends the web session (clears the refresh cookie). */
  logoutUrl: z.url().optional(),
  /** Allow plain HTTP (only for local mock servers). */
  allowInsecureHttp: z.boolean().default(false),
});
export type PlatformProfile = z.infer<typeof PlatformProfile>;

export function parseProfile(input: unknown): PlatformProfile {
  const res = PlatformProfile.safeParse(input);
  if (!res.success) throw new Error(`Invalid platform profile: ${z.prettifyError(res.error)}`);
  return { ...res.data, apiBase: res.data.apiBase.replace(/\/+$/, '') };
}

export function watchUrl(profile: PlatformProfile, course: string, lpId: number): string {
  return profile.watchUrlTemplate
    .replace('{spa}', profile.spaUrl)
    .replace('{course}', encodeURIComponent(course))
    .replace('{lp}', String(lpId));
}
