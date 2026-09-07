import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyIdToken, AuthError } from '../.test-build/auth.mjs';

/**
 * The check that stands between this Worker and a public Groq proxy.
 *
 * Moving off Firebase Callable Functions moved authentication from the runtime
 * into our own code, which means the thing that used to be impossible to get
 * wrong is now ordinary code with ordinary bugs. Every case below is a token
 * somebody can actually mint and send — most freely, in a minute, with no
 * access to this project — so each one is a live way in if the corresponding
 * check is dropped.
 *
 * These run against real RSA signatures rather than a stubbed verifier: a test
 * that mocks `crypto.subtle.verify` would pass just as happily against code
 * that never called it.
 */

const PROJECT = 'hahmi-mart';
const KID = 'test-kid';

const rsa = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const trusted = await crypto.subtle.generateKey(rsa, true, ['sign', 'verify']);
const attacker = await crypto.subtle.generateKey(rsa, true, ['sign', 'verify']);
const publicJwk = await crypto.subtle.exportKey('jwk', trusted.publicKey);

// Stands in for Google's JWKS endpoint, publishing only the trusted key.
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({ keys: [{ ...publicJwk, kid: KID, use: 'sig', alg: 'RS256' }] }),
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    },
  );

const b64u = value => Buffer.from(value).toString('base64url');

async function mint({ header = {}, payload = {}, key = trusted.privateKey, tamper = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: KID, ...header }));
  const claims = {
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'user-123',
    email: 'customer@example.com',
    iat: now,
    exp: now + 3600,
    ...payload,
  };
  const body = b64u(JSON.stringify(claims));
  const signature = key
    ? new Uint8Array(
        await crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          key,
          new TextEncoder().encode(`${head}.${body}`),
        ),
      )
    : new Uint8Array([1, 2, 3]);

  if (tamper) {
    // Rewrite the uid and keep the original signature — the classic forgery,
    // and the reason decoding a JWT is not the same as verifying one.
    const swapped = b64u(JSON.stringify({ ...claims, sub: 'someone-else' }));
    return `${head}.${swapped}.${b64u(signature)}`;
  }
  return `${head}.${body}.${b64u(signature)}`;
}

const rejects = async (token, because) => {
  await assert.rejects(
    () => verifyIdToken(token, PROJECT),
    error => error instanceof AuthError,
    because,
  );
};

test('a genuine token is accepted and yields its uid', async () => {
  const user = await verifyIdToken(await mint(), PROJECT);
  assert.equal(user.uid, 'user-123');
  assert.equal(user.email, 'customer@example.com');
});

test('a token with a rewritten uid is rejected', async () => {
  await rejects(await mint({ tamper: true }), 'signature no longer matches the payload');
});

test('a token signed by another key is rejected', async () => {
  await rejects(await mint({ key: attacker.privateKey }), 'not signed by Google');
});

test('alg:none is rejected', async () => {
  await rejects(
    await mint({ header: { alg: 'none' }, key: null }),
    'an unsigned token must never be trusted',
  );
});

test('a token from a different Firebase project is rejected', async () => {
  // The check people forget. Anyone can create their own Firebase project and
  // mint perfectly valid, Google-signed tokens in it; only `aud` distinguishes
  // those from this app's users.
  await rejects(await mint({ payload: { aud: 'someone-elses-app' } }), 'wrong audience');
});

test('a token from an unexpected issuer is rejected', async () => {
  await rejects(await mint({ payload: { iss: 'https://evil.example/' } }), 'wrong issuer');
});

test('an expired token is rejected', async () => {
  const past = Math.floor(Date.now() / 1000) - 3600;
  await rejects(await mint({ payload: { exp: past } }), 'expired');
});

test('a token issued in the future is rejected', async () => {
  const ahead = Math.floor(Date.now() / 1000) + 3600;
  await rejects(await mint({ payload: { iat: ahead } }), 'not valid yet');
});

test('a small clock skew is tolerated', async () => {
  // Phones are not perfectly synchronised; a device running a few seconds fast
  // should not be told to sign in again.
  const soon = Math.floor(Date.now() / 1000) + 30;
  const user = await verifyIdToken(await mint({ payload: { iat: soon } }), PROJECT);
  assert.equal(user.uid, 'user-123');
});

test('an unknown key id is rejected', async () => {
  await rejects(await mint({ header: { kid: 'not-a-real-kid' } }), 'unknown kid');
});

test('a token with no subject is rejected', async () => {
  await rejects(await mint({ payload: { sub: undefined } }), 'no uid to attribute it to');
});

test('malformed input is rejected rather than throwing', async () => {
  for (const bad of ['', 'not.a.jwt', 'a.b', '...', 'x'.repeat(500)]) {
    await rejects(bad, `rejects ${JSON.stringify(bad.slice(0, 12))}`);
  }
});
