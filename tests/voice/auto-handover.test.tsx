import { render, act, fireEvent } from '@testing-library/react-native';
import VoiceOrderSheet from '../../src/components/voice/VoiceOrderSheet';
import type { CatalogMatch } from '../../src/services/voiceCatalog';

const mockOrder = {
  stage: 'review' as string,
  transcript: 'مجھے کیلا اور ٹماٹر چاہیے',
  matches: [] as CatalogMatch[],
  addable: [] as CatalogMatch[],
  confidence: 'high' as const,
  reference: null,
  error: null,
  hasRecording: true,
  interpret: jest.fn(),
  setQuantity: jest.fn(),
  sendToStore: jest.fn(),
  reset: jest.fn(),
  recording: { uri: 'file:///order.m4a', durationMs: 4200, mimeType: 'audio/m4a' },
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../src/hooks/useVoiceOrder', () => ({
  __esModule: true,
  default: () => mockOrder,
}));

jest.mock('../../src/hooks/useVoiceRecorder', () => ({
  __esModule: true,
  default: () => ({
    recording: false,
    levels: [],
    durationMs: 0,
    status: 'idle',
    start: jest.fn(async () => true),
    stop: jest.fn(),
    cancel: jest.fn(async () => {}),
  }),
  formatDuration: () => '0:00',
}));

/**
 * The order goes to the cart without being asked to.
 *
 * A customer who has just said what they want should not have to say it again
 * by tapping Confirm — and when nothing matched, the old sheet's only
 * remaining button sent the recording off to be phoned back about, which is
 * how "banana and tomato" ended on a screen promising a call. So: found items
 * hand themselves over; an empty match keeps the fallback and nothing else.
 */

const matched = (productId: string, name: string): CatalogMatch => ({
  query: name,
  productId,
  productName: name,
  quantity: 1,
  confidence: 'high',
});

beforeEach(() => {
  mockOrder.stage = 'review';
  mockOrder.transcript = 'مجھے کیلا اور ٹماٹر چاہیے';
  mockOrder.matches = [];
  mockOrder.addable = [];
  mockOrder.reset.mockClear();
});

describe('the voice sheet', () => {
  it('hands found items over on its own, with no tap', async () => {
    const onConfirm = jest.fn();
    mockOrder.matches = [
      matched('banana', 'Banana Premium'),
      matched('tomato', 'Tomato Organic'),
    ];
    mockOrder.addable = mockOrder.matches;

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={onConfirm} />,
    );

    // Shown, not asked. The wait is tappable — it draws itself down and a tap
    // goes straight through — but nothing has to be pressed for the order to
    // reach the cart.
    const now = view.queryByLabelText('Add 2 items to your cart now');
    expect(now).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    // And no competing offer to have the store call back instead: the items
    // are already on their way, so there is nothing to choose between.
    expect(view.queryByLabelText('Send voice order to the store')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [items, order] = onConfirm.mock.calls[0];
    expect(items).toEqual([
      expect.objectContaining({ productId: 'banana', quantity: 1 }),
      expect.objectContaining({ productId: 'tomato', quantity: 1 }),
    ]);
    expect(order.transcript).toBe('مجھے کیلا اور ٹماٹر چاہیے');
    // Carried so checkout can play back what was actually said.
    expect(order.recording).toEqual({
      uri: 'file:///order.m4a',
      durationMs: 4200,
    });
  });

  it('says which stage it is on, all the way through', async () => {
    // The waits are the whole experience of a voice order and they used to be
    // a spinner with a changing caption — which is the same picture whether
    // transcription is running or the request died four seconds ago. The rail
    // is the thing that makes a slow stage legible as a stage.
    mockOrder.stage = 'transcribing';
    const first = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(first.getByLabelText('Step 2 of 4')).toBeTruthy();
    expect(first.getByText('Listening to your order…')).toBeTruthy();

    mockOrder.stage = 'understanding';
    const second = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(second.getByLabelText('Step 3 of 4')).toBeTruthy();

    mockOrder.stage = 'review';
    mockOrder.matches = [matched('banana', 'Banana Premium')];
    mockOrder.addable = mockOrder.matches;
    const third = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(third.getByLabelText('Step 4 of 4')).toBeTruthy();
  });

  it('goes straight through when the wait is tapped', async () => {
    // The delay is there so the matches can be read. Someone who has read them
    // should not have to sit through the rest of it — and before the bar was
    // tappable, there was nothing they could do but wait.
    const onConfirm = jest.fn();
    mockOrder.matches = [matched('banana', 'Banana Premium')];
    mockOrder.addable = mockOrder.matches;

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={onConfirm} />,
    );

    await act(async () => {
      fireEvent.press(view.getByLabelText('Add 1 item to your cart now'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);

    // And the timer it pre-empted must not fire a second handover behind it.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not hand over an order it could not match', async () => {
    const onConfirm = jest.fn();
    mockOrder.matches = [
      { query: 'anday', quantity: 1, confidence: 'low', unstocked: 'eggs' },
    ];

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={onConfirm} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
    // Saying it again is offered first, because it is the repair that works.
    expect(view.queryByLabelText('Record your order again')).toBeTruthy();
    // The recording is still a complete order on its own.
    expect(
      view.queryByLabelText('Send voice order to the store'),
    ).toBeTruthy();
  });

  it('says the shelf is empty, not that it misheard', async () => {
    mockOrder.matches = [
      { query: 'anday', quantity: 1, confidence: 'low', unstocked: 'eggs' },
    ];

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    // We understood perfectly. Telling this customer we did not catch them is
    // the worse of the two mistakes.
    expect(view.queryByText('Out of stock right now')).toBeTruthy();
    // Said in the headline and again on the row itself, so it is clear which
    // of the items was the problem.
    expect(view.queryAllByText(/don't sell eggs yet/).length).toBe(2);
    expect(view.queryByText(/couldn't make/i)).toBeNull();
  });

  it('asks for the order again when it could not place the words', async () => {
    mockOrder.matches = [
      { query: 'zzzqqq', quantity: 1, confidence: 'low' },
    ];

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(view.queryByText("We didn't catch that")).toBeTruthy();
    expect(view.queryByText(/Say the item names on their own/)).toBeTruthy();
  });

  it('says it heard nothing at all when the recording was silent', async () => {
    mockOrder.transcript = '';
    mockOrder.matches = [];

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(view.queryByText("We couldn't hear anything")).toBeTruthy();
  });

  it('drops the handover when the sheet is closed first', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    mockOrder.matches = [matched('tomato', 'Tomato Organic')];
    mockOrder.addable = mockOrder.matches;

    const view = await render(
      <VoiceOrderSheet visible onClose={onClose} onConfirm={onConfirm} />,
    );

    // Dismissing is enough; the pending handover must not fill a cart and
    // open checkout from a screen the customer has already left.
    await act(async () => {
      fireEvent.press(view.getByLabelText('Close'));
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
