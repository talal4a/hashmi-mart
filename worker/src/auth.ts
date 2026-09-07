/**
 * Firebase ID token verification, done by hand.
 *
 * This file exists because of what was lost in moving off Firebase Callable
 * Functions. A callable verifies the caller's ID token in the runtime before
 * any handler code runs, and hands you `request.auth` or nothing. A Worker gets
 * none of that — an unguarded endpoint here is a public Groq proxy, and the
 * first person to find it spends this account's quota.
 *
 * So the same check is reimplemented on the edge: the app still signs in with
 * Firebase Auth and still sends its ID token, and this verifies the signature
 * against Google's published keys rather than trusting the token's contents.
 *
 * The distinction that matters: decoding a JWT is not verifying one. The
 * payload is base64, not encryption — anyone can write `{"sub":"someone-else"}`
 * and send it. Only the RS256 signature check below makes the claims mean
 * anything, which is why there is no "just read the uid" shortcut here.
 */

export type VerifiedUser = { uid: string; email?: string };

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/**
 * Google's signing keys, cached in the isolate.
 *
 * The keys rotate roughly daily, and fetching them on every request would add a
 * round trip to every support message. Workers reuse an isolate across
 * requests, so a module-level cache is a real cache — and honouring the
 * endpoint's own `max-age` rather than picking a number means a rotation is
 * picked up exactly when Google says it will be.
 */
let cache: { keys: Record<string, CryptoKey>; expires: number } | null = null;

/** In-flight fetch, so a burst of cold requests triggers one refresh, not twenty. */
let inflight: Promise<Record<string, CryptoKey>> | null = null;

async function loadKeys(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.keys;
  if (inflight) return inflight;

  inflight = (async () => {
    const response = await fetch(JWKS_URL);
    if (!response.ok) {
      throw new AuthError(`Could not fetch signing keys (${response.status})`);
    }

    const { keys } = (await response.json()) as { keys: JsonWebKey[] };
    const imported: Record<string, CryptoKey> = {};
    for (const jwk of keys) {
      const kid = (jwk as { kid?: string }).kid;
      if (!kid) continue;
      imported[kid] = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
    }

    // Falls back to an hour when the header is missing or unparseable, which is
    // short enough that a rotation is never missed by long.
    const control = response.headers.get('cache-control') ?? '';
    const maxAge = Number(/max-age=(\d+)/.exec(control)?.[1]);
    const ttl = Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 3600;

    cache = { keys: imported, expires: Date.now() + ttl * 1000 };
    return imported;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** base64url, which is base64 with two characters swapped and no padding. */
function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
}

type Header = { alg?: string; kid?: string };
type Payload = {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
};

/**
 * Verifies a Firebase ID token and returns who it belongs to.
 *
 * Every check below is one Firebase's own SDK performs, and each rejects a real
 * attack rather than a typo: a wrong `aud` is a token minted by a *different*
 * Firebase project (anyone can make one, for free, in a minute — this is the
 * check people forget, and it is the one that makes the endpoint free for the
 * whole internet); a wrong `iss` is a token from somewhere that is not Firebase
 * at all; a stale `exp` is a token lifted from a log or a device someone no
 * longer has.
 *
 * A small clock skew is allowed on `iat` because phones are not perfectly
 * synchronised and a device running two seconds fast should not be told to sign
 * in again.
 */
export async function verifyIdToken(
  token: string,
  projectId: string,
): Promise<VerifiedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed token');

  const [rawHeader, rawPayload, rawSignature] = parts;

  let header: Header;
  let payload: Payload;
  try {
    header = decodeJson<Header>(rawHeader);
    payload = decodeJson<Payload>(rawPayload);
  } catch {
    throw new AuthError('Unreadable token');
  }

  // `alg: "none"` is the classic forged-token trick: a JWT with no signature at
  // all, which a verifier that trusts the header will happily accept.
  if (header.alg !== 'RS256') throw new AuthError('Unexpected token algorithm');
  if (!header.kid) throw new AuthError('Token has no key id');

  const keys = await loadKeys();
  const key = keys[header.kid];
  if (!key) throw new AuthError('Unknown signing key');

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(rawSignature),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
  );
  if (!valid) throw new AuthError('Bad token signature');

  const now = Math.floor(Date.now() / 1000);
  const SKEW = 60;

  if (payload.aud !== projectId) throw new AuthError('Token is for another project');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('Token from an unexpected issuer');
  }
  if (!payload.sub) throw new AuthError('Token has no subject');
  if (typeof payload.exp !== 'number' || payload.exp <= now - SKEW) {
    throw new AuthError('Token has expired');
  }
  if (typeof payload.iat === 'number' && payload.iat > now + SKEW) {
    throw new AuthError('Token is not valid yet');
  }

  return { uid: payload.sub, email: payload.email };
}

/** Pulls the bearer token out of an Authorization header. */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
