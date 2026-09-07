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
  if (status === 401) return 'unauthenticated';
  if (status === 429) return 'busy';
  if (status === 504) return 'timeout';
  return 'unavailable';
}

/**
 * Sends a recording for transcription.
 *
 * The file is posted as a multipart part built from its `file://` URI, which
 * React Native's networking layer streams from disk itself. Reading it into a
 * base64 string first — the obvious approach — would hold the whole recording
 * in JS memory and inflate it by a third on the way out, for a payload that is
 * already the slowest thing in this flow on a mobile connection.
 */
export async function transcribeVoice(
  uri: string,
  mimeType: string,
): Promise<string> {
  const token = await idToken();

  const form = new FormData();
  // RN accepts this shape specifically and turns it into a streamed file part.
  // The cast is unavoidable: the DOM's FormData types do not describe it.
  form.append('file', {
    uri,
    name: `note.${mimeType.includes('wav') ? 'wav' : 'm4a'}`,
    type: mimeType,
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${SUPPORT_API_URL}/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Content-Type is deliberately unset: RN fills in the multipart
        // boundary, and setting it by hand produces a body the Worker cannot
        // parse.
        Accept: 'application/json',
      },
      body: form,
    });
  } catch {
    throw new SupportError('offline');
  }

  if (!response.ok) throw new SupportError(kindFromStatus(response.status));

  try {
    const data = (await response.json()) as { text?: string };
    if (typeof data.text !== 'string') throw new SupportError('unavailable');
    return data.text.trim();
  } catch (error) {
    if (error instanceof SupportError) throw error;
    throw new SupportError('unavailable');
  }
}

/** What the user is shown. Never a raw backend message. */
export function supportErrorMessage(kind: SupportFailure): string {
  switch (kind) {
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
