jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({
    exists: true,
    size: 4,
    name: 'note.m4a',
    type: 'audio/mp4',
    bytes: async () => new Uint8Array([1, 2, 3, 4]),
  })),
}));
jest.mock('expo/fetch', () => ({
  fetch: (...args: Parameters<typeof fetch>) => global.fetch(...args),
}));
import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
const { installFormDataPatch } = jest.requireActual<
  typeof import('expo/src/winter/FormData')
>('expo/src/winter/FormData');
const NativeFormData = require('react-native/Libraries/Network/FormData')
  .default as typeof FormData;

import { Linking } from 'react-native';
import {
  askSupport,
  SupportError,
  supportErrorMessage,
  transcribeVoice,
} from '../../src/services/supportService';
import { openWhatsApp } from '../../src/utils/whatsapp';
import { QUICK_ACTIONS, SUPPORT_PHONE_E164 } from '../../src/config/support';
import { loadSupportContext } from '../../src/services/supportContext';
import { account, auth } from '../support/firebase';

/**
 * The parts of AI Support that can be wrong without anyone noticing.
 *
 * Deliberately not the animations — those are verified by looking at them, and
 * a test that asserts a spring's damping only makes the spring harder to tune.
 * What is covered here is the wiring nobody sees fail: the WhatsApp number, the
 * ID token that stands between the Worker and a free Groq proxy, the error
 * mapping between an HTTP status and something a person can read, and the
 * promise that a malformed backend answer is treated as a failure rather than
 * rendered as a message.
 */

type Listener = () => void;

class FakeXHR {
  static last: FakeXHR | null = null;
  readyState = 0;
  status = 200;
  responseText = '';
  responseType = '';
  timeout = 0;
  headers: Record<string, string> = {};
  sent: string | null = null;
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
    this.onabort?.();
  }
  deliver(frames: string, status = 200) {
    this.responseText = frames;
    this.readyState = 3;
    this.onreadystatechange?.();
    this.status = status;
    this.readyState = 4;
    this.onload?.();
  }
}

const frame = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

/**
 * Waits for the request to actually be opened.
 *
 * `askSupport` awaits a Firebase ID token before it touches the network, so the
 * XHR does not exist on the first microtask tick — and counting ticks by hand is
 * how a test becomes sensitive to an unrelated `await` being added later.
 */
async function openedRequest(): Promise<FakeXHR> {
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
    if (FakeXHR.last?.sent != null) return FakeXHR.last;
  }
  throw new Error('no request was opened');
}

beforeEach(() => {
  global.FormData = installFormDataPatch(
    NativeFormData as unknown as typeof FormData,
  ) as unknown as typeof FormData;
  (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
  FakeXHR.last = null;
  auth.currentUser = account;
});

describe('WhatsApp escalation', () => {
  it('opens the client-specified number in international form', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    await openWhatsApp();

    const url = open.mock.calls[0][0];
    expect(url).toContain(`https://wa.me/${SUPPORT_PHONE_E164}`);
    // 0310 4198984 with Pakistan's country code and no separators. Getting this
    // wrong opens a chat with nobody, which looks like it worked.
    expect(url).toContain('https://wa.me/923104198984');
    expect(decodeURIComponent(url)).toContain(
      'Assalam-o-Alaikum, I need help with HashmiMart.',
    );
  });

  it('reports failure rather than throwing when WhatsApp is absent', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    await expect(openWhatsApp()).resolves.toBe(false);
  });
});

describe('quick actions', () => {
  it('sends prompts in the user’s language, not the label’s', () => {
    // The labels are English because the client asked for them; the prompts are
    // what the model sees, and the assistant must answer in Urdu.
    const track = QUICK_ACTIONS.find(a => a.id === 'track');
    expect(track?.label).toBe('Track my order');
    expect(track?.prompt).toMatch(/order/i);
    expect(track?.prompt).not.toBe(track?.label);
    expect(QUICK_ACTIONS).toHaveLength(6);
  });
});

describe('askSupport', () => {
  it('authenticates every request with the user’s Firebase ID token', async () => {
    const pending = askSupport('Mera order kahan hai?', [], () => {});
    const xhr = await openedRequest();

    // Without this header the Worker rejects the call — and if the Worker ever
    // stopped requiring it, the endpoint would be a free Groq proxy.
    expect(xhr.headers.Authorization).toBe('Bearer test-id-token');

    xhr.deliver(frame({ done: true, content: 'Theek hai.', handoff: false }));
    await expect(pending).resolves.toMatchObject({ content: 'Theek hai.' });
  });

  it('refuses to call the backend when nobody is signed in', async () => {
    auth.currentUser = null;
    await expect(askSupport('hi', [], () => {})).rejects.toMatchObject({
      kind: 'unauthenticated',
    });
  });

  it('accumulates real deltas and resolves with the settled answer', async () => {
    const deltas: string[] = [];
    const pending = askSupport('Mera order kahan hai?', [], d =>
      deltas.push(d),
    );
    const xhr = await openedRequest();

    xhr.deliver(
      frame({ delta: 'Aap ka ' }) +
        frame({ delta: 'order raaste mein hai.' }) +
        frame({
          done: true,
          content: 'Aap ka order raaste mein hai.',
          handoff: false,
        }),
    );

    await expect(pending).resolves.toEqual({
      content: 'Aap ka order raaste mein hai.',
      handoff: false,
    });
    expect(deltas).toEqual(['Aap ka ', 'order raaste mein hai.']);
  });

  it('surfaces the handoff flag the backend decided on', async () => {
    const pending = askSupport('Refund chahiye', [], () => {});
    (await openedRequest()).deliver(
      frame({
        done: true,
        content: 'WhatsApp par baat karein.',
        handoff: true,
      }),
    );
    await expect(pending).resolves.toMatchObject({ handoff: true });
  });

  it('treats an empty answer as a failure instead of a message', async () => {
    const pending = askSupport('hi', [], () => {});
    (await openedRequest()).deliver(
      frame({ done: true, content: '   ', handoff: false }),
    );
    await expect(pending).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it.each([
    [401, 'unauthenticated'],
    [429, 'busy'],
    [504, 'timeout'],
    [503, 'unavailable'],
  ])('maps HTTP %s to %s', async (status, kind) => {
    const pending = askSupport('hi', [], () => {});
    (await openedRequest()).deliver('', status as number);
    await expect(pending).rejects.toMatchObject({ kind });
  });

  it('distinguishes a user-requested stop from a failure', async () => {
    const controller = new AbortController();
    const pending = askSupport('hi', [], () => {}, controller.signal);
    await openedRequest();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('transcribeVoice', () => {
  it('encodes actual file bytes with the installed Expo multipart encoder', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: '  Mera order late hai.  ' }),
    }));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    await expect(
      transcribeVoice('file:///tmp/note.m4a', 'audio/m4a'),
    ).resolves.toBe('Mera order late hai.');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-id-token',
    );
    expect(init.body).toBeInstanceOf(FormData);
    // Exercise Expo's real serializer: the old URI descriptor fails here.
    const legacy = new FormData();
    legacy.append('file', {
      uri: 'file:///tmp/note.m4a',
      name: 'note.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);
    await expect(convertFormDataAsync(legacy)).rejects.toThrow(
      'Unsupported FormDataPart implementation',
    );
    const { body } = await convertFormDataAsync(
      init.body as FormData,
      'test-boundary',
    );
    const encoded = String.fromCharCode(...body);
    expect(encoded).toContain('filename="note.m4a"');
    expect(encoded).toContain('content-type: audio/mp4');
    expect(encoded).toContain(String.fromCharCode(1, 2, 3, 4));
    // Setting Content-Type by hand loses the multipart boundary Expo generates,
    // and the Worker then cannot parse the body at all.
    expect(
      (init.headers as Record<string, string>)['Content-Type'],
    ).toBeUndefined();
  });

  it('never invents a transcript when the backend returns none', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    await expect(
      transcribeVoice('file:///tmp/note.m4a', 'audio/m4a'),
    ).rejects.toBeInstanceOf(SupportError);
  });

  it('reports a dead connection as offline rather than a backend fault', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(
      transcribeVoice('file:///tmp/note.m4a', 'audio/m4a'),
    ).rejects.toMatchObject({ kind: 'offline' });
  });
});

describe('supportErrorMessage', () => {
  it('never leaks backend vocabulary to the user', () => {
    const kinds = [
      'offline',
      'unauthenticated',
      'busy',
      'timeout',
      'aborted',
      'unavailable',
    ] as const;
    for (const kind of kinds) {
      const message = supportErrorMessage(kind);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(
        /groq|worker|cloudflare|firebase|http|stack/i,
      );
    }
  });
});

describe('support context', () => {
  it('supplies nothing until a trusted backend exists', async () => {
    // With no verified context, the assistant must not be handed order data it
    // could then state as fact.
    await expect(loadSupportContext()).resolves.toBeNull();
  });
});

describe('voice request lifecycle', () => {
  it('aborts an upload that exceeds its deadline', async () => {
    global.fetch = jest.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    ) as typeof fetch;
    const pending = transcribeVoice('file:///tmp/note.m4a', 'audio/m4a');
    const rejected = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await jest.advanceTimersByTimeAsync(45_000);
    await rejected;
  });
  it('aborts upload when the caller stops it', async () => {
    global.fetch = jest.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    ) as typeof fetch;
    const controller = new AbortController();
    const pending = transcribeVoice(
      'file:///tmp/note.m4a',
      'audio/m4a',
      controller.signal,
    );
    const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' });
    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  });
});
