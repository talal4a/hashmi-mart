import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import FreshProductCard from '../../src/components/home/FreshProductCard';
import CartPreview from '../../src/components/home/CartPreview';
import HomeBottomNav from '../../src/components/home/HomeBottomNav';
import { freshPicks } from '../../src/data/groceryHome';
import { selectCartCount, useCartStore } from '../../src/stores/cartStore';
import { flightEndpoints, sampleFlight } from '../../src/components/cart/cartMotion';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

beforeEach(() => useCartStore.setState({ quantities: {} }));

test('rapid adds, removals and invalid adjustments keep a single accurate total', () => {
  const adjust = useCartStore.getState().adjustQuantity;
  for (let i = 0; i < 100; i++) adjust('tomato', 1);
  adjust('banana', 3);
  adjust('tomato', -10);
  expect(selectCartCount(useCartStore.getState())).toBe(93);
  adjust('banana', -100);
  expect(useCartStore.getState().quantities.banana).toBeUndefined();
  for (const delta of [NaN, Infinity, 1.5, 0]) adjust('tomato', delta);
  expect(selectCartCount(useCartStore.getState())).toBe(90);
});

test('badge, card and cart sheet share quantities across unmounts', async () => {
  const first = await render(<FreshProductCard item={freshPicks[0]} />);
  await fireEvent.press(first.getByLabelText('Add Tomato Organic to cart'));
  for (let i = 0; i < 11; i++) {
    await fireEvent.press(first.getByLabelText('Add another Tomato Organic'));
  }
  await first.unmount();
  const view = await render(
    <NavigationContainer>
      <HomeBottomNav onOpenCart={jest.fn()} />
      <CartPreview visible onClose={jest.fn()} />
    </NavigationContainer>,
  );
  expect(view.getByTestId('home-cart').props.accessibilityValue.text).toBe('12 items');
  expect(view.getByText('12 items')).toBeTruthy();
  expect(view.getByText('Rs. 1,440')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('Remove one Tomato Organic'));
  expect(view.getByTestId('home-cart').props.accessibilityValue.text).toBe('11 items');
  expect(selectCartCount(useCartStore.getState())).toBe(11);
});

test('cart opens immediately, exposes the full quantity and preserves the other tabs', async () => {
  const open = jest.fn();
  const change = jest.fn();
  useCartStore.getState().adjustQuantity('tomato', 105);
  const view = await render(<HomeBottomNav onOpenCart={open} onChange={change} />);
  const cart = view.getByRole('button', { name: 'Cart' });
  expect(cart.props.accessibilityValue.text).toBe('105 items');
  expect(view.getByText('99+')).toBeTruthy();
  await fireEvent.press(cart);
  expect(open).toHaveBeenCalledTimes(1);
  for (const tab of ['home', 'categories', 'orders', 'profile']) {
    await fireEvent.press(view.getByTestId(`home-tab-${tab}`));
    expect(change).toHaveBeenLastCalledWith(tab);
  }
  await act(() => useCartStore.setState({ quantities: {} }));
  expect(view.queryByTestId('cart-badge')).toBeNull();
  expect(view.getByRole('button', { name: 'Cart' }).props.accessibilityValue.text).toBe('0 items');
});

test.each([
  { x: 0, y: 0, width: 320, height: 640 },
  { x: 18, y: 44, width: 390, height: 800 },
  { x: 0, y: 24, width: 720, height: 360 },
])('flight lands at the measured basket with overlay offsets: %j', overlay => {
  const source = { x: overlay.x + 20, y: overlay.y + 80, width: 120, height: 120 };
  const basket = { x: overlay.x + overlay.width / 2, y: overlay.y + overlay.height - 80, width: 2, height: 2 };
  const points = flightEndpoints(source, basket, overlay)!;
  expect(points.start).toEqual({ x: 80, y: 140 });
  const last = sampleFlight(1, points.start, points.end);
  expect(last.x).toBe(basket.x + 1 - overlay.x);
  expect(last.y).toBe(basket.y + 1 - overlay.y);
  expect(last.opacity).toBeCloseTo(0);
  expect(sampleFlight(0.8, points.start, points.end).opacity).toBe(1);
  for (let t = 0; t <= 1; t += 0.01) {
    const frame = sampleFlight(t, points.start, points.end);
    expect(Object.values(frame).every(Number.isFinite)).toBe(true);
    expect(frame.opacity).toBeGreaterThanOrEqual(0);
    expect(frame.scale).toBeGreaterThan(0);
  }
});

test('missing, stale and offscreen measurements do not invent a flight target', () => {
  const overlay = { x: 0, y: 0, width: 320, height: 640 };
  const basket = { x: 160, y: 540, width: 2, height: 2 };
  expect(flightEndpoints({ x: 0, y: -400, width: 100, height: 100 }, basket, overlay)).toBeNull();
  expect(flightEndpoints(overlay, { ...basket, width: 0 }, overlay)).toBeNull();
  expect(flightEndpoints(overlay, { ...basket, x: NaN }, overlay)).toBeNull();
});
