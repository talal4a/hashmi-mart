import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { ChatRole } from '../types/support';

/**
 * The app's half of the secure Groq route.
 *
 * There is no Groq URL, model name or key in this file, and there must never be
 * one. Everything here goes through a callable, which means Firebase attaches
 * the signed-in user's ID token for us and the backend can reject anonymous
 * traffic without this file knowing how.
 */

export type SupportTurn = { role: ChatRole; content: string };

type ChatRequest = { message: string; history: SupportTurn[] };
type ChatResponse = { content: string; handoff: boolean };
type ChatChunk = { delta: string };

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
 * Firebase error codes, narrowed to the six things the UI actually does
 * differently.
 *
 * The mapping matters more than it looks: `unavailable` is Firebase's code for
 * "no network" *and* the backend's code for "Groq is down", and both of those
 * want the same screen — a retry plus a WhatsApp offer — so collapsing them is
 * correct rather than lazy. What must not collapse is `unauthenticated`, which
 * no amount of retrying fixes.
 */
function classify(error: unknown): SupportError {
  const code = String((error as { code?: string })?.code ?? '');
  const name = String((error as { name?: string })?.name ?? '');
  if (name === 'AbortError') return new SupportError('aborted');
  if (code.endsWith('unauthenticated')) return new SupportError('unauthenticated');
  if (code.endsWith('resource-exhausted')) return new SupportError('busy');
  if (code.endsWith('deadline-exceeded')) return new SupportError('timeout');
  if (code.endsWith('unavailable') || code.endsWith('internal')) {
    return new SupportError('unavailable');
  }
  return new SupportError('unavailable');
}

/** A response shaped wrong is a failure, not a message. PRD section 14. */
function readChat(result: HttpsCallableResult<ChatResponse>): ChatResponse {
  const data = result.data as Partial<ChatResponse> | undefined;
  if (!data || typeof data.content !== 'string' || data.content.trim().length === 0) {
    throw new SupportError('unavailable');
  }
  return { content: data.content, handoff: data.handoff === true };
}

/**
 * Asks Hashmi AI, calling `onDelta` as real tokens arrive.
 *
 * The deltas are genuinely from the model — the backend forwards Groq's SSE
 * stream — so `onDelta` firing is proof the answer has begun, which is what the
 * thinking-to-answer morph keys off. If the transport cannot stream, the final
 * payload still resolves and `onDelta` simply never fires; callers must render
 * the returned content either way rather than assuming they accumulated it.
 */
export async function askSupport(
  message: string,
  history: SupportTurn[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const callable = httpsCallable<ChatRequest, ChatResponse, ChatChunk>(
    functions,
    'supportChat',
  );
  try {
    const { stream, data } = await callable.stream({ message, history }, { signal });
    for await (const chunk of stream) {
      if (typeof chunk?.delta === 'string' && chunk.delta.length > 0) {
        onDelta(chunk.delta);
      }
    }
    const settled = await data;
    return readChat({ data: settled } as HttpsCallableResult<ChatResponse>);
  } catch (error) {
    if (error instanceof SupportError) throw error;
    throw classify(error);
  }
}

/**
 * Sends a recording for transcription.
 *
 * Base64 over a callable rather than a Storage upload plus a trigger: a voice
 * note is tens of kilobytes, and the round trip a bucket write would add is
 * paid by the user staring at a waveform. The size ceiling is enforced on the
 * backend, which is the only place a modified client cannot argue with it.
 */
export async function transcribeVoice(
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  const callable = httpsCallable<
    { audioBase64: string; mimeType: string },
    { text: string }
  >(functions, 'supportTranscribe');
  try {
    const result = await callable({ audioBase64, mimeType });
    const text = result.data?.text;
    if (typeof text !== 'string') throw new SupportError('unavailable');
    return text.trim();
  } catch (error) {
    if (error instanceof SupportError) throw error;
    throw classify(error);
  }
}

/** What the user is shown. Never a raw Firebase or Groq message. */
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
