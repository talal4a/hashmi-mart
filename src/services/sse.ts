import type { SupportFailure } from './supportService';

/**
 * Server-Sent Events over XMLHttpRequest, because React Native cannot do it
 * with `fetch`.
 *
 * RN's `fetch` is a polyfill over XHR and does not implement `response.body`:
 * awaiting it gives you the whole answer at the end, which is precisely the
 * "reveal a finished string" behaviour the streaming design exists to avoid.
 * XHR, underneath, *does* deliver partial text — `responseText` grows as bytes
 * arrive — so this reads from there and tracks how much it has already parsed.
 *
 * The important safety property is at the bottom: if a platform or a proxy
 * delivers nothing until the response completes, every frame is still parsed at
 * the end. Streaming degrades to non-streaming rather than to nothing.
 */

export type SSEHandlers = {
  onDelta: (delta: string) => void;
  /** The terminal frame carrying the settled answer. */
  onDone: (payload: { content: string; handoff: boolean }) => void;
  onError: (kind: SupportFailure) => void;
};

/** HTTP status to the six things the UI does differently. */
function kindFromStatus(status: number): SupportFailure {
  if (status === 401) return 'unauthenticated';
  if (status === 429) return 'busy';
  if (status === 504) return 'timeout';
  // A dead network gives XHR status 0, which is indistinguishable here from a
  // DNS failure — both mean the same thing to the user.
  if (status === 0) return 'offline';
  return 'unavailable';
}

export function streamSSE(
  url: string,
  token: string,
  body: unknown,
  handlers: SSEHandlers,
  signal?: AbortSignal,
): void {
  const xhr = new XMLHttpRequest();
  let cursor = 0;
  let settled = false;

  /** Guards against a late frame firing a handler after abort or completion. */
  const finish = (run: () => void) => {
    if (settled) return;
    settled = true;
    run();
  };

  const consume = () => {
    const text = xhr.responseText ?? '';
    if (text.length <= cursor) return;

    // Only complete frames are parsed; a partial tail stays for the next pass.
    const pending = text.slice(cursor);
    const lastBreak = pending.lastIndexOf('\n\n');
    if (lastBreak < 0) return;

    const ready = pending.slice(0, lastBreak);
    cursor += lastBreak + 2;

    for (const frame of ready.split('\n\n')) {
      const line = frame.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim());
        if (typeof payload.delta === 'string') {
          handlers.onDelta(payload.delta);
        } else if (payload.error) {
          finish(() => handlers.onError(payload.error as SupportFailure));
        } else if (payload.done) {
          finish(() =>
            handlers.onDone({
              content: String(payload.content ?? ''),
              handoff: payload.handoff === true,
            }),
          );
        }
      } catch {
        // A frame that will not parse is a frame worth skipping; losing a few
        // characters beats failing an answer that is otherwise arriving fine.
      }
    }
  };

  xhr.open('POST', url, true);
  xhr.responseType = 'text';
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.setRequestHeader('Accept', 'text/event-stream');

  xhr.onreadystatechange = () => {
    // 3 is LOADING: the body is still arriving, and this is the whole point.
    if (xhr.readyState === 3) consume();
  };

  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      finish(() => handlers.onError(kindFromStatus(xhr.status)));
      return;
    }
    // Catches everything, including the case where readyState 3 never fired.
    consume();
    finish(() => handlers.onError('unavailable'));
  };

  xhr.onerror = () => finish(() => handlers.onError(kindFromStatus(xhr.status)));
  xhr.ontimeout = () => finish(() => handlers.onError('timeout'));
  xhr.onabort = () => finish(() => handlers.onError('aborted'));

  // Long enough for a slow first token on a weak connection, short enough that a
  // dead request does not hang the composer's Stop button forever.
  xhr.timeout = 60_000;

  if (signal) {
    if (signal.aborted) {
      handlers.onError('aborted');
      return;
    }
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
  }

  xhr.send(JSON.stringify(body));
}
