import { render, fireEvent, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CartProvider, useCart } from '../../src/state/cart';
import VoiceOrderFlow from '../../src/components/voice/VoiceOrderFlow';
import type { ConfirmedVoiceItem } from '../../src/components/voice/VoiceOrderSheet';

const mockNavigate = jest.fn();
const mockFly = jest.fn();

const mockItems: ConfirmedVoiceItem[] = [
  { productId: 'tomato', quantity: 2, origin: { x: 40, y: 300, size: 56 } },
  { productId: 'spinach', quantity: 1, origin: { x: 40, y: 360, size: 56 } },
];

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../src/components/home/cartFlight', () => ({
  ...jest.requireActual('../../src/components/home/cartFlight'),
  useCartFlight: () => ({
    fly: mockFly,
    setTarget: jest.fn(),
    arrivals: { value: 0 },
  }),
}));

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  // Pinned, because every timing below is conditional on it.
  useReducedMotion: () => false,
}));

// The sheet itself is exercised elsewhere; what matters here is what the screen
// does with the items it hands over.
jest.mock('../../src/components/voice/VoiceOrderSheet', () => {
  const react = require('react');
  const rn = require('react-native');
  return {
    __esModule: true,
    default: ({
      onConfirm,
    }: {
      onConfirm: (items: unknown[], order: Record<string, unknown>) => void;
    }) =>
      react.createElement(
        rn.Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'confirm',
          onPress: () =>
            onConfirm(mockItems, {
              transcript: 'دو کلو ٹماٹر اور پالک',
              missed: ['anday'],
              recording: { uri: 'file:///order.m4a', durationMs: 4200 },
            }),
        },
        react.createElement(rn.Text, null, 'confirm'),
      ),
  };
});

/**
 * Confirming a spoken order.
 *
 * The bug this covers had no error and no crash: items went into the cart and
 * nothing moved, on a screen whose whole language is things flying into a
 * basket, and the flow stopped there instead of going on to pay. Both halves
 * are invisible failures, so both are pinned here.
 *
 * The timings are asserted as an order of events rather than as exact
 * milliseconds where possible — but the launch delay is exact on purpose. A
 * flight that starts before the sheet has dismissed travels behind it, which
 * looks like no flight at all, and that is precisely the regression.
 */

function Probe() {
  const { count, quantities } = useCart();
  return (
    <>
      <Text testID="count">{count}</Text>
      <Text testID="basket">{JSON.stringify(quantities)}</Text>
    </>
  );
}

function Harness({ onClose }: { onClose: () => void }) {
  return (
    <CartProvider>
      <VoiceOrderFlow visible onClose={onClose} />
      <Probe />
    </CartProvider>
  );
}

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

type View = Awaited<ReturnType<typeof render>>;

const basket = (view: View) =>
  JSON.parse(view.getByTestId('basket').props.children as string) as Record<
    string,
    number
  >;

beforeEach(() => {
  mockNavigate.mockClear();
  mockFly.mockClear();
});

describe('confirming a voice order', () => {
  it('closes the sheet before anything is launched', async () => {
    const onClose = jest.fn();
    const view = await render(<Harness onClose={onClose} />);

    await act(async () => {
      fireEvent.press(view.getByLabelText('confirm'));
    });

    // The sheet goes at once. Nothing else does: a flight sent while a Modal is
    // up is drawn underneath it.
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockFly).not.toHaveBeenCalled();
    expect(basket(view)).toEqual({});
  });

  it('flies each item into the cart, one after another', async () => {
    const view = await render(<Harness onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('confirm'));
    });

    // First item, once the sheet is out of the way.
    await advance(320);
    expect(mockFly).toHaveBeenCalledTimes(1);
    expect(mockFly).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 40, y: 300, size: 56 }),
    );
    // The count rises with the departure, not the arrival.
    expect(basket(view)).toEqual({ tomato: 2 });

    // Second item, a stagger later — not at the same moment as the first.
    await advance(160);
    expect(mockFly).toHaveBeenCalledTimes(2);
    expect(basket(view)).toEqual({ tomato: 2, spinach: 1 });
    expect(view.getByTestId('count').props.children).toBe(3);
  });

  it('carries the produce artwork so the flight is of the right item', async () => {
    const view = await render(<Harness onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('confirm'));
    });
    await advance(320 + 160);

    // Tomato and spinach are different illustrations; a flight that sent the
    // same one twice would look like the wrong item going in.
    const [first] = mockFly.mock.calls[0] as [{ art: number }];
    const [second] = mockFly.mock.calls[1] as [{ art: number }];
    expect(first.art).not.toBe(second.art);
  });

  it('opens checkout once the last item has landed, not before', async () => {
    const view = await render(<Harness onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('confirm'));
    });

    // Both have left, the second is still in the air.
    await advance(320 + 160);
    expect(mockNavigate).not.toHaveBeenCalled();

    await advance(460 + 220);
    expect(mockNavigate).toHaveBeenCalledWith('Checkout', {
      source: 'voice',
      // The sentence travels with the order: Urdu and Punjabi are matched
      // against a small catalogue, so what was said settles what was meant.
      transcript: 'دو کلو ٹماٹر اور پالک',
      // And so does what we could not sell them, or the order just arrives
      // short with nothing said about it.
      missed: ['anday'],
      // And the recording, so checkout can play back what was actually said
      // rather than only a machine's reading of it.
      recording: { uri: 'file:///order.m4a', durationMs: 4200 },
    });
  });

  it('does not act on an order the user has navigated away from', async () => {
    const view = await render(<Harness onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.press(view.getByLabelText('confirm'));
    });

    await act(async () => {
      view.unmount();
    });
    await advance(5000);

    expect(mockFly).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
