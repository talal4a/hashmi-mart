import { useEffect } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import CheckoutScreen from '../../src/screens/CheckoutScreen';
import { CartProvider, useCart } from '../../src/state/cart';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPlaceOrder = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { source: 'voice', transcript: 'do kilo tamatar' } }),
}));

jest.mock('../../src/services/orders', () => ({
  placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The voice note player pulls in the native audio stack, which does not load
// under Jest. Nothing here exercises playback; it just has to render.
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), seekTo: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false, currentTime: 0, duration: 0 }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  RecordingPresets: { HIGH_QUALITY: {} },
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ exists: true, size: 100 })),
}));

/**
 * The account, arriving in two parts.
 *
 * Auth resolves first and the Firestore profile a moment later, which is the
 * ordinary case and the one that used to leave the form half-filled. The
 * `mock` prefixes are not decoration: Jest hoists `jest.mock` above every
 * declaration in the file, and only names prefixed that way may be reached
 * from inside a factory.
 */
const mockIdentity: { current: { user: unknown; profile: unknown } } = {
  current: { user: null, profile: null },
};
const mockListeners = new Set<() => void>();

const mockProfile = {
  name: 'Talal Ahmed',
  phone: '+923001234567',
  address: 'House 12, Satellite Town',
};
const mockUser = { uid: 'u1', displayName: 'Talal Ahmed' };

jest.mock('../../src/hooks/useProfileIdentity', () => ({
  __esModule: true,
  default: () => {
    const react = require('react');
    const [, bump] = react.useReducer((n: number) => n + 1, 0);
    react.useEffect(() => {
      mockListeners.add(bump);
      return () => {
        mockListeners.delete(bump);
      };
    }, [bump]);
    return mockIdentity.current;
  },
}));

const setIdentity = (next: { user: unknown; profile: unknown }) => {
  mockIdentity.current = next;
  mockListeners.forEach(listener => listener());
};

/**
 * Checkout as three stages, and the boundary between them.
 *
 * The thing this file exists for is the write. Everything before Place order
 * has to be free — a customer must be able to walk to Preview, change their
 * mind, go back and fix an address without leaving half-orders in Firestore —
 * and the receipt must be reachable only by an order that actually exists,
 * never by a timer that assumed one would.
 *
 * The stepper is pinned too, because it is the whole point of the redesign and
 * because losing it is silent: the screens still work, you just stop knowing
 * where you are.
 */

/** Something in the basket, put there the way a voice order puts it there. */
function Seed() {
  const { add } = useCart();
  useEffect(() => {
    add('tomato', 2);
  }, [add]);
  return null;
}

const open = async () => {
  const view = await render(
    <CartProvider>
      <Seed />
      <CheckoutScreen />
    </CartProvider>,
  );
  return view;
};

beforeEach(() => {
  setIdentity({ user: mockUser, profile: mockProfile });
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPlaceOrder.mockReset();
  mockPlaceOrder.mockResolvedValue({ id: 'o1', reference: 'HM-8842' });
});

describe('voice order checkout', () => {
  it('opens on Details with the account already filled in', async () => {
    const view = await open();

    expect(view.getByLabelText('Step 1 of 3: Details')).toBeTruthy();
    // Prefilled, and as ordinary editable fields — not as read-only text with
    // an "edit" step in front of it, which is the same typing plus a tap.
    expect(view.getByTestId('checkout-name').props.value).toBe('Talal Ahmed');
    expect(view.getByTestId('checkout-phone').props.value).toBe('300 123 4567');
    expect(view.getByTestId('checkout-address').props.value).toBe(
      'House 12, Satellite Town',
    );
    // And nothing has been written anywhere yet.
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });

  it('finishes filling in when the profile lands after the session does', async () => {
    // Auth resolves before the Firestore read, every time. A form that seeded
    // itself on the first of those and then stopped left the phone and address
    // blank on an account that had both — and nothing about the screen said so,
    // because a blank field looks exactly like a blank field.
    setIdentity({ user: mockUser, profile: null });
    const view = await open();

    expect(view.getByTestId('checkout-name').props.value).toBe('Talal Ahmed');
    expect(view.getByTestId('checkout-phone').props.value).toBe('');

    await act(async () => {
      setIdentity({ user: mockUser, profile: mockProfile });
    });

    expect(view.getByTestId('checkout-phone').props.value).toBe('300 123 4567');
    expect(view.getByTestId('checkout-address').props.value).toBe(
      'House 12, Satellite Town',
    );
  });

  it('never lands a late profile on top of what is being typed', async () => {
    setIdentity({ user: mockUser, profile: null });
    const view = await open();

    await act(async () => {
      fireEvent.changeText(view.getByTestId('checkout-address'), 'House 90, Street 7');
    });
    await act(async () => {
      setIdentity({ user: mockUser, profile: mockProfile });
    });

    // The saved address must not appear under the cursor mid-correction.
    expect(view.getByTestId('checkout-address').props.value).toBe(
      'House 90, Street 7',
    );
    // While a field they have not touched still fills in.
    expect(view.getByTestId('checkout-phone').props.value).toBe('300 123 4567');
  });

  it('will not continue while a detail is missing, and says which', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.changeText(view.getByTestId('checkout-phone'), '12');
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Continue to preview'));
    });

    // Held on Details, with the complaint under the field it belongs to.
    expect(view.getByLabelText('Step 1 of 3: Details')).toBeTruthy();
    expect(view.getByText('Enter a valid mobile number')).toBeTruthy();
  });

  it('reaches Preview without writing anything', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Continue to preview'));
    });

    expect(view.getByLabelText('Step 2 of 3: Preview')).toBeTruthy();
    // The whole reason for the split: getting here commits nothing, so it can
    // be reached and left as often as the customer likes.
    expect(mockPlaceOrder).not.toHaveBeenCalled();
    // And it is a confirmation, not the form again — nothing on it edits.
    expect(view.queryByTestId('checkout-phone')).toBeNull();
    expect(view.queryByLabelText('One more Tomato Organic')).toBeNull();
  });

  it('goes back to Details with every edit still there', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.changeText(view.getByTestId('checkout-address'), 'House 90, Street 7');
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Continue to preview'));
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Edit delivery details'));
    });

    expect(view.getByLabelText('Step 1 of 3: Details')).toBeTruthy();
    expect(view.getByTestId('checkout-address').props.value).toBe(
      'House 90, Street 7',
    );
  });

  it('places the order and only then shows the receipt', async () => {
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Continue to preview'));
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Place order for Rs. 339'));
    });

    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
    const [draft] = mockPlaceOrder.mock.calls[0];
    // Written down at the moment they were agreed, and in canonical form: a
    // phone number stored as the customer typed it is a number the shop may
    // not be able to dial.
    expect(draft).toEqual(
      expect.objectContaining({
        source: 'voice',
        transcript: 'do kilo tamatar',
        phone: '+923001234567',
        area: 'Satellite Town',
        total: 339,
      }),
    );

    // The receipt is reached by an order that exists, never by a timer.
    expect(view.getByLabelText('Step 3 of 3: Receipt')).toBeTruthy();
    expect(view.getAllByText('HM-8842').length).toBeGreaterThan(0);
  });

  it('keeps the order and the basket when the write fails', async () => {
    mockPlaceOrder.mockRejectedValue(new Error('down'));
    const view = await open();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Continue to preview'));
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Place order for Rs. 339'));
    });

    // Still on Preview, still able to try again — a cart emptied optimistically
    // is an order the customer has to reassemble from memory.
    expect(view.getByLabelText('Step 2 of 3: Preview')).toBeTruthy();
    expect(view.getByLabelText('Place order for Rs. 339')).toBeTruthy();
  });
});
