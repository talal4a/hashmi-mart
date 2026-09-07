/**
 * The Groq wire protocol, and the only file that ever sees the API key.
 *
 * Nothing here throws a Groq error outward with its body attached. Groq's
 * failures carry the request back in the message — including, on an auth
 * failure, enough about the key to be worth not forwarding — and the app is
 * required to receive a friendly generic failure rather than a raw upstream
 * one. So every path narrows to a `GroqError` with a code the caller can branch
 * on and nothing else.
 */

const CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Chosen for multilingual coverage rather than raw benchmark score: the
 * assistant has to hold a conversation in Roman Urdu and Roman Punjabi, which
 * smaller instruct models tend to answer in English however they are asked.
 */
const CHAT_MODEL = 'llama-3.3-70b-versatile';

/** Whisper large is the one Groq speech model that handles Urdu and Punjabi. */
const TRANSCRIBE_MODEL = 'whisper-large-v3';

export type GroqErrorCode = 'unauthenticated' | 'rate-limited' | 'upstream' | 'timeout';

export class GroqError extends Error {
  constructor(readonly code: GroqErrorCode, message: string) {
    super(message);
    this.name = 'GroqError';
  }
}

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

/** Maps an upstream status onto something the caller can act on. */
function fail(status: number): never {
  if (status === 401 || status === 403) {
    throw new GroqError('unauthenticated', 'Groq rejected the credential');
  }
  if (status === 429) throw new GroqError('rate-limited', 'Groq is rate limiting');
  throw new GroqError('upstream', `Groq responded ${status}`);
}

async function post(url: string, key: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
    });
  } catch {
    throw new GroqError('upstream', 'Groq request failed');
  }
  if (!response.ok) fail(response.status);
  return response;
}

/**
 * Streams the answer, yielding each delta as it lands.
 *
 * Real token streaming rather than a completed string revealed on a timer: a
 * faked reveal cannot start before the whole answer exists, so the user waits
 * the full generation either way and only *looks* like they are being answered
 * sooner.
 *
 * SSE frames are not guaranteed to arrive whole, so the tail of each chunk is
 * carried into the next read rather than parsed and dropped.
 */
export async function* streamChat(
  key: string,
  messages: ChatTurn[],
): AsyncGenerator<string> {
  const response = await post(CHAT_URL, key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  const body = response.body;
  if (!body) throw new GroqError('upstream', 'Groq returned no body');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // A frame ends at a blank line; anything after the last one is a partial.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.split('\n').find(l => l.startsWith('data:'));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) yield delta;
        } catch {
          // A frame we cannot parse is a frame worth skipping; the stream is
          // still good, and failing the whole answer over one malformed delta
          // is worse than losing a few characters.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Speech to text, language left unset on purpose.
 *
 * Pinning `language` would be the obvious optimisation and the wrong one: this
 * app's users switch between Urdu, Punjabi and English mid-sentence, and a
 * pinned language turns the other two into transliterated nonsense rather than
 * a wrong-but-recoverable guess.
 */
export async function transcribe(
  key: string,
  audio: Blob,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', TRANSCRIBE_MODEL);
  form.append('response_format', 'json');

  const response = await post(TRANSCRIBE_URL, key, { method: 'POST', body: form });
  const json = (await response.json()) as { text?: string };
  if (typeof json.text !== 'string') {
    throw new GroqError('upstream', 'Groq returned no transcript');
  }
  return json.text.trim();
}
