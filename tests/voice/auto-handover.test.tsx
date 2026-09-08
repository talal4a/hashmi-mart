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

    // Shown, not asked: there is no button to press here.
    expect(view.queryByLabelText('Adding 2 items to your cart')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [items, transcript] = onConfirm.mock.calls[0];
    expect(items).toEqual([
      expect.objectContaining({ productId: 'banana', quantity: 1 }),
      expect.objectContaining({ productId: 'tomato', quantity: 1 }),
    ]);
    expect(transcript).toBe('مجھے کیلا اور ٹماٹر چاہیے');
  });

  it('does not hand over an order it could not match', async () => {
    const onConfirm = jest.fn();
    mockOrder.matches = [
      { query: 'anday', quantity: 1, confidence: 'low' },
    ];

    const view = await render(
      <VoiceOrderSheet visible onClose={jest.fn()} onConfirm={onConfirm} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
    // The recording is still a complete order on its own.
    expect(
      view.queryByLabelText('Send voice order to the store'),
    ).toBeTruthy();
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
