import React from 'react';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { act, fireEvent, render } from '@testing-library/react-native';
import OrderTrackingScreen from '../../src/screens/OrderTrackingScreen';
import { watchOrder, type PlacedOrder } from '../../src/services/orders';

// The listener is the remote boundary; render the real screen and focus hook.
jest.mock('../../src/services/orders', () => ({ watchOrder: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => true,
}));

const order = {
  id: 'order-1', reference: 'HM-ABC234', status: 'placed', source: 'browse',
  createdAt: 1_789_000_000_000,
  lines: [{ productId: 'tomato', name: 'Tomato Organic', quantity: 3, unitPrice: 120, lineTotal: 360, unit: 'kg' }],
  subtotal: 360, deliveryFee: 99, discount: 20, total: 439,
  name: 'Ayesha Ahmed', phone: '+923001234567',
  address: 'House 12, Street 3', area: 'Satellite Town', instructions: 'Call at the gate',
  payment: { method: 'cash_on_delivery', status: 'pending' },
} as PlacedOrder;

type Subscription = {
  value: (value: PlacedOrder) => void;
  error: (error: Error) => void;
  stop: jest.Mock;
};
let subscriptions: Subscription[];

function navigationHarness(canGoBack = true) {
  let focused = true;
  const listeners = new Map<string, Set<() => void>>();
  const navigation = {
    isFocused: () => focused,
    canGoBack: () => canGoBack,
    goBack: jest.fn(),
    reset: jest.fn(),
    addListener: (event: string, handler: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return () => { listeners.get(event)!.delete(handler); };
    },
  };
  return {
    navigation,
    focus(value: boolean) {
      focused = value;
      listeners.get(value ? 'focus' : 'blur')?.forEach(handler => handler());
    },
    wrapper({ children }: React.PropsWithChildren) {
      return (
        <NavigationContext.Provider value={navigation as never}>
          <NavigationRouteContext.Provider value={{ key: 'track-1', name: 'OrderTracking', params: { orderId: 'order-1', reference: 'HM-ABC234' } }}>
            {children}
          </NavigationRouteContext.Provider>
        </NavigationContext.Provider>
      );
    },
  };
}

beforeEach(() => {
  subscriptions = [];
  jest.mocked(watchOrder).mockImplementation((id, value, error) => {
    if (id !== 'order-1') throw new Error('Wrong order selected');
    const stop = jest.fn();
    subscriptions.push({ value, error, stop });
    return stop;
  });
});

it('loads the requested order and updates its visible status from the live listener', async () => {
  const nav = navigationHarness();
  const view = await render(<OrderTrackingScreen />, { wrapper: nav.wrapper });
  expect(view.getByLabelText('Loading order updates')).toBeTruthy();
  expect(view.getByText('HM-ABC234')).toBeTruthy();
  await act(() => subscriptions[0].value({ ...order, status: 'preparing' }));
  expect(view.getByLabelText('Current order status: Preparing')).toBeTruthy();
  expect(view.getByText('Tomato Organic')).toBeTruthy();
  expect(view.getByText('3 × Rs. 120')).toBeTruthy();
  expect(view.getByText('Rs. 439')).toBeTruthy();
  expect(view.getByText('Satellite Town')).toBeTruthy();
  expect(view.getByText('Call at the gate')).toBeTruthy();
  await act(() => subscriptions[0].value({ ...order, status: 'delivered' }));
  expect(view.getByLabelText('Current order status: Delivered')).toBeTruthy();
  expect(view.queryByLabelText('Current order status: Preparing')).toBeNull();
});

it.each([
  ['placed', 'Order received'],
  ['packed', 'Packed'],
  ['out_for_delivery', 'Out for delivery'],
  ['cancelled', 'Cancelled'],
  ['unrecognized_internal_status', 'Status update pending'],
])('shows a safe customer status for %s', async (status, label) => {
  const nav = navigationHarness();
  const view = await render(<OrderTrackingScreen />, { wrapper: nav.wrapper });
  await act(() => subscriptions[0].value({ ...order, status }));
  expect(view.getByLabelText(`Current order status: ${label}`)).toBeTruthy();
  if (status === 'cancelled' || status === 'unrecognized_internal_status') {
    expect(view.queryByLabelText('Order progress')).toBeNull();
  }
  expect(view.queryByText('unrecognized_internal_status')).toBeNull();
});

it('retries unavailable updates without exposing errors or accepting an old listener result', async () => {
  const nav = navigationHarness();
  const view = await render(<OrderTrackingScreen />, { wrapper: nav.wrapper });
  await act(() => subscriptions[0].error(new Error('FirebaseError: permission-denied secret')));
  expect(view.queryByLabelText('Loading order updates')).toBeNull();
  expect(view.getByText("We couldn't load this order.")).toBeTruthy();
  expect(view.queryByText(/FirebaseError/)).toBeNull();
  await fireEvent.press(view.getByLabelText('Retry order updates'));
  expect(subscriptions[0].stop).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText('Loading order updates')).toBeTruthy();
  await act(() => {
    subscriptions[0].value({ ...order, status: 'cancelled' });
    subscriptions[0].error(new Error('old failure'));
  });
  expect(view.getByLabelText('Loading order updates')).toBeTruthy();
  await act(() => subscriptions[1].value({ ...order, status: 'packed' }));
  expect(view.getByLabelText('Current order status: Packed')).toBeTruthy();
});

it('stops updates on blur, ignores late events and resubscribes on focus', async () => {
  const nav = navigationHarness();
  const view = await render(<OrderTrackingScreen />, { wrapper: nav.wrapper });
  await act(() => subscriptions[0].value(order));
  await act(() => nav.focus(false));
  expect(subscriptions[0].stop).toHaveBeenCalledTimes(1);
  await act(() => {
    subscriptions[0].value({ ...order, status: 'delivered' });
    subscriptions[0].error(new Error('late failure'));
  });
  expect(view.getByLabelText('Current order status: Order received')).toBeTruthy();
  await act(() => nav.focus(true));
  expect(view.getByLabelText('Loading order updates')).toBeTruthy();
  await act(() => subscriptions[1].value({ ...order, status: 'out_for_delivery' }));
  expect(view.getByLabelText('Current order status: Out for delivery')).toBeTruthy();
  await view.unmount();
  expect(subscriptions[1].stop).toHaveBeenCalledTimes(1);
});

it('returns home safely when tracking has no previous screen', async () => {
  const nav = navigationHarness(false);
  const view = await render(<OrderTrackingScreen />, { wrapper: nav.wrapper });
  await fireEvent.press(view.getByLabelText('Back'));
  expect(nav.navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Home' }] });
  expect(nav.navigation.goBack).not.toHaveBeenCalled();
});
