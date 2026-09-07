/**
 * The Groq wire protocol, and the only file that ever sees the API key.
 *
 * Nothing here throws a Groq error outward with its body attached. Groq's
 * failures carry the request back in the message — including, on an auth
 * failure, enough about the key to be worth not forwarding — and PRD section 14
 * requires the client to receive a friendly generic failure rather than a raw
 * upstream one. So every path narrows to a `GroqError` with a code the caller
 * can branch on and nothing else.
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

/** Long enough for a slow first token, short enough to fit a callable's patience. */
const REQUEST_TIMEOUT_MS = 45_000;

export type GroqErrorCode = 'unauthenticated' | 'rate-limited' | 'upstream' | 'timeout';

export class GroqError extends Error {
  constructor(readonly code: GroqErrorCode, message: string) {
    super(message);
    this.name = 'GroqError';
  }
}

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

function apiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    // Deliberately not the client's problem to diagnose; onCall maps this to the
    // same generic failure as any other upstream fault.
    throw new GroqError('unauthenticated', 'GROQ_API_KEY is not configured');
  }
  return key;
}

/** Maps an upstream status onto something the caller can act on. */
function fail(status: number): never {
  if (status === 401 || status === 403) {
    throw new GroqError('unauthenticated', 'Groq rejected the credential');
  }
  if (status === 429) throw new GroqError('rate-limited', 'Groq is rate limiting');
  throw new GroqError('upstream', `Groq responded ${status}`);
}

async function post(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey()}`, ...(init.headers ?? {}) },
    });
    if (!response.ok) fail(response.status);
    return response;
  } catch (error) {
    if (error instanceof GroqError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new GroqError('timeout', 'Groq did not respond in time');
    }
    throw new GroqError('upstream', 'Groq request failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streams the answer, yielding each delta as it lands.
 *
 * Real token streaming rather than a completed string revealed on a timer: PRD
 * section 13 rules the second one out explicitly, and the difference is
 * load-bearing — a faked reveal cannot start before the whole answer exists, so
 * the user waits the full generation either way and only *looks* like they are
 * being answered sooner.
 *
 * SSE frames are not guaranteed to arrive whole, so the tail of each chunk is
 * carried into the next read rather than parsed and dropped.
 */
export async function* streamChat(messages: ChatTurn[]): AsyncGenerator<string> {
  const response = await post(CHAT_URL, {
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

  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
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
        // A frame we cannot parse is a frame worth skipping; the stream is still
        // good, and failing the whole answer over one malformed delta is worse
        // than losing a few characters.
      }
    }
  }
}

/** The non-streaming path, for clients that did not ask for chunks. */
export async function completeChat(messages: ChatTurn[]): Promise<string> {
  const response = await post(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 700,
    }),
  });
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new GroqError('upstream', 'Groq returned no completion');
  }
  return content;
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
  audio: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  form.append('model', TRANSCRIBE_MODEL);
  form.append('response_format', 'json');

  const response = await post(TRANSCRIBE_URL, { method: 'POST', body: form });
  const json = (await response.json()) as { text?: string };
  if (typeof json.text !== 'string') {
    throw new GroqError('upstream', 'Groq returned no transcript');
  }
  return json.text.trim();
}
