import { base } from '$app/paths';

/**
 * Sanitise a `?next=` value into a path we're willing to navigate to after sign-in.
 *
 * Only root-relative paths inside the app's base are accepted. Protocol-relative
 * (`//evil.com`) and backslash (`/\evil.com`) forms are rejected because browsers
 * normalise some of them into a host — that would turn the login redirect into an
 * open redirect, handing anyone a fossunited.org link that lands elsewhere.
 * Returns null when the value can't be trusted, so callers fall back to /contacts.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  if (raw[1] === '/' || raw[1] === '\\') return null;
  // On the GitHub Pages demo `base` is /rolodex; in production it is ''.
  if (!raw.startsWith(`${base}/`)) return null;
  // Bouncing back to the login screen would loop.
  if (raw === `${base}/login` || raw.startsWith(`${base}/login?`) || raw.startsWith(`${base}/login/`)) {
    return null;
  }
  return raw;
}

/** Where to land after a successful sign-in. */
export function afterLogin(raw: string | null | undefined): string {
  return safeNext(raw) ?? `${base}/contacts`;
}

/**
 * The login URL to bounce an unauthenticated visitor to, carrying where they
 * were headed so a shared deep link survives the round trip.
 */
export function loginUrl(from: string): string {
  const next = safeNext(from);
  return next && next !== `${base}/contacts`
    ? `${base}/login?next=${encodeURIComponent(next)}`
    : `${base}/login`;
}
