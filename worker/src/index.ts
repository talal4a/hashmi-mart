/**
 * The HashmiMart AI Support backend, on Cloudflare Workers.
 *
 * Two routes, one job between them: keep the Groq credential on this side of
 * the network. The app could call Groq directly in about fifteen lines, and
 * those fifteen lines would put an extractable key in every APK.
 *
 * Being an ordinary HTTPS endpoint rather than a Firebase callable costs one
 * thing and buys two. The cost is authentication, which the callable runtime
 * used to do for free and `auth.ts` now does by hand. What it buys is real SSE
 * — a byte-for-byte passthrough of Groq's own stream instead of a callable's
 * chunk protocol — and an edge that answers from near the user rather than from
 * us-central1, which for users in Pakistan is most of the wait before the first
 * token.
 */

import { bearerFrom, AuthError, verifyIdToken } from './auth';
import { buildSystemPrompt } from './prompt';
import { GroqError, streamChat, transcribe, type ChatTurn } from './groq';
import { parseVoiceOrder, transcribeVoiceOrder } from './voice';

export type Env = {
  GROQ_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
};

/** Enough turns to hold a support conversation, few enough to bound the bill. */
const MAX_HISTORY = 16;
/** A support question is not an essay; anything longer is abuse or a paste. */
const MAX_CHARS = 4000;
/** A voice note has no business nearing this. */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const ALLOWED_AUDIO = new Set([
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
]);

type ClientTurn = { role: 'user' | 'assistant'; content: string };

/**
 * Whatever the client sent, reduced to turns this Worker is willing to bill for.
 *
 * The client is not trusted to have trimmed anything: a modified build can post
 * a thousand turns of arbitrary text, and every one of them would be paid for
 * here. Roles are re-checked too — a forged `system` turn is the ordinary way
 * to talk a model out of its own instructions, and dropping unknown roles is
 * cheaper than trying to detect that later.
 */
function sanitiseHistory(raw: unknown): ClientTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ClientTurn[] = [];
  for (const item of raw) {
    const role = (item as ClientTurn)?.role;
    const content = (item as ClientTurn)?.content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || content.trim().length === 0) continue;
    turns.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  return turns.slice(-MAX_HISTORY);
}

/**
 * The token the prompt appends when a human is genuinely needed.
 *
 * Stripped here rather than in the app so the client never has to know it
 * exists: the UI receives a boolean and the user never sees the marker, even in
 * the window between a partial stream and the final payload.
 */
const HANDOFF = '[[HANDOFF]]';

function splitHandoff(text: string): { content: string; handoff: boolean } {
  return {
    content: text.split(HANDOFF).join('').trimEnd(),
    handoff: text.includes(HANDOFF),
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * One friendly failure for every upstream fault.
 *
 * The status code is the whole contract with the app: `supportService.ts`
 * branches on it to pick a message, so these are chosen to match what the app
 * can actually do about each one — 429 means wait, 401 means sign in again,
 * everything else means retry or use WhatsApp.
 */
function errorResponse(error: unknown): Response {
  if (error instanceof GroqError) {
    console.error('groq_failed', error.code, error.message);
    if (error.code === 'rate-limited') {
      return json({ error: 'busy' }, 429);
    }
    if (error.code === 'timeout') {
      return json({ error: 'timeout' }, 504);
    }
    return json({ error: 'unavailable' }, 503);
  }
  console.error('support_failed', (error as Error)?.message);
  return json({ error: 'unavailable' }, 503);
}

/** Verifies the caller, or throws the response to send instead. */
async function requireUser(request: Request, env: Env): Promise<string> {
  const token = bearerFrom(request);
  if (!token) throw json({ error: 'unauthenticated' }, 401);
  try {
    const user = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);
    return user.uid;
  } catch (error) {
    if (error instanceof AuthError) {
      // Logged with the real reason, answered with a generic one: telling a
      // caller *why* their forged token failed is free help for forging a
      // better one.
      console.warn('auth_rejected', error.message);
      throw json({ error: 'unauthenticated' }, 401);
    }
    throw json({ error: 'unavailable' }, 503);
  }
}

/**
 * POST /chat — Server-Sent Events.
 *
 * The response starts streaming before Groq has finished, so an error that
 * happens mid-answer cannot become an HTTP status any more; it is sent as a
 * terminal `error` frame instead, which the client treats exactly like a failed
 * request. Errors *before* the first byte still get a real status code, which is
 * why the Groq call is opened inside the stream rather than before it.
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);

  let body: { message?: unknown; history?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const message = String(body?.message ?? '').trim();
  if (!message) return json({ error: 'invalid' }, 400);

  const turns: ChatTurn[] = [
    // Context is server-supplied today (nothing populates it yet) and stays that
    // way: honouring a client-sent "your order shipped" would make the
    // truthfulness rule decorative.
    { role: 'system', content: buildSystemPrompt(null) },
    ...sanitiseHistory(body?.history),
    { role: 'user', content: message.slice(0, MAX_CHARS) },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      let full = '';
      let emitted = 0;
      try {
        for await (const delta of streamChat(env.GROQ_API_KEY, turns)) {
          full += delta;
          // Chunks are sent from the already-cleaned prefix so a handoff token
          // split across two deltas can never flicker on screen. Holding back
          // the last few characters is what makes that safe.
          const safe = full.length - HANDOFF.length;
          if (safe > emitted) {
            const { content } = splitHandoff(full.slice(0, safe));
            if (content.length > emitted) {
              send({ delta: content.slice(emitted) });
              emitted = content.length;
            }
          }
        }
        send({ done: true, ...splitHandoff(full) });
      } catch (error) {
        const code =
          error instanceof GroqError && error.code === 'rate-limited'
            ? 'busy'
            : error instanceof GroqError && error.code === 'timeout'
              ? 'timeout'
              : 'unavailable';
        console.error('stream_failed', (error as Error)?.message);
        send({ error: code });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Without this some proxies buffer the whole response and the stream
      // arrives as one lump, which is a silent, unreproducible-on-wifi bug.
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST /transcribe — multipart, forwarded to Groq as multipart.
 *
 * The audio arrives as a file part rather than base64 in JSON. Base64 would
 * cost a third more bytes over a mobile connection and force both ends to
 * encode and decode it — real CPU on a Worker whose free tier is measured in
 * milliseconds of it.
 */
async function handleTranscribe(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'invalid' }, 400);
  if (file.size === 0) return json({ error: 'invalid' }, 400);
  if (file.size > MAX_AUDIO_BYTES) return json({ error: 'too-large' }, 413);

  // Some clients post `audio/m4a` without parameters, others append a codec;
  // comparing the bare type keeps both working.
  const mimeType = (file.type || 'audio/m4a').split(';')[0].trim();
  if (!ALLOWED_AUDIO.has(mimeType)) return json({ error: 'invalid' }, 400);

  try {
    const text = await transcribe(
      env.GROQ_API_KEY,
      file,
      file.name || 'note.m4a',
    );
    // An empty transcript is silence, not a failure — the app offers a
    // re-record rather than sending a blank question to the model, and must
    // never invent one either way.
    return json({ text }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /voice/transcribe — the same multipart contract as /transcribe, with the
 * grocery vocabulary applied.
 *
 * A separate route rather than a flag on the existing one because the two have
 * different futures: support notes are conversation and orders are inventory,
 * and the moment either needs its own model, cap or prompt they would have to
 * be split anyway.
 */
async function handleVoiceTranscribe(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: 'invalid' }, 400);
  }
  if (file.size > MAX_AUDIO_BYTES) return json({ error: 'too-large' }, 413);

  const mimeType = (file.type || 'audio/m4a').split(';')[0].trim();
  if (!ALLOWED_AUDIO.has(mimeType)) return json({ error: 'invalid' }, 400);

  try {
    const result = await transcribeVoiceOrder(
      env.GROQ_API_KEY,
      file,
      file.name || 'order.m4a',
    );
    // An empty transcript is silence. The app asks for the order again;
    // inventing words for it is the one thing this must never do.
    return json(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /voice/parse — transcript in, structured items out.
 *
 * Split from transcription so a parse that comes back empty still leaves the
 * app holding what was heard. That is what makes the fallback possible: the
 * customer sees their own words and can send the recording instead of starting
 * the whole order again.
 */
async function handleVoiceParse(request: Request, env: Env): Promise<Response> {
  await requireUser(request, env);

  let body: { transcript?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid' }, 400);
  }

  const transcript = String(body?.transcript ?? '').trim();
  if (!transcript) return json({ error: 'invalid' }, 400);

  try {
    return json(await parseVoiceOrder(env.GROQ_API_KEY, transcript), 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.GROQ_API_KEY) {
      console.error('missing_groq_key');
      return json({ error: 'unavailable' }, 503);
    }

    const { pathname } = new URL(request.url);

    // A liveness check that touches neither Groq nor the user's token, so it can
    // be curl'd to tell "the Worker is deployed" apart from "the key is wrong".
    if (request.method === 'GET' && pathname === '/health') {
      return json({ ok: true }, 200);
    }

    if (request.method !== 'POST') {
      return json({ error: 'not-found' }, 405);
    }

    try {
      if (pathname === '/chat') return await handleChat(request, env);
      if (pathname === '/transcribe') return await handleTranscribe(request, env);
      if (pathname === '/voice/transcribe') {
        return await handleVoiceTranscribe(request, env);
      }
      if (pathname === '/voice/parse') return await handleVoiceParse(request, env);
      return json({ error: 'not-found' }, 404);
    } catch (thrown) {
      // `requireUser` throws the Response it wants sent, which keeps the auth
      // check a single line at the top of each handler.
      if (thrown instanceof Response) return thrown;
      return errorResponse(thrown);
    }
  },
};
