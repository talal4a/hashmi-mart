import { streamSSE } from '../../src/services/sse';

/**
 * The SSE reader, which is the one piece of this feature with no equivalent in
 * a browser.
 *
 * React Native's `fetch` cannot expose a streaming body, so this reads growing
 * `responseText` off an XHR and tracks how much it has already parsed. Every
 * failure mode below is one that produces a *plausible looking* bug rather than
 * an obvious one — a frame split across two network reads renders as truncated
 * text, a mis-tracked cursor renders as duplicated text, and both look like the
 * model misbehaving rather than the transport.
 */

type Listener = () => void;

/** A controllable stand-in for RN's XHR, driven frame by frame from the test. */
class FakeXHR {
  static last: FakeXHR;
  readyState = 0;
  status = 200;
  responseText = '';
  responseType = '';
  timeout = 0;
  headers: Record<string, string> = {};
  sent: string | null = null;
  aborted = false;
  onreadystatechange: Listener | null = null;
  onload: Listener | null = null;
  onerror: Listener | null = null;
  ontimeout: Listener | null = null;
  onabort: Listener | null = null;

  constructor() {
    FakeXHR.last = this;
  }
  open() {}
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send(body: string) {
    this.sent = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  /** Delivers more bytes, the way a slow connection would. */
  push(chunk: string) {
    this.responseText += chunk;
    this.readyState = 3;
    this.onreadystatechange?.();
  }
  complete(status = 200) {
    this.status = status;
    this.readyState = 4;
    this.onload?.();
  }
}

const frame = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

beforeEach(() => {
  (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
});

function collect() {
  const deltas: string[] = [];
  const done: { content: string; handoff: boolean }[] = [];
  const errors: string[] = [];
  return {
    deltas,
    done,
    errors,
    handlers: {
      onDelta: (d: string) => deltas.push(d),
      onDone: (p: { content: string; handoff: boolean }) => done.push(p),
      onError: (k: string) => errors.push(k),
    },
  };
}

describe('streamSSE', () => {
  it('sends the bearer token and the JSON body', () => {
    const { handlers } = collect();
    streamSSE('https://w.example/chat', 'tok-123', { message: 'hi' }, handlers);

    expect(FakeXHR.last.headers.Authorization).toBe('Bearer tok-123');
    expect(FakeXHR.last.headers.Accept).toBe('text/event-stream');
    expect(JSON.parse(FakeXHR.last.sent!)).toEqual({ message: 'hi' });
  });

  it('emits each delta as it arrives, without duplicating', () => {
    const { deltas, done, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);

    FakeXHR.last.push(frame({ delta: 'Aap ka ' }));
    FakeXHR.last.push(frame({ delta: 'order ' }));
    FakeXHR.last.push(frame({ delta: 'raaste mein hai.' }));
    FakeXHR.last.push(
      frame({ done: true, content: 'Aap ka order raaste mein hai.', handoff: false }),
    );
    FakeXHR.last.complete();

    expect(deltas).toEqual(['Aap ka ', 'order ', 'raaste mein hai.']);
    expect(done).toEqual([
      { content: 'Aap ka order raaste mein hai.', handoff: false },
    ]);
  });

  it('holds a frame split across reads until it is whole', () => {
    const { deltas, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);

    // The network does not respect frame boundaries. Parsing this half would
    // throw away the delta; parsing it twice would double it.
    FakeXHR.last.push('data: {"delta":"Assalam-o-');
    expect(deltas).toEqual([]);

    FakeXHR.last.push('Alaikum"}\n\n');
    expect(deltas).toEqual(['Assalam-o-Alaikum']);
  });

  it('parses several frames delivered in one read', () => {
    const { deltas, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);

    FakeXHR.last.push(frame({ delta: 'a' }) + frame({ delta: 'b' }) + frame({ delta: 'c' }));

    expect(deltas).toEqual(['a', 'b', 'c']);
  });

  it('still delivers the answer when nothing streams incrementally', () => {
    // A proxy that buffers the whole response, or a platform that never fires
    // readyState 3. Streaming degrades to non-streaming, not to nothing.
    const { deltas, done, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);

    FakeXHR.last.responseText =
      frame({ delta: 'Ji ' }) + frame({ done: true, content: 'Ji haan.', handoff: false });
    FakeXHR.last.complete();

    expect(deltas).toEqual(['Ji ']);
    expect(done).toEqual([{ content: 'Ji haan.', handoff: false }]);
  });

  it('reports a mid-stream error frame as a failure', () => {
    const { errors, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);

    FakeXHR.last.push(frame({ delta: 'partial' }));
    FakeXHR.last.push(frame({ error: 'busy' }));

    expect(errors).toEqual(['busy']);
  });

  it.each([
    [401, 'unauthenticated'],
    [429, 'busy'],
    [504, 'timeout'],
    [503, 'unavailable'],
    [0, 'offline'],
  ])('maps HTTP %s to %s', (status, kind) => {
    const { errors, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);
    FakeXHR.last.complete(status as number);
    expect(errors).toEqual([kind]);
  });

  it('skips an unparseable frame rather than failing the answer', () => {
    const { deltas, errors, handlers } = collect();
    streamSSE('https://w.example/chat', 't', {}, handlers);

    FakeXHR.last.push('data: {not json}\n\n');
    FakeXHR.last.push(frame({ delta: 'still here' }));

    expect(deltas).toEqual(['still here']);
    expect(errors).toEqual([]);
  });

  it('aborts the request when the signal fires, and reports it once', () => {
    const { errors, handlers } = collect();
    const controller = new AbortController();
    streamSSE('https://w.example/chat', 't', {}, handlers, controller.signal);

    controller.abort();

    expect(FakeXHR.last.aborted).toBe(true);
    expect(errors).toEqual(['aborted']);

    // A late completion must not fire a second handler.
    FakeXHR.last.complete(200);
    expect(errors).toEqual(['aborted']);
  });
});
