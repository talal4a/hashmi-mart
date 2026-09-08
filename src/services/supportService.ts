import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { auth } from '../config/firebase';
import { SUPPORT_API_URL } from '../config/backend';
import { streamSSE } from './sse';
import type { ChatRole } from '../types/support';

/**
 * The app's half of the secure Groq route.
 *
 * There is no Groq URL, model name or key in this file, and there must never be
 * one. What the app holds is the address of the Worker and the user's own
 * Firebase ID token; the Worker verifies that token before it will spend a
 * single Groq call, which is what stops the endpoint being a free proxy for
 * whoever finds it.
 */

export type SupportTurn = { role: ChatRole; content: string };

/** What every caller gets back, whatever went wrong on the way. */
export type SupportFailure =
  | 'silent'
  | 'missing-file'
  | 'invalid-audio'
  | 'offline'
  | 'unauthenticated'
  | 'busy'
  | 'timeout'
  | 'aborted'
  | 'unavailable';

export class SupportError extends Error {
  constructor(readonly kind: SupportFailure) {
    super(kind);
    this.name = 'SupportError';
  }
}

/**
 * The caller's ID token, refreshed if it is close to expiring.
 *
 * `getIdToken()` returns the cached token until roughly five minutes before it
 * expires and refreshes transparently after that, so this is one call rather
 * than a refresh policy. What it cannot do is invent a session: a signed-out
 * user gets `unauthenticated` here rather than a 401 from the edge, which saves
 * a round trip and gives the same answer.
 */
async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new SupportError('unauthenticated');
  try {
    return await user.getIdToken();
  } catch {
    throw new SupportError('unauthenticated');
  }
}

/**
 * Asks Hashmi AI, calling `onDelta` as real tokens arrive.
 *
 * The deltas are genuinely from the model — the Worker forwards Groq's own SSE
 * stream — so `onDelta` firing is proof the answer has begun, which is what the
 * thinking-to-answer morph keys off. If the transport cannot stream, the
 * terminal frame still resolves this promise with the whole answer and
 * `onDelta` simply never fires; callers must render the returned content either
 * way rather than assuming they accumulated it.
 */
export async function askSupport(
  message: string,
  history: SupportTurn[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; handoff: boolean }> {
  const token = await idToken();

  return new Promise((resolve, reject) => {
    streamSSE(
      `${SUPPORT_API_URL}/chat`,
      token,
      { message, history },
      {
        onDelta,
        onDone: payload => {
          // A response shaped wrong is a failure, not a message.
          if (!payload.content.trim()) {
            reject(new SupportError('unavailable'));
            return;
          }
          resolve(payload);
        },
        onError: kind => reject(new SupportError(kind)),
      },
      signal,
    );
  });
}

/** HTTP status to the six things the UI does differently. */
function kindFromStatus(status: number): SupportFailure {
  if (status === 400 || status === 413 || status === 415)
    return 'invalid-audio';
  if (status === 401) return 'unauthenticated';
  if (status === 429) return 'busy';
  if (status === 504) return 'timeout';
  return 'unavailable';
}

/**
 * Sends a recording for transcription.
 *
 * Expo fetch requires a File/Blob with readable bytes. The legacy React Native
 * `{ uri, name, type }` descriptor throws during multipart encoding, before any
 * network request is made. Keep the native File and let Expo set the boundary.
 */
export async function transcribeVoice(
  uri: string,
  _mimeType: string,
  signal?: AbortSignal,
): Promise<string> {
  const token = await idToken();
  if (signal?.aborted) throw new SupportError('aborted');
  let file: File;
  try {
    file = new File(uri);
    if (!file.exists || file.size === 0) throw new SupportError('missing-file');
  } catch {
    throw new SupportError('missing-file');
  }
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45_000);
  const form = new FormData();
  form.append('file', file);
  try {
    const response = await expoFetch(`${SUPPORT_API_URL}/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) throw new SupportError(kindFromStatus(response.status));
    let data: { text?: string };
    try {
      data = await response.json();
    } catch {
      throw new SupportError('unavailable');
    }
    if (typeof data.text !== 'string') throw new SupportError('unavailable');
    return data.text.trim();
  } catch (caught) {
    if (timedOut) throw new SupportError('timeout');
    if (signal?.aborted) throw new SupportError('aborted');
    if (caught instanceof SupportError) throw caught;
    throw new SupportError('offline');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** What the user is shown. Never a raw backend message. */
export function supportErrorMessage(kind: SupportFailure): string {
  switch (kind) {
    case 'silent':
      return "Hashmi AI couldn't hear anything. Please record again.";
    case 'missing-file':
      return 'This recording is no longer available. Please record again.';
    case 'invalid-audio':
      return 'This recording could not be read. Please record a new voice note.';
    case 'offline':
      return 'You seem to be offline. Check your connection and try again.';
    case 'unauthenticated':
      return 'Please sign in again to continue chatting with Hashmi AI.';
    case 'busy':
      return 'Support is very busy right now. Try again in a moment.';
    case 'timeout':
      return 'That took too long to answer. Try again?';
    case 'aborted':
      return 'Stopped.';
    default:
      return "Hashmi AI couldn't answer just now.";
  }
}
