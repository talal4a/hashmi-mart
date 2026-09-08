import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import CartFeedbackProvider, { useCartFeedback } from '../../src/components/cart/CartFeedbackProvider';
import { selectCartCount, useCartStore } from '../../src/stores/cartStore';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
}));

let appChange: (state: string) => void;
let motionChange: (reduced: boolean) => void;
const sourceMeasure = jest.fn();
const source = { current: { measureInWindow: sourceMeasure } as unknown as View };

function Add() {
  const feedback = useCartFeedback();
  return <Pressable accessibilityRole="button" accessibilityLabel="Test add"
    onPress={() => {
      useCartStore.getState().adjustQuantity('tomato', 1);
      feedback?.flyToCart(0, source);
    }}><Text>Add</Text></Pressable>;
}

beforeEach(() => {
  useCartStore.setState({ quantities: {} });
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appChange = listener;
    return { remove: jest.fn() };
  });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_, listener) => {
    motionChange = listener as (reduced: boolean) => void;
    return { remove: jest.fn() };
  });
  sourceMeasure.mockReset();
});

test('rapid taps cap in-flight measurement work while every item is added', async () => {
  const view = await render(<CartFeedbackProvider><Add /></CartFeedbackProvider>);
  for (let i = 0; i < 20; i++) await fireEvent.press(view.getByLabelText('Test add'));
  expect(selectCartCount(useCartStore.getState())).toBe(20);
  expect(sourceMeasure).toHaveBeenCalledTimes(2);
  await act(async () => { jest.advanceTimersByTime(300); });
  await fireEvent.press(view.getByLabelText('Test add'));
  expect(sourceMeasure).toHaveBeenCalledTimes(3);
});

test('backgrounding cancels pending feedback without losing business state', async () => {
  const view = await render(<CartFeedbackProvider><Add /></CartFeedbackProvider>);
  await fireEvent.press(view.getByLabelText('Test add'));
  await act(() => appChange('background'));
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(view.queryAllByTestId('cart-product-flight')).toHaveLength(0);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(selectCartCount(useCartStore.getState())).toBe(1);
  await act(() => appChange('active'));
  await fireEvent.press(view.getByLabelText('Test add'));
  expect(sourceMeasure).toHaveBeenCalledTimes(2);
});

test('live Reduce Motion changes skip product travel and retain a single light feedback', async () => {
  const view = await render(<CartFeedbackProvider><Add /></CartFeedbackProvider>);
  await act(() => motionChange(true));
  await fireEvent.press(view.getByLabelText('Test add'));
  expect(sourceMeasure).not.toHaveBeenCalled();
  expect(view.queryAllByTestId('cart-product-flight')).toHaveLength(0);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(selectCartCount(useCartStore.getState())).toBe(1);
});

test('covered/unmounted navigation never delivers a delayed landing haptic', async () => {
  const view = await render(<CartFeedbackProvider><Add /></CartFeedbackProvider>);
  await fireEvent.press(view.getByLabelText('Test add'));
  await view.rerender(<CartFeedbackProvider enabled={false}><Add /></CartFeedbackProvider>);
  await fireEvent.press(view.getByLabelText('Test add'));
  await view.unmount();
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(sourceMeasure).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(selectCartCount(useCartStore.getState())).toBe(2);
});
