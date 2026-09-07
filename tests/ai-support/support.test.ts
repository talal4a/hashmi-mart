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
import { functionsSdk } from '../support/firebase';

/**
 * The parts of AI Support that can be wrong without anyone noticing.
 *
 * Deliberately not the animations — those are verified by looking at them, and a
 * test that asserts a spring's damping only makes the spring harder to tune.
 * What is covered here is the wiring nobody sees fail: the WhatsApp number, the
 * error mapping that stands between a raw Firebase code and the user, and the
 * promise that a malformed backend answer is treated as a failure rather than
 * rendered as a message.
 */

function mockCallable(impl: {
  stream?: (...args: unknown[]) => unknown;
  call?: (...args: unknown[]) => unknown;
}) {
  const callable = Object.assign(
    jest.fn((...args: unknown[]) => impl.call?.(...args)),
    { stream: jest.fn((...args: unknown[]) => impl.stream?.(...args)) },
  );
  (functionsSdk.httpsCallable as jest.Mock).mockReturnValue(callable);
  return callable;
}

/** An async iterable of chunks, which is what `.stream()` hands back. */
async function* chunks(values: { delta: string }[]) {
  for (const value of values) yield value;
}

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
    // what the model sees, and section 5.1 wants it answering in Urdu.
    const track = QUICK_ACTIONS.find(a => a.id === 'track');
    expect(track?.label).toBe('Track my order');
    expect(track?.prompt).toMatch(/order/i);
    expect(track?.prompt).not.toBe(track?.label);
    expect(QUICK_ACTIONS).toHaveLength(6);
  });
});

describe('askSupport', () => {
  it('accumulates real deltas and returns the settled answer', async () => {
    mockCallable({
      stream: async () => ({
        stream: chunks([{ delta: 'Aap ka ' }, { delta: 'order ' }, { delta: 'raaste mein hai.' }]),
        data: Promise.resolve({ content: 'Aap ka order raaste mein hai.', handoff: false }),
      }),
    });

    const deltas: string[] = [];
    const result = await askSupport('Mera order kahan hai?', [], d => deltas.push(d));

    expect(deltas).toEqual(['Aap ka ', 'order ', 'raaste mein hai.']);
    expect(result.content).toBe('Aap ka order raaste mein hai.');
    expect(result.handoff).toBe(false);
  });

  it('surfaces the handoff flag the backend decided on', async () => {
    mockCallable({
      stream: async () => ({
        stream: chunks([]),
        data: Promise.resolve({ content: 'WhatsApp par baat karein.', handoff: true }),
      }),
    });
    const result = await askSupport('Refund chahiye', [], () => {});
    expect(result.handoff).toBe(true);
  });

  it('treats a malformed response as a failure instead of a message', async () => {
    mockCallable({
      stream: async () => ({ stream: chunks([]), data: Promise.resolve({ content: '' }) }),
    });
    await expect(askSupport('hi', [], () => {})).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });

  it.each([
    ['functions/unauthenticated', 'unauthenticated'],
    ['functions/resource-exhausted', 'busy'],
    ['functions/deadline-exceeded', 'timeout'],
    ['functions/unavailable', 'unavailable'],
    ['functions/internal', 'unavailable'],
  ])('maps %s to %s', async (code, kind) => {
    mockCallable({
      stream: async () => {
        throw Object.assign(new Error('boom'), { code });
      },
    });
    await expect(askSupport('hi', [], () => {})).rejects.toMatchObject({ kind });
  });

  it('distinguishes a user-requested stop from a failure', async () => {
    mockCallable({
      stream: async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      },
    });
    await expect(askSupport('hi', [], () => {})).rejects.toMatchObject({
      kind: 'aborted',
    });
  });
});

describe('transcribeVoice', () => {
  it('returns the trimmed transcript', async () => {
    mockCallable({ call: async () => ({ data: { text: '  Mera order late hai.  ' } }) });
    await expect(transcribeVoice('AAAA', 'audio/m4a')).resolves.toBe(
      'Mera order late hai.',
    );
  });

  it('never invents a transcript when the backend returns none', async () => {
    mockCallable({ call: async () => ({ data: {} }) });
    await expect(transcribeVoice('AAAA', 'audio/m4a')).rejects.toBeInstanceOf(
      SupportError,
    );
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
      expect(message).not.toMatch(/firebase|groq|functions\/|http|stack/i);
    }
  });
});

describe('support context', () => {
  it('supplies nothing until a trusted backend exists', async () => {
    // Section 16: with no verified context, the assistant must not be handed
    // order data it could then state as fact.
    await expect(loadSupportContext()).resolves.toBeNull();
  });
});
