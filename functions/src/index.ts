/**
 * The HashmiMart AI Support backend.
 *
 * Two callables, one job between them: keep the Groq credential on this side of
 * the network. PRD section 11.1 makes that non-negotiable, and it is the reason
 * these exist at all — the app could talk to Groq directly in about fifteen
 * lines, and those fifteen lines would put an extractable key in every APK.
 *
 * Both are `onCall` rather than `onRequest` so that Firebase Auth is verified by
 * the runtime before any of this code runs. Anonymous callers are rejected: an
 * open endpoint here is somebody else's free inference bill.
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { buildSystemPrompt } from './prompt';
import {
  completeChat,
  GroqError,
  streamChat,
  transcribe,
  type ChatTurn,
} from './groq';

/**
 * Secret Manager, not `functions.config()` and not a committed `.env`. The
 * value is injected into the process only for the functions that declare it
 * below, so a future function added to this file cannot read it by accident.
 */
const GROQ_API_KEY = defineSecret('GROQ_API_KEY');

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

/** Enough turns to hold a support conversation, few enough to bound the bill. */
const MAX_HISTORY = 16;
/** A support question is not an essay; anything longer is abuse or a paste. */
const MAX_CHARS = 4000;
/** ~10 MB is the callable payload ceiling; a voice note has no business nearing it. */
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
 * Whatever the client sent, reduced to turns this function is willing to bill for.
 *
 * The client is not trusted to have trimmed anything: a modified build can post
 * a thousand turns of arbitrary text, and every one of them would be paid for
 * here. Roles are re-checked too — a forged `system` turn is the ordinary way to
 * talk a model out of its own instructions, and dropping unknown roles is
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

/** One friendly failure for every upstream fault. PRD section 14. */
function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof GroqError) {
    // Logged with the real cause; returned without it.
    logger.error('groq_failed', { code: error.code, message: error.message });
    if (error.code === 'rate-limited') {
      return new HttpsError('resource-exhausted', 'Support is busy right now.');
    }
    if (error.code === 'timeout') {
      return new HttpsError('deadline-exceeded', 'That took too long.');
    }
    return new HttpsError('unavailable', 'Support is unavailable right now.');
  }
  logger.error('support_failed', { message: (error as Error)?.message });
  return new HttpsError('internal', 'Support is unavailable right now.');
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
  const handoff = text.includes(HANDOFF);
  return { content: text.split(HANDOFF).join('').trimEnd(), handoff };
}

export const supportChat = onCall(
  { secrets: [GROQ_API_KEY], enforceAppCheck: false },
  async (request, response) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use support.');
    }

    const message = String((request.data as { message?: unknown })?.message ?? '').trim();
    if (!message) {
      throw new HttpsError('invalid-argument', 'Message is empty.');
    }

    const history = sanitiseHistory((request.data as { history?: unknown })?.history);
    // Context is server-supplied today (nothing populates it yet) and stays that
    // way: honouring a client-sent "your order shipped" would make section 16's
    // truthfulness rule decorative.
    const system = buildSystemPrompt(null);

    const turns: ChatTurn[] = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message.slice(0, MAX_CHARS) },
    ];

    try {
      // `acceptsStreaming` is false for an older client or a retried call, and
      // the non-streaming path below is the answer to that rather than an error.
      if (!request.acceptsStreaming || !response) {
        return splitHandoff(await completeChat(turns));
      }

      let full = '';
      let emitted = 0;
      for await (const delta of streamChat(turns)) {
        full += delta;
        // Chunks are sent from the already-cleaned prefix so a handoff token
        // split across two deltas can never flicker on screen. Holding back the
        // last few characters is what makes that safe.
        const safe = full.length - HANDOFF.length;
        if (safe > emitted) {
          const { content } = splitHandoff(full.slice(0, safe));
          if (content.length > emitted) {
            response.sendChunk({ delta: content.slice(emitted) });
            emitted = content.length;
          }
        }
      }
      return splitHandoff(full);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);

export const supportTranscribe = onCall(
  { secrets: [GROQ_API_KEY], enforceAppCheck: false },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use support.');
    }

    const data = request.data as { audioBase64?: unknown; mimeType?: unknown };
    const base64 = typeof data?.audioBase64 === 'string' ? data.audioBase64 : '';
    const mimeType = typeof data?.mimeType === 'string' ? data.mimeType : 'audio/m4a';

    if (!base64) throw new HttpsError('invalid-argument', 'No audio received.');
    if (!ALLOWED_AUDIO.has(mimeType)) {
      throw new HttpsError('invalid-argument', 'Unsupported audio format.');
    }

    const audio = Buffer.from(base64, 'base64');
    if (audio.byteLength === 0) {
      throw new HttpsError('invalid-argument', 'No audio received.');
    }
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      throw new HttpsError('invalid-argument', 'That recording is too long.');
    }

    try {
      const extension = mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('webm')
          ? 'webm'
          : mimeType.includes('ogg')
            ? 'ogg'
            : mimeType.includes('mpeg') || mimeType.includes('mp3')
              ? 'mp3'
              : 'm4a';
      const text = await transcribe(audio, mimeType, `note.${extension}`);
      // An empty transcript is silence, not a failure — the app offers a re-record
      // rather than sending a blank question to the model. PRD section 14 forbids
      // inventing one either way.
      return { text };
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
