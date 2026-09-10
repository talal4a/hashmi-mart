import { useEffect } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import CheckoutScreen from '../../src/screens/CheckoutScreen';
import { CartProvider, useCart } from '../../src/state/cart';
import { placeOrder } from '../../src/services/orders';

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
const mockProfile = {
  name: 'Talal Ahmed', phone: '+923001234567', address: 'House 12, Street 3',
};
const mockRoute = { params: { source: 'browse' } };
const mockNavigation = {
  navigate: mockNavigate, reset: mockReset, goBack: mockGoBack,
  setOptions: mockSetOptions, addListener: () => () => {},
};

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  usePreventRemove: jest.fn(),
}));
jest.mock('../../src/hooks/useProfileIdentity', () => ({
  __esModule: true,
  default: () => ({ user: { uid: 'customer-1', displayName: 'Talal Ahmed' }, profile: mockProfile }),
}));
// Firestore is the slow external boundary. The screen, form, catalog and cart
// remain real so these tests catch wrong step transitions and lost edits.
jest.mock('../../src/services/orders', () => ({
  ...jest.requireActual('../../src/services/orders'),
  placeOrder: jest.fn(),
}));
jest.mock('expo-audio', () => ({ useAudioPlayer: jest.fn(), useAudioPlayerStatus: jest.fn(), AudioModule: {}, RecordingPresets: { HIGH_QUALITY: {} }, setAudioModeAsync: jest.fn() }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => true,
}));

function Seed() {
  const { add, count } = useCart();
  useEffect(() => { add('tomato', 2); }, [add]);
  return <Text testID="cart-count">{count}</Text>;
}
function Harness() {
  return <CartProvider><Seed /><CheckoutScreen /></CartProvider>;
}

beforeEach(() => {
  jest.mocked(placeOrder).mockReset();
});

it('keeps quantity and order-only delivery edits when preview is edited again', async () => {
  const view = await render(<Harness />);
  await fireEvent.press(view.getByLabelText('Increase Tomato Organic quantity'));
  await fireEvent.changeText(view.getByLabelText('Delivery name'), 'Ayesha Ahmed');
  await fireEvent.changeText(view.getByLabelText('Delivery area'), 'Satellite Town');
  await fireEvent.changeText(view.getByLabelText('Order instructions'), 'Call at the gate');
  await fireEvent.press(view.getByLabelText('Continue to preview'));

  expect(view.getByText('Almost done')).toBeTruthy();
  expect(view.queryByLabelText('Delivery name')).toBeNull();
  expect(view.getByText('Ayesha Ahmed')).toBeTruthy();
  expect(view.getByText('Call at the gate')).toBeTruthy();
  expect(placeOrder).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText('Edit delivery details'));
  expect(view.getByLabelText('Delivery name').props.value).toBe('Ayesha Ahmed');
  expect(view.getByLabelText('Order instructions').props.value).toBe('Call at the gate');
  expect(view.getByLabelText('Tomato Organic quantity').props.value).toBe('3');
  expect(mockProfile.name).toBe('Talal Ahmed');
});

it('does not advance an empty basket to preview and lets a product be added', async () => {
  const view = await render(<Harness />);
  await fireEvent.press(view.getByLabelText('Remove Tomato Organic'));
  expect(view.getByLabelText('Continue to preview').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByLabelText('Add another item'));
  await fireEvent.changeText(view.getByLabelText('Search catalog'), 'banana');
  await fireEvent.press(view.getByLabelText('Add Banana Premium'));
  expect(view.getByLabelText('Banana Premium quantity').props.value).toBe('1');
});

it('locks duplicate submission synchronously and preserves all data after a rejection', async () => {
  let rejectOrder!: (error: Error) => void;
  jest.mocked(placeOrder).mockImplementation(() => new Promise((_, reject) => { rejectOrder = reject; }));
  const view = await render(<Harness />);
  await fireEvent.changeText(view.getByLabelText('Delivery area'), 'Satellite Town');
  await fireEvent.press(view.getByLabelText('Continue to preview'));
  const place = view.getByLabelText('Place order');
  await act(async () => { fireEvent.press(place); fireEvent.press(place); });
  expect(placeOrder).toHaveBeenCalledTimes(1);
  expect(view.getByText('Placing your order')).toBeTruthy();
  await act(async () => rejectOrder(new Error('network')));
  expect(view.getByText("We couldn't place your order. Please try again.")).toBeTruthy();
  expect(view.getByText('Almost done')).toBeTruthy();
  expect(view.getByTestId('cart-count').props.children).toBe(2);
  expect(view.getByLabelText('Retry order')).toBeTruthy();
});
