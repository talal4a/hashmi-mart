/**
 * Where the support backend lives.
 *
 * This URL is not a secret and belongs in the bundle — it is the address of a
 * public endpoint, and the thing that keeps it from being *usable* by anyone is
 * the Firebase ID token the app sends with every call, not the obscurity of the
 * hostname. The secret is the Groq key, and that never leaves the Worker.
 *
 * `EXPO_PUBLIC_*` is read at build time and inlined, so a dev build can point at
 * `wrangler dev` without editing tracked source. The fallback is the deployed
 * Worker.
 */

const FALLBACK = 'https://hashmimart-support.workers.dev';

export const SUPPORT_API_URL = (
  process.env.EXPO_PUBLIC_SUPPORT_API_URL || FALLBACK
).replace(/\/+$/, '');

/**
 * True once the URL has actually been pointed somewhere real.
 *
 * `workers.dev` hands out a per-account subdomain, so the fallback above is a
 * placeholder rather than an address — and a placeholder that 404s produces a
 * generic "support is unavailable", which is the least useful possible way to
 * find out the Worker was never deployed. The screen checks this instead and
 * says so plainly.
 */
export const SUPPORT_API_CONFIGURED = SUPPORT_API_URL !== FALLBACK;
